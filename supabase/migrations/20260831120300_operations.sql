-- Operations: the cross-cutting tables that make server actions safe to retry,
-- auditable after the fact, and visible to the user.
--
-- Every table here is written only by server functions holding the service role.
-- Three of the four therefore have no RLS policy at all — RLS denies whatever no
-- policy permits, so an empty policy set is a complete deny for `anon` and
-- `authenticated`, which is exactly the intent. The absence of a policy below is
-- the security control, not an omission.
--
-- They land now, before the payment and order code that leans hardest on them,
-- because retry-safety and audit trails are not features that can be
-- retro-fitted: the first server write that happens without them is a write
-- nobody can reconstruct or safely repeat.


-- ── audit_logs ───────────────────────────────────────────────────────────────

create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  -- Null for system-initiated actions (a scheduled job, a webhook). Set null on
  -- user deletion rather than cascading: erasing the actor would erase the record
  -- of what they did, which defeats the table.
  actor_id        uuid references auth.users (id) on delete set null,
  -- Retained as text so the trail survives the actor's deletion legibly.
  actor_role      text,
  action          text not null,
  entity_type     text not null,
  entity_id       text,
  -- Before/after snapshots. Both nullable: a create has no before, a delete has
  -- no after.
  before_state    jsonb,
  after_state     jsonb,
  -- Ties an entry back to the request that caused it, across however many
  -- functions that request touched. Generated in api/_lib/correlation.ts.
  correlation_id  text,
  ip_hash         text,
  user_agent      text,
  created_at      timestamptz not null default now(),

  constraint audit_logs_action_present check (char_length(btrim(action)) > 0)
);

comment on table public.audit_logs is
  'Append-only record of privileged actions. Intentionally has no RLS policy: not even an admin reads this through PostgREST. Admin dashboards call /api, which reads it with the service role — an audit trail the audited party can reach is a weaker audit trail.';

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);

create index audit_logs_correlation_idx
  on public.audit_logs (correlation_id)
  where correlation_id is not null;

alter table public.audit_logs enable row level security;
-- No policies. See the comment above.


-- ── idempotency_keys ─────────────────────────────────────────────────────────

create table public.idempotency_keys (
  -- Scoped so that a key minted for one operation cannot replay another's
  -- response: ('checkout', 'abc') and ('video_job', 'abc') are different rows.
  scope            text not null,
  key              text not null,
  user_id          uuid references auth.users (id) on delete set null,
  -- Hash of the canonicalised request body. The load-bearing column: a client
  -- that reuses a key with a *different* payload has a bug, and replaying the
  -- first response would hide it while silently discarding the second request.
  -- That case must be an error, and this is what detects it.
  request_hash     text not null,
  status           text not null default 'in_progress',
  response_status  integer,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  -- Keys are retained long enough to cover any plausible client retry, then
  -- reaped. Without an expiry this table grows without bound.
  expires_at       timestamptz not null default now() + interval '7 days',

  primary key (scope, key),

  constraint idempotency_keys_status_valid check (
    status in ('in_progress', 'completed', 'failed')
  ),
  constraint idempotency_keys_completed_has_response check (
    status <> 'completed' or response_status is not null
  ),
  constraint idempotency_keys_expiry_after_creation check (expires_at > created_at)
);

create index idempotency_keys_expires_at_idx on public.idempotency_keys (expires_at);

alter table public.idempotency_keys enable row level security;
-- No policies: claiming and replaying keys is a server-side concern only.


-- ── webhook_events ───────────────────────────────────────────────────────────

create table public.webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  -- The provider's own event identifier. Nullable because not every provider
  -- sends one, but when present it is what makes redelivery a no-op.
  provider_event_id   text,
  event_type          text not null,
  -- Recorded rather than assumed. An unverified event is stored (so the attempt
  -- is visible) but must never be processed, and that decision needs to be
  -- inspectable afterwards.
  signature_verified  boolean not null default false,
  payload             jsonb not null,
  status              text not null default 'received',
  attempts            integer not null default 0,
  error_message       text,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,

  constraint webhook_events_status_valid check (
    status in ('received', 'processed', 'failed', 'ignored')
  ),
  constraint webhook_events_attempts_non_negative check (attempts >= 0),
  constraint webhook_events_provider_present check (
    char_length(btrim(provider)) > 0
  )
);

comment on table public.webhook_events is
  'Store-once inbox for provider callbacks. Paystack (step 8) treats webhooks as payment truth, so the unique index below is what stops a redelivered event from being applied twice.';

create unique index webhook_events_provider_event_key
  on public.webhook_events (provider, provider_event_id)
  where provider_event_id is not null;

create index webhook_events_status_received_idx
  on public.webhook_events (status, received_at desc);

alter table public.webhook_events enable row level security;
-- No policies: only the webhook endpoint, holding the service role, touches this.


-- ── notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Text with a check rather than an enum: later steps add order, donation, and
  -- moderation kinds, and extending a check constraint is an ordinary migration
  -- whereas `alter type ... add value` has transaction restrictions that make it
  -- awkward to batch with other changes.
  kind        text not null,
  title       text not null,
  body        text,
  -- Deep-link target and any render parameters.
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),

  constraint notifications_kind_valid check (
    kind in ('system', 'account', 'ai_quota')
  ),
  constraint notifications_title_present check (char_length(btrim(title)) > 0)
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_own_read
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- The only legitimate client mutation is marking one read. RLS cannot restrict
-- *which columns* an update touches, so the policy permits the update and the
-- trigger below pins every other column back to its stored value.
create policy notifications_own_update
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert policy: notifications are raised by server functions, not by users.

create or replace function app.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Reverting instead of raising keeps a well-behaved "mark read" request
  -- succeeding while making a malicious or buggy one a silent no-op on the
  -- fields it had no business touching.
  new.user_id    := old.user_id;
  new.kind       := old.kind;
  new.title      := old.title;
  new.body       := old.body;
  new.data       := old.data;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function app.guard_notification_update();
