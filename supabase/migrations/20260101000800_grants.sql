-- Table privileges.
--
-- Row Level Security decides which rows a member may touch; these grants decide
-- which tables they may touch at all. Supabase sets equivalent defaults when a
-- project is created, but stating them here keeps the migrations portable to a
-- plain PostgreSQL instance used for policy testing. `service_role` bypasses RLS
-- and is used by the backend for moderation and translation writes.

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Reference vocabulary is read-only for the app: only the service role may
-- change it, so a member cannot invent an interest id the engine does not know.
revoke insert, update, delete on public.interests from authenticated;
revoke insert, update, delete on public.skills from authenticated;
revoke insert, update, delete on public.languages from authenticated;
revoke insert, update, delete on public.goals from authenticated;
revoke insert, update, delete on public.activities from authenticated;

-- Translations and moderation records are written by the backend, never by the
-- client, so the app is given no write privilege on them.
revoke insert, update, delete on public.message_translations from authenticated;
revoke insert, update, delete on public.reports from authenticated;
grant insert on public.reports to authenticated;

-- A connection row is only ever created by `respond_to_connection_request`.
revoke insert on public.connections from authenticated;

-- A direct conversation is only ever created by `open_direct_conversation`.
revoke insert on public.conversations from authenticated;

-- Notifications are created by triggers only.
revoke insert, delete on public.notifications from authenticated;

-- A join code is only ever read through `community_join_code` /
-- `community_join_codes`, which check membership first. A column-level revoke
-- would not be enough: a table-level SELECT covers every column, so the
-- table-wide grant is replaced with an explicit column list.
revoke select on public.communities from authenticated;
grant select (id, name, slug, description, purpose, membership_requires_approval,
              is_private, member_count, cover_colour, latitude, longitude,
              area_label, created_by, created_at)
  on public.communities to authenticated;

-- Community membership counts and event attendee counts are maintained by
-- triggers, so a member cannot set them directly.
revoke update on public.communities from authenticated;
grant update (name, description, purpose, join_code, membership_requires_approval,
              is_private, cover_colour, latitude, longitude, area_label)
  on public.communities to authenticated;
-- The code is still writable by the app when a community is created, and
-- readable by the backend for moderation.
grant select (join_code) on public.communities to service_role;

revoke update on public.events from authenticated;
grant update (title, description, starts_at, ends_at, venue_name, capacity,
              activity_ids, language_codes, latitude, longitude)
  on public.events to authenticated;

-- Functions used by the client. `open_direct_conversation` and
-- `respond_to_connection_request` run as their definer so they can write the
-- connection row; the caller still has to pass their own checks.
grant execute on function public.open_direct_conversation(uuid) to authenticated;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;
grant execute on function public.community_by_join_code(text) to authenticated;
grant execute on function public.community_join_code(uuid) to authenticated;
grant execute on function public.community_join_codes() to authenticated;
grant execute on function public.is_connected(uuid, uuid) to authenticated;
grant execute on function public.are_blocked(uuid, uuid) to authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;
grant execute on function public.is_community_organiser(uuid) to authenticated;
grant execute on function public.can_see_community(uuid) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- Future tables added by later migrations inherit the same baseline.
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
