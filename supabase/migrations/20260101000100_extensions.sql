-- Converge: extensions and shared types.
--
-- PostGIS is used for the coarse geographic grid: profiles and communities
-- store a snapped point, never a live device coordinate. `pgcrypto` provides
-- gen_random_uuid() and `pg_trgm` speeds up community search.

create extension if not exists "postgis";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Coarse visibility for a profile.
create type public.visibility_level as enum ('community', 'discoverable', 'private');

-- Membership lifecycle for a community.
create type public.membership_state as enum ('requested', 'invited', 'member');
create type public.membership_role as enum ('member', 'organiser', 'owner');

-- Connection lifecycle.
create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled');

-- How a member relates to a skill.
create type public.skill_intent as enum ('offer', 'learn');

create type public.conversation_kind as enum ('direct', 'group');

create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type public.report_reason as enum (
  'harassment',
  'spam',
  'impersonation',
  'inappropriate-content',
  'safety-concern',
  'other'
);
