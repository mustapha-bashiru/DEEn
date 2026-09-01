-- Local and CI seed. Runs on `supabase db reset`, after every migration.
--
-- ⚠️  This file never reaches production. Deploys apply migrations with
--     `supabase db push`, which does not run seeds. That property is what makes
--     this the right home for the test helpers below: they must exist in local
--     and CI databases and must never exist anywhere else.
--
-- It is also why the helpers are NOT in `supabase/migrations/` and NOT in a
-- `*.test.sql` file. A migration would ship them; a test file would create them
-- inside the per-test transaction that `supabase test db` rolls back, so the
-- second test in a run would not find them.


-- ═══════════════════════════════════════════════════════════════════════════
-- Test helpers
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Enough of the `supabase_test_helpers` surface to test RLS, written out rather
-- than installed from dbdev: it is about sixty lines, it removes a registry
-- dependency and a version pin from CI, and the exact shape of the JWT claims
-- these set is something the policies depend on, so it is worth having in the
-- repository where it can be read.

create schema if not exists tests;

comment on schema tests is
  'Helpers for pgTAP RLS tests. Created by seed.sql, so present only in local and CI databases.';

-- Creates a real auth.users row, because every table in this schema has a foreign
-- key to it — claims alone are not enough to insert a test fixture.
--
-- Side effect worth knowing: this fires app.handle_new_user(), so the new user
-- immediately has a profile, preferences, and the `consumer` role. Tests rely on
-- that, which means they also cover the signup trigger.
create or replace function tests.create_user(user_email text)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    -- Never used: no test authenticates for real, they set claims directly.
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_email,
    'not-a-real-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  return new_id;
end;
$$;

-- Becomes that user for the remainder of the transaction.
--
-- Both settings are required and do different jobs: `role` is what makes Postgres
-- apply the `to authenticated` policies at all, and `request.jwt.claims` is what
-- `auth.uid()` reads to decide which rows those policies admit. Setting only the
-- second leaves the session as a superuser, which bypasses RLS entirely and makes
-- every test pass regardless of the policies.
create or replace function tests.authenticate_as(user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated',
      'email', (select u.email from auth.users u where u.id = user_id)
    )::text,
    true
  );
end;
$$;

-- An unauthenticated visitor: the `anon` role, and claims with no `sub`, so
-- `auth.uid()` returns null.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon', 'aud', 'authenticated')::text,
    true
  );
end;
$$;

-- Back to the migration-running superuser, which bypasses RLS. Needed between
-- assertions whenever a test has to set up a fixture it is about to prove is
-- unreachable.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- Grants a platform role directly. Role grants have no RLS write policy by
-- design, so tests cannot make an admin the way the application would.
create or replace function tests.grant_role(user_id uuid, target_role app.app_role)
returns void
language plpgsql
as $$
begin
  insert into public.user_roles (user_id, role)
  values (user_id, target_role)
  on conflict (user_id, role) do nothing;
end;
$$;

-- `select tests.rls_enabled('public', 'profiles')` — guards against a future
-- migration adding a table and forgetting the `enable row level security` line,
-- which is silent and total.
create or replace function tests.rls_enabled(target_schema text, target_table text)
returns boolean
language sql
stable
as $$
  select coalesce(bool_and(c.relrowsecurity), false)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = target_schema
    and c.relname = target_table;
$$;

-- The `authenticated` and `anon` roles must be able to call these: a test
-- impersonating a user still needs to switch back afterwards.
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- Local fixtures
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nothing yet, deliberately. The app has no authenticated surface until step 3,
-- so a seeded user would be a fixture nothing reads while still being a real row
-- in a real auth table — the kind of thing that gets copied to a shared
-- environment by accident.
--
-- Market configuration (GH/GHS, NG/NGN) is seeded by the extensions migration
-- instead, because the application depends on it to function and so belongs in
-- every database, not just local ones.
--
-- To get a usable account locally: sign up through the app, or create one in
-- Studio at http://localhost:54323. Confirmation mail lands in Inbucket at
-- http://localhost:54324.
