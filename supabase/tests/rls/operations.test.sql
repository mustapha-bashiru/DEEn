-- RLS and constraint tests for the operations tables.
--
-- Three of the four have no policies at all, which is the security control rather
-- than an oversight. These tests are what make that intent explicit and keep a
-- later migration from "helpfully" adding a read policy to audit_logs.

begin;
select plan(24);

select tests.clear_authentication();

create temporary table actors (name text primary key, id uuid not null);
insert into actors (name, id) values
  ('alice', tests.create_user('alice@test.local')),
  ('bob', tests.create_user('bob@test.local')),
  ('admin', tests.create_user('admin@test.local'));

select tests.grant_role((select id from actors where name = 'admin'), 'admin');


-- ── RLS is actually switched on ──────────────────────────────────────────────
--
-- Especially important on the policy-less tables: without RLS enabled, "no
-- policies" means unrestricted access rather than none.

select ok(tests.rls_enabled('public', 'audit_logs'), 'audit_logs has RLS enabled');
select ok(tests.rls_enabled('public', 'idempotency_keys'), 'idempotency_keys has RLS enabled');
select ok(tests.rls_enabled('public', 'webhook_events'), 'webhook_events has RLS enabled');
select ok(tests.rls_enabled('public', 'notifications'), 'notifications has RLS enabled');


-- ── Fixtures ─────────────────────────────────────────────────────────────────

insert into public.audit_logs (actor_id, action, entity_type, entity_id)
values ((select id from actors where name = 'bob'), 'role.grant', 'user_roles', 'some-id');

insert into public.idempotency_keys (scope, key, request_hash)
values ('checkout', 'key-1', 'hash-1');

insert into public.webhook_events (provider, provider_event_id, event_type, payload)
values ('paystack', 'evt_1', 'charge.success', '{}'::jsonb);

insert into public.notifications (user_id, kind, title, body) values
  ((select id from actors where name = 'alice'), 'system', 'For alice', 'hello'),
  ((select id from actors where name = 'bob'), 'system', 'For bob', 'hello');


-- ── audit_logs: unreachable from PostgREST, by anyone ────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select is_empty(
  $$ select 1 from public.audit_logs $$,
  'an ordinary user cannot read the audit log'
);

select throws_ok(
  $$ insert into public.audit_logs (action, entity_type) values ('forged', 'thing') $$,
  '42501'::text,
  null,
  'an ordinary user cannot write to the audit log'
);

-- Deliberate: admin dashboards read audit history through /api with the service
-- role, not through the client. An audit trail the audited party can reach is a
-- weaker audit trail, and an admin is very much an audited party.
select tests.authenticate_as((select id from actors where name = 'admin'));

select is_empty(
  $$ select 1 from public.audit_logs $$,
  'not even an admin can read the audit log through PostgREST'
);


-- ── idempotency_keys: server-only ────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select is_empty(
  $$ select 1 from public.idempotency_keys $$,
  'a user cannot read idempotency keys'
);

select throws_ok(
  $$ insert into public.idempotency_keys (scope, key, request_hash)
     values ('checkout', 'forged', 'hash') $$,
  '42501'::text,
  null,
  'a user cannot claim an idempotency key directly'
);


-- ── webhook_events: server-only, and store-once ──────────────────────────────

select is_empty(
  $$ select 1 from public.webhook_events $$,
  'a user cannot read the webhook inbox'
);

select throws_ok(
  $$ insert into public.webhook_events (provider, event_type, payload)
     values ('paystack', 'charge.success', '{}'::jsonb) $$,
  '42501'::text,
  null,
  'a user cannot forge a webhook event'
);

select tests.clear_authentication();

-- The property that makes redelivery safe. Paystack retries aggressively and
-- treats a slow acknowledgement as a failure, so the same event id will arrive
-- more than once.
select throws_ok(
  $$ insert into public.webhook_events (provider, provider_event_id, event_type, payload)
     values ('paystack', 'evt_1', 'charge.success', '{}'::jsonb) $$,
  '23505'::text,
  null,
  'the same provider event cannot be stored twice'
);

-- Two providers may legitimately use the same event id; the uniqueness is per
-- provider, not global.
select lives_ok(
  $$ insert into public.webhook_events (provider, provider_event_id, event_type, payload)
     values ('other', 'evt_1', 'charge.success', '{}'::jsonb) $$,
  'the same event id from a different provider is accepted'
);

select throws_ok(
  $$ insert into public.idempotency_keys (scope, key, request_hash)
     values ('checkout', 'key-1', 'different-hash') $$,
  '23505'::text,
  null,
  'an idempotency key cannot be claimed twice within a scope'
);

select lives_ok(
  $$ insert into public.idempotency_keys (scope, key, request_hash)
     values ('video_job', 'key-1', 'hash-1') $$,
  'the same key in a different scope is a different claim'
);

select throws_ok(
  $$ update public.idempotency_keys set status = 'completed'
     where scope = 'checkout' and key = 'key-1' $$,
  '23514'::text,
  null,
  'a key cannot be marked completed without a stored response status'
);


-- ── notifications ────────────────────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select isnt_empty(
  $$ select 1 from public.notifications where title = 'For alice' $$,
  'alice can read her own notification'
);

select is_empty(
  $$ select 1 from public.notifications where title = 'For bob' $$,
  'alice cannot read bob''s notification'
);

select throws_ok(
  $$ insert into public.notifications (user_id, kind, title)
     values (auth.uid(), 'system', 'Self-issued') $$,
  '42501'::text,
  null,
  'a user cannot raise their own notification'
);

-- The one legitimate client mutation, plus an attempt to rewrite the content
-- alongside it. RLS cannot restrict which columns an update touches, so
-- app.guard_notification_update() pins everything except read_at.
update public.notifications
set read_at = now(), title = 'Tampered', body = 'Tampered'
where user_id = auth.uid();

select isnt_empty(
  $$ select 1 from public.notifications where user_id = auth.uid() and read_at is not null $$,
  'alice can mark her notification read'
);

select is(
  (select n.title from public.notifications n where n.user_id = auth.uid()),
  'For alice',
  'the update trigger reverted alice''s attempt to rewrite the notification text'
);

select tests.clear_authentication();

select throws_ok(
  format(
    $$ insert into public.notifications (user_id, kind, title)
       values (%L, 'not_a_real_kind', 'Bad kind') $$,
    (select id from actors where name = 'alice')
  ),
  '23514'::text,
  null,
  'an unrecognised notification kind is rejected'
);


-- ── Cascade and retention ────────────────────────────────────────────────────

delete from auth.users where id = (select id from actors where name = 'alice');

select is(
  (select count(*)::int from public.notifications where title = 'For alice'),
  0,
  'deleting the auth user removed their notifications'
);

-- The audit entry names bob as actor. Deleting bob must not erase the record of
-- what he did, so the reference is `on delete set null` rather than a cascade.
delete from auth.users where id = (select id from actors where name = 'bob');

select is(
  (select count(*)::int from public.audit_logs where action = 'role.grant'),
  1,
  'deleting the actor preserved the audit entry, with a null actor_id'
);


select * from finish();
rollback;
