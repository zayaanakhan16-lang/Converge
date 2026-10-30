#!/usr/bin/env bash
# Apply every migration to a throwaway PostgreSQL database and fail on the first
# error.
#
# Supabase runs the migrations in `supabase/migrations` in filename order. This
# script reproduces that on a plain PostgreSQL instance so the SQL can be checked
# without a Supabase project. It first creates the small amount of Supabase
# surface the migrations rely on: the `auth` and `storage` schemas, the
# `authenticated`/`anon`/`service_role` roles, and `auth.uid()`.
#
# Usage: supabase/tests/run_migrations.sh [database-name]
# Requires: a running PostgreSQL server with PostGIS, and rights to create roles.
set -u

DB="${1:-converge_migration_check}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

# Use the postgres superuser when the current role cannot reach the server
# directly, which is the normal case in a container where only `postgres` has a
# local role.
if ! "${PSQL[@]}" -d postgres -c 'select 1' >/dev/null 2>&1; then
  PSQL=(sudo -n -u postgres "${PSQL[@]}")
fi

echo "== recreating $DB"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB;" -c "create database $DB;" || exit 1

echo "== Supabase scaffold"
"${PSQL[@]}" -d "$DB" <<'SQL' || exit 1
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- Supabase grants the client roles access to these schemas. Without this the
-- storage policies cannot be evaluated as `authenticated`, which is exactly how
-- the tests below exercise them.
grant usage on schema auth, storage to authenticated, anon, service_role;
grant select on storage.objects to authenticated;
grant usage on schema public to authenticated, anon, service_role;
SQL

# Stage the files where the database role can read them: the workspace is not
# always readable by the `postgres` user.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$ROOT"/supabase/migrations/*.sql "$STAGE"/
chmod -R a+rX "$STAGE"

echo "== migrations"
for file in "$STAGE"/*.sql; do
  name="$(basename "$file")"
  if out=$("${PSQL[@]}" -d "$DB" -f "$file" 2>&1); then
    echo "  ok   $name"
  else
    echo "  FAIL $name"
    echo "$out" | head -12
    exit 1
  fi
done

echo "== all migrations applied to $DB"
