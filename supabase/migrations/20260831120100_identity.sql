-- Identity: who a user is, what they may do platform-wide, and what they have
-- agreed to.
--
-- `auth.users` (managed by Supabase Auth) is the root of identity. Everything
-- here hangs off it with `on delete cascade`, so deleting an auth user erases
-- their identity rows in one statement — which is what step 3's account-deletion
-- flow needs.
--
-- Deliberately absent: an `email` column on `profiles`. Mirroring email into a
-- user-writable table means either a sync trigger racing Supabase Auth or a guard
-- trigger rejecting client writes, and it creates a second place for the address
-- to be wrong. `auth.users.email` stays the single source of truth; the browser
-- already has it from its own session, and the server can join to it with the
-- service role. This also satisfies the plan's requirement that email changes go
-- through Supabase verification rather than a direct profile mutation — there is
-- simply nothing here to mutate.

-- Mirrors the unions in types.ts so a bad value cannot be stored. Kept in `app`
-- rather than `public` because these are internal vocabulary, not API surface.
-- Note the doubled apostrophe: Shafi'i.
create type app.sect as enum ('Sunni', 'Shia');
create type app.madhab as enum (
  'General', 'Hanafi', 'Maliki', 'Shafi''i', 'Hanbali', 'Usuli', 'Akhbari'
);

-- translations.ts currently ships `en` and `ar` only. Adding a language means
-- adding a value here and a translation block there; the enum is what stops a
-- preference from referencing strings that do not exist.
create type app.language as enum ('en', 'ar');
create type app.theme_mode as enum ('light', 'dark', 'system');


-- ── profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null default '',
  avatar_url        text,
  preferred_sect    app.sect,
  preferred_madhab  app.madhab,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint profiles_display_name_length check (char_length(display_name) <= 120)
);

comment on table public.profiles is
  'Per-user profile. Created automatically by app.handle_new_user(); never inserted by the client.';

alter table public.profiles enable row level security;

-- Read is own-row plus moderators/admins. Not public: a public select policy here
-- would expose every user on the platform to an anonymous scrape. Public display
-- names for reviews (step 10) will come from a narrow view or an API join, not
-- from opening this table up.
create policy profiles_self_or_staff_read
  on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_moderator_or_admin());

create policy profiles_self_update
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert or delete policy on purpose: the auth.users trigger owns creation and
-- the cascade owns removal, so neither needs to be reachable from a client.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();


-- ── user_roles ───────────────────────────────────────────────────────────────

create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        app.app_role not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users (id) on delete set null,

  primary key (user_id, role)
);

comment on table public.user_roles is
  'Platform-wide roles. Organization-scoped roles (owner/operator/courier) are a property of a membership and arrive in step 5 as organization_members.role.';

alter table public.user_roles enable row level security;

-- Own rows only, and the predicate is a bare `auth.uid()` comparison rather than
-- a call to app.has_role().
--
-- This is the recursion trap: app.has_role() reads THIS table, so a policy here
-- that called it would re-enter the policy to satisfy the read. The fix is not to
-- call it. Admin views of other users' roles go through /api with the service
-- role, which is where role grants happen anyway.
create policy user_roles_self_read
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- No write policy of any kind. Granting or revoking a role is a privileged
-- action performed by a server function with the service key and an audit_logs
-- entry; RLS denies every write that no policy permits.


-- ── addresses ────────────────────────────────────────────────────────────────

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  label        text,
  line1        text not null,
  line2        text,
  city         text not null,
  region       text,
  country      public.country_code not null references public.supported_markets (country),
  postal_code  text,
  -- Populated by server-side geocoding (step 6), not by the browser. Delivery
  -- zone checks run against these, so a client-supplied coordinate would let a
  -- customer claim to be inside a zone they are not in.
  latitude     double precision,
  longitude    double precision,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint addresses_line1_present check (char_length(btrim(line1)) > 0),
  constraint addresses_city_present check (char_length(btrim(city)) > 0),
  -- A half-set coordinate is worse than none: it reads as valid but places the
  -- user on the equator or the prime meridian.
  constraint addresses_coords_complete check (
    (latitude is null) = (longitude is null)
  ),
  constraint addresses_latitude_range check (
    latitude is null or latitude between -90 and 90
  ),
  constraint addresses_longitude_range check (
    longitude is null or longitude between -180 and 180
  )
);

-- Enforces "at most one default" in the database rather than in application code,
-- where two concurrent requests can both believe they are setting the only one.
create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create index addresses_user_id_idx on public.addresses (user_id);

alter table public.addresses enable row level security;

-- Uniform own-row CRUD. `using` governs which existing rows are visible to
-- select/update/delete; `with check` governs what insert/update may write. Both
-- are required — `using` alone would let a user re-parent their row to someone
-- else's user_id.
create policy addresses_own_all
  on public.addresses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function app.set_updated_at();


-- ── user_preferences ─────────────────────────────────────────────────────────

create table public.user_preferences (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  language    app.language not null default 'en',
  theme       app.theme_mode not null default 'system',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.user_preferences is
  'Signed-in mirror of the localStorage language/theme keys. Guests keep using localStorage; step 3 imports these once on first login.';

alter table public.user_preferences enable row level security;

-- Insert is permitted here, unlike profiles, because the client legitimately
-- upserts preferences: the row exists from the signup trigger, but an upsert is
-- the natural way to write a setting and it must not fail if the trigger is ever
-- bypassed (a user created directly in the dashboard, for instance).
create policy user_preferences_own_all
  on public.user_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function app.set_updated_at();


-- ── consents ─────────────────────────────────────────────────────────────────

create type app.consent_kind as enum (
  'terms', 'privacy', 'ai_disclaimer', 'marketing'
);

create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         app.consent_kind not null,
  -- Which document version was agreed to. Re-consent after a policy change is
  -- detected by comparing this against the current version, so it is required.
  version      text not null,
  granted      boolean not null,
  recorded_at  timestamptz not null default now(),
  -- Evidence of the act of consenting. The IP is stored hashed because the raw
  -- address is personal data and nothing here needs to reverse it.
  user_agent   text,
  ip_hash      text,

  constraint consents_version_present check (char_length(btrim(version)) > 0)
);

comment on table public.consents is
  'Append-only consent log. Current state for a (user, kind) is the most recent row by recorded_at — grant, withdrawal, and re-grant are all separate rows because the history is the legally meaningful artefact.';

create index consents_user_kind_recorded_idx
  on public.consents (user_id, kind, recorded_at desc);

alter table public.consents enable row level security;

create policy consents_own_read
  on public.consents for select to authenticated
  using (user_id = auth.uid());

create policy consents_own_insert
  on public.consents for insert to authenticated
  with check (user_id = auth.uid());

-- No update or delete policy: withdrawing consent appends a `granted = false`
-- row. Editing history away would defeat the purpose of keeping it.

create policy consents_staff_read
  on public.consents for select to authenticated
  using (app.is_admin());


-- ── Signup provisioning ──────────────────────────────────────────────────────

-- Runs inside the signup transaction, so a failure here fails the signup. Every
-- statement is therefore written to be unable to fail: `coalesce` for the name
-- (OAuth providers disagree about which metadata key holds it, and email/password
-- signups send neither) and `on conflict do nothing` throughout so that a retried
-- or manually-created user is not an error.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- Every account starts as a consumer. An explicit row means has_role('consumer')
  -- is a real check rather than "absence of any other role".
  insert into public.user_roles (user_id, role)
  values (new.id, 'consumer'::app.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
