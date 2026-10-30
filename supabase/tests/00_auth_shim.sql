-- Local-only shim for Supabase's `auth` schema.
--
-- Supabase provides `auth.users`, `auth.uid()` and `auth.role()` in every
-- project. A plain PostgreSQL instance (used to validate the migrations in CI
-- or locally) does not. This file creates the minimum needed to apply the
-- migrations and exercise the policies. It is NEVER applied to a real Supabase
-- project: the migration runner only includes it when SHIM=1.

create schema if not exists auth;

-- Column set matches the parts of Supabase's `auth.users` that Converge reads
-- or writes: the signup trigger uses id and raw_user_meta_data, and seed.sql
-- writes encrypted_password so a seeded account can sign in locally.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;

-- The current request's user id. Supabase reads it from the JWT; here it is read
-- from a session variable so tests can impersonate a member.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

-- Supabase grants these roles to the API. Policies target `authenticated`, so
-- the role must exist for `create policy ... to authenticated` to resolve.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;
