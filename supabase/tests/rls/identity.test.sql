-- RLS policy tests for the identity tables.
--
-- Run with `npm run test:rls` (which is `supabase test db`). Each file executes in
-- a transaction that is rolled back afterwards, so fixtures do not leak between
-- files.
--
-- How to read these:
--
--   * A blocked SELECT, UPDATE, or DELETE is *silent*. RLS filters the rows out,
--     so the statement succeeds and affects nothing. Those cases are asserted
--     with is_empty(), or by re-reading the row and showing it unchanged.
--   * A blocked INSERT raises 42501 (insufficient_privilege), because there is no
--     row to filter — the write is refused outright. Same for an UPDATE that
--     violates a WITH CHECK.
--
-- Getting those two shapes the wrong way round produces a test that passes
-- whether or not the policy exists, which is the main hazard in an RLS suite.

begin;
select plan(28);

-- Fixtures are created as the migration superuser, which bypasses RLS. Every
-- assertion below switches to a real role first.
select tests.clear_authentication();

create temporary table actors (name text primary key, id uuid not null);
insert into actors (name, id) values
  ('alice', tests.create_user('alice@test.local')),
  ('bob', tests.create_user('bob@test.local')),
  ('mod', tests.create_user('mod@test.local'));

select tests.grant_role((select id from actors where name = 'mod'), 'moderator');


-- ── RLS is actually switched on ──────────────────────────────────────────────
--
-- Cheap, but it is the failure that every other test in this file silently
-- depends on: a table with policies but without `enable row level security`
-- enforces nothing at all.

select ok(tests.rls_enabled('public', 'profiles'), 'profiles has RLS enabled');
select ok(tests.rls_enabled('public', 'user_roles'), 'user_roles has RLS enabled');
select ok(tests.rls_enabled('public', 'addresses'), 'addresses has RLS enabled');
select ok(tests.rls_enabled('public', 'user_preferences'), 'user_preferences has RLS enabled');
select ok(tests.rls_enabled('public', 'consents'), 'consents has RLS enabled');


-- ── The signup trigger provisioned the account ───────────────────────────────

select is(
  (select count(*)::int from public.profiles p where p.id = (select id from actors where name = 'alice')),
  1,
  'app.handle_new_user created a profile row'
);

select is(
  (select count(*)::int from public.user_preferences up where up.user_id = (select id from actors where name = 'alice')),
  1,
  'app.handle_new_user created a user_preferences row'
);

select is(
  (select count(*)::int
   from public.user_roles ur
   where ur.user_id = (select id from actors where name = 'alice')
     and ur.role = 'consumer'),
  1,
  'app.handle_new_user granted the consumer role'
);


-- ── profiles ─────────────────────────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select isnt_empty(
  $$ select 1 from public.profiles where id = auth.uid() $$,
  'alice can read her own profile'
);

select is_empty(
  format(
    $$ select 1 from public.profiles where id = %L $$,
    (select id from actors where name = 'bob')
  ),
  'alice cannot read bob''s profile'
);

-- The strongest form of the assertion: not just "bob's row is hidden" but "no row
-- other than her own is visible", which also covers the moderator's row.
select is(
  (select count(*)::int from public.profiles),
  1,
  'alice sees exactly one profile — her own'
);

select tests.authenticate_as_anon();

select is_empty(
  $$ select 1 from public.profiles $$,
  'an anonymous visitor cannot read any profile'
);


-- ── user_roles ───────────────────────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select isnt_empty(
  $$ select 1 from public.user_roles where user_id = auth.uid() $$,
  'alice can read her own role grants'
);

select is_empty(
  format(
    $$ select 1 from public.user_roles where user_id = %L $$,
    (select id from actors where name = 'mod')
  ),
  'alice cannot read another user''s role grants'
);

-- The privilege-escalation attempt this table exists to refuse. There is no write
-- policy on user_roles at all, so the insert is rejected rather than filtered.
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') $$,
  '42501'::text,
  null,
  'alice cannot grant herself the admin role'
);


-- ── addresses ────────────────────────────────────────────────────────────────

select lives_ok(
  $$ insert into public.addresses (user_id, line1, city, country)
     values (auth.uid(), '1 Ring Road', 'Accra', 'GH') $$,
  'alice can create an address for herself'
);

-- Exercises the WITH CHECK clause specifically: without it, USING alone would
-- permit writing a row owned by someone else.
select throws_ok(
  format(
    $$ insert into public.addresses (user_id, line1, city, country)
       values (%L, '2 Broad Street', 'Lagos', 'NG') $$,
    (select id from actors where name = 'bob')
  ),
  '42501'::text,
  null,
  'alice cannot create an address owned by bob'
);

select tests.clear_authentication();
insert into public.addresses (user_id, line1, city, country)
values ((select id from actors where name = 'bob'), '2 Broad Street', 'Lagos', 'NG');

select tests.authenticate_as((select id from actors where name = 'alice'));

select is_empty(
  $$ select 1 from public.addresses where city = 'Lagos' $$,
  'alice cannot read bob''s address'
);

-- A blocked UPDATE is silent, so the proof is that the stored value survived.
update public.addresses set city = 'Tampered' where city = 'Lagos';

select tests.clear_authentication();
select is(
  (select a.city from public.addresses a where a.user_id = (select id from actors where name = 'bob')),
  'Lagos',
  'alice''s attempt to update bob''s address changed nothing'
);


-- ── user_preferences ─────────────────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select isnt_empty(
  $$ select 1 from public.user_preferences where user_id = auth.uid() $$,
  'alice can read her own preferences'
);

select is_empty(
  format(
    $$ select 1 from public.user_preferences where user_id = %L $$,
    (select id from actors where name = 'bob')
  ),
  'alice cannot read bob''s preferences'
);


-- ── consents ─────────────────────────────────────────────────────────────────

select lives_ok(
  $$ insert into public.consents (user_id, kind, version, granted)
     values (auth.uid(), 'terms', '2026-01-01', true) $$,
  'alice can record her own consent'
);

select throws_ok(
  format(
    $$ insert into public.consents (user_id, kind, version, granted)
       values (%L, 'terms', '2026-01-01', true) $$,
    (select id from actors where name = 'bob')
  ),
  '42501'::text,
  null,
  'alice cannot record consent on bob''s behalf'
);

select tests.clear_authentication();
insert into public.consents (user_id, kind, version, granted)
values ((select id from actors where name = 'bob'), 'privacy', '2026-01-01', true);

select tests.authenticate_as((select id from actors where name = 'alice'));

select is_empty(
  $$ select 1 from public.consents where kind = 'privacy' $$,
  'alice cannot read bob''s consent history'
);

-- Append-only: withdrawal is a new row with granted = false, never a delete.
delete from public.consents where user_id = auth.uid();

select is(
  (select count(*)::int from public.consents where user_id = auth.uid()),
  1,
  'alice cannot delete her consent history — the log is append-only'
);


-- ── app.has_role() reached from another table's policy ───────────────────────
--
-- The load-bearing assumption behind the whole role design. `profiles`' read
-- policy calls app.is_moderator_or_admin(), which reads `user_roles` — a table
-- whose own policy exposes only the caller's rows. It works because the helper is
-- `security definer` and so evaluates outside RLS. If that ever stopped holding,
-- every staff-scoped policy in the schema would silently start denying.

select tests.authenticate_as((select id from actors where name = 'mod'));

select isnt_empty(
  format(
    $$ select 1 from public.profiles where id = %L $$,
    (select id from actors where name = 'alice')
  ),
  'a moderator can read another user''s profile via app.is_moderator_or_admin()'
);


-- ── Cascade from auth.users ──────────────────────────────────────────────────
--
-- What step 3's account-deletion flow relies on: one delete, no orphans.

select tests.clear_authentication();
delete from auth.users where id = (select id from actors where name = 'alice');

select is(
  (select count(*)::int from public.profiles p where p.id = (select id from actors where name = 'alice')),
  0,
  'deleting the auth user removed their profile'
);

select is(
  (select count(*)::int from public.addresses a where a.user_id = (select id from actors where name = 'alice')),
  0,
  'deleting the auth user removed their addresses'
);


select * from finish();
rollback;
