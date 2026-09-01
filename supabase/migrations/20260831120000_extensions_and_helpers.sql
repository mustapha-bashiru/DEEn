-- Extensions, the internal `app` schema, and the primitives every later
-- migration builds on.
--
-- Nothing user-facing lives here. The three things worth understanding before
-- reading any other migration:
--
--   1. `app.has_role()` is how every policy asks "is the caller an admin?".
--      Roles are read from a table, not from JWT claims, because a role baked
--      into a JWT does not take effect until the user signs in again — an admin
--      grant (or, worse, a revoke) would sit inert until then.
--
--   2. Every `security definer` function pins `set search_path = ''` and
--      schema-qualifies every reference. Without that pin, a caller who controls
--      `search_path` can create a table that shadows one named inside the
--      function body and have it read under the function owner's privileges.
--      This is a privilege-escalation vector, not a style preference.
--
--   3. Tables live in `public` because that is the schema PostgREST exposes.
--      Helpers live in `app`, which is deliberately NOT exposed, so they can
--      never be called as RPC from a browser.

-- No extensions are created here. `gen_random_uuid()` is built into Postgres 13+,
-- so pgcrypto is not needed for key generation, and there is no citext column
-- because email deliberately lives only in `auth.users` (see the identity
-- migration). Adding an extension that nothing uses is surface for no benefit.

create schema if not exists app;

-- Policies are evaluated as the *calling* role, so anon and authenticated both
-- need to traverse `app` to reach the helpers below. Traversal only: no table in
-- this schema is reachable without a further grant, and none is granted.
grant usage on schema app to anon, authenticated, service_role;


-- ── Platform roles ───────────────────────────────────────────────────────────
--
-- These are platform-wide. Organization-scoped roles (owner, operator, courier)
-- are a property of a membership rather than of a person — the same user can be
-- an operator of one restaurant and a courier for another — so they arrive in
-- step 5 as `organization_members.role` and deliberately do not belong here.

create type app.app_role as enum ('consumer', 'moderator', 'admin');


-- ── Market configuration ─────────────────────────────────────────────────────
--
-- Country and currency are domains rather than bare text so that a malformed
-- pair is rejected at write time by every table that stores one. Launch markets
-- are Ghana and Nigeria; the schema is extensible by inserting a row.

create domain public.country_code as char(2) check (value ~ '^[A-Z]{2}$');
create domain public.currency_code as char(3) check (value ~ '^[A-Z]{3}$');

create table public.supported_markets (
  country     public.country_code primary key,
  currency    public.currency_code not null,
  -- Deactivating a market must hide it from new checkouts without invalidating
  -- historical rows that reference it, so this is a flag rather than a delete.
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.supported_markets is
  'Country/currency pairs the platform accepts. Referenced by addresses and, from step 8, by every money table.';

-- Seeded here rather than in seed.sql: this is configuration the application
-- depends on to function, not local test data.
insert into public.supported_markets (country, currency) values
  ('GH', 'GHS'),
  ('NG', 'NGN');


-- ── Helper functions ─────────────────────────────────────────────────────────

-- `stable` (not `volatile`) lets the planner call this once per statement rather
-- than once per row, which matters because it appears in policies on hot tables.
create or replace function app.has_role(target_role app.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = target_role
  );
$$;

comment on function app.has_role(app.app_role) is
  'True when the current user holds the role. security definer so that policies on other tables can consult user_roles without needing their own read policy on it — and so a policy on user_roles itself must never call this (see the identity migration).';

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role('admin');
$$;

create or replace function app.is_moderator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role('moderator') or app.has_role('admin');
$$;

-- Applied by trigger rather than trusted from the client: a caller that can
-- write a row can otherwise set `updated_at` to anything, which makes the column
-- useless for sync and for audit reconstruction.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ── supported_markets access ─────────────────────────────────────────────────
--
-- Readable by everyone including anonymous visitors, because a public QR menu
-- has to render a currency before anyone signs in. Writable only by the service
-- role: there is no policy granting insert, update, or delete to `authenticated`,
-- and RLS denies anything no policy permits.

alter table public.supported_markets enable row level security;

create policy supported_markets_public_read
  on public.supported_markets
  for select
  to anon, authenticated
  using (true);

create trigger supported_markets_set_updated_at
  before update on public.supported_markets
  for each row execute function app.set_updated_at();
