-- Row Level Security behaviour tests.
--
-- Run these against a freshly migrated database with NO seed data: some cases
-- count rows overall, so seeded connections or conversations would make the
-- expected values meaningless. `supabase/seed.sql` is for development data and
-- is verified separately.
--
-- These run against a PostgreSQL database with the Converge migrations
-- applied (see scripts/apply_migrations.sh with SHIM=1). They impersonate real
-- members and assert that the policies, not the application, decide what is
-- visible. Every check raises on failure, so a non-zero exit means a policy
-- regression.
--
--   docker exec -i converge-pg psql -U postgres -v ON_ERROR_STOP=1 \
--     -f - < supabase/tests/rls_test.sql

\set ON_ERROR_STOP on
set client_min_messages to warning;

-- Fixed ids so the assertions are readable.
\set amara   '''11111111-1111-4111-8111-111111111111'''
\set diego   '''22222222-2222-4222-8222-222222222222'''
\set priya   '''33333333-3333-4333-8333-333333333333'''
\set quiet   '''44444444-4444-4444-8444-444444444444'''

-- ---- fixtures (written as the service role, bypassing RLS) --------------

-- Make the file re-runnable: drop any previous fixtures before creating them.
delete from auth.users where id in (:amara, :diego, :priya, :quiet);

insert into auth.users (id, email, raw_user_meta_data) values
  (:amara, 'amara@converge.test', '{"display_name":"Amara"}'),
  (:diego, 'diego@converge.test', '{"display_name":"Diego"}'),
  (:priya, 'priya@converge.test', '{"display_name":"Priya"}'),
  (:quiet, 'quiet@converge.test', '{"display_name":"Quiet"}')
on conflict (id) do nothing;

-- The signup trigger must have created a profile for each of these members.
--
-- Assertions live in `pg_temp` functions rather than `do $$ ... $$` blocks: psql
-- does not interpolate `:variables` inside a dollar-quoted body, so the member
-- ids have to arrive as arguments.
create or replace function pg_temp.assert_fixtures_ready(
  amara uuid, diego uuid, priya uuid, quiet uuid
) returns void language plpgsql as $$
begin
  if (
    select count(*) from public.profiles
    where id in (amara, diego, priya, quiet)
  ) <> 4 then
    raise exception 'handle_new_user did not create a profile per member';
  end if;

  -- Several cases below count rows overall rather than per member, so a
  -- database that already carries connections or conversations would make them
  -- meaningless. Failing here is clearer than a confusing count mismatch.
  if exists (select 1 from public.connections)
     or exists (select 1 from public.conversations) then
    raise exception using
      message = 'rls_test requires a freshly migrated database without seed data',
      hint = 'Drop the schema, apply supabase/migrations, then run this file.';
  end if;
  raise notice 'ok   the signup trigger created a profile per member';
end;
$$;

select pg_temp.assert_fixtures_ready(:amara, :diego, :priya, :quiet);

update public.profiles
set visibility = 'discoverable', latitude = 53.45, longitude = -2.25, area_label = 'Manchester'
where id = :amara;

update public.profiles set visibility = 'discoverable' where id = :diego;

-- A member who has chosen not to be discovered.
update public.profiles
set visibility = 'private', share_approximate_location = false
where id = :quiet;

insert into public.communities (id, name, slug, description, purpose, join_code, is_private, created_by)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Northern Makers', 'northern-makers',
   'A community for people who build things in the north.', 'Share skills and run workshops.',
   'MAKERS01', false, :amara),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Quiet Reading', 'quiet-reading',
   'A private reading circle.', 'Read and discuss.', 'READING1', true, :priya)
on conflict (id) do nothing;

insert into public.community_members (community_id, profile_id, state, role, joined_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', :amara, 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', :diego, 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', :priya, 'member', 'owner', now())
on conflict do nothing;

-- ---- helpers ------------------------------------------------------------

-- Impersonate a member for the rest of the session. The setting is session
-- scoped (not transaction scoped) so it survives across psql statements, which
-- is what lets one script act as several members in turn.
create or replace function pg_temp.act_as(member uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(member::text, ''), false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

create or replace function pg_temp.assert_eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok   %', label;
end;
$$;

set role authenticated;

-- ---- visibility of profiles --------------------------------------------

select pg_temp.act_as(:diego);
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :amara), 1::bigint,
  'a discoverable profile is readable by another member');
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :quiet), 0::bigint,
  'a private profile is not readable by a stranger');
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :diego), 1::bigint,
  'a member can always read their own profile');

select pg_temp.act_as(:quiet);
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :quiet), 1::bigint,
  'a private member can read their own profile');

-- ---- writing is limited to your own rows -------------------------------

select pg_temp.act_as(:diego);
do $$
begin
  begin
    update public.profiles set display_name = 'Not Diego' where id = '11111111-1111-4111-8111-111111111111';
    if found then
      raise exception 'FAIL: a member edited another profile';
    end if;
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'ok   a member cannot edit another profile';
end;
$$;

-- A member cannot forge a profile row for someone else.
do $$
begin
  begin
    insert into public.profiles (id, display_name) values
      ('55555555-5555-4555-8555-555555555555', 'Forged');
    raise exception 'FAIL: a member inserted a profile they do not own';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   a member cannot insert a profile they do not own';
  end;
end;
$$;

-- ---- private communities are invisible ---------------------------------

select pg_temp.act_as(:diego);
select pg_temp.assert_eq(
  (select count(*) from public.communities where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  0::bigint,
  'a private community is not visible to a non-member');

select pg_temp.act_as(:priya);
select pg_temp.assert_eq(
  (select count(*) from public.communities where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  1::bigint,
  'a private community is visible to its member');

-- ---- the join code is not readable, but is resolvable -------------------

-- The `join_code` column is not granted to authenticated at all.
select pg_temp.act_as(:diego);
do $$
begin
  begin
    perform join_code from public.communities
    where id = 'aaaaaaaa-0000-4000-8000-000000000001';
    raise exception 'FAIL: a join code column was readable';
  exception when insufficient_privilege then
    raise notice 'ok   the join code column is not readable';
  end;
end;
$$;

select pg_temp.assert_eq(
  (select id from public.community_by_join_code('makers01')),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'a join code resolves through the function');

-- Only a member may read a community's code back.
select pg_temp.assert_eq(
  (select public.community_join_code('aaaaaaaa-0000-4000-8000-000000000001'::uuid)),
  'MAKERS01', 'a member can read their community''s join code');

select pg_temp.assert_eq(
  (select public.community_join_code('aaaaaaaa-0000-4000-8000-000000000002'::uuid)),
  null::text, 'a non-member cannot read a join code');

select pg_temp.assert_eq(
  (select count(*) from public.community_join_codes()), 1::bigint,
  'the batched code list only covers communities the member belongs to');

-- ---- membership rows are not enumerable --------------------------------

select pg_temp.act_as(:priya);
select pg_temp.assert_eq(
  (select count(*) from public.community_members
   where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0::bigint,
  'a non-member cannot enumerate another community''s membership');

select pg_temp.act_as(:amara);
select pg_temp.assert_eq(
  (select count(*) from public.community_members
   where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2::bigint,
  'an owner can see their community''s membership');

-- ---- connection requests and mutual consent ----------------------------

select pg_temp.act_as(:amara);
insert into public.connection_requests (id, from_user, to_user, reason)
values ('bbbbbbbb-0000-4000-8000-000000000001', :amara, :diego, 'Both in Northern Makers.');

-- A member cannot send a request as somebody else.
do $$
begin
  begin
    insert into public.connection_requests (from_user, to_user)
    values ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: a member forged a connection request';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   a member cannot forge a connection request';
  end;
end;
$$;

-- The recipient cannot see a request addressed to someone else.
select pg_temp.act_as(:priya);
select pg_temp.assert_eq(
  (select count(*) from public.connection_requests), 0::bigint,
  'a request is invisible to an uninvolved member');

-- Only the recipient can accept. Amara (the sender) must be refused.
select pg_temp.act_as(:amara);
do $$
begin
  begin
    perform public.respond_to_connection_request(
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid, true);
    raise exception 'FAIL: the sender accepted their own request';
  exception when insufficient_privilege then
    raise notice 'ok   the sender cannot accept their own request';
  end;
end;
$$;

-- Before acceptance there is no connection, so messaging is refused.
select pg_temp.assert_eq(
  (select count(*) from public.connections), 0::bigint,
  'no connection exists before acceptance');

do $$
begin
  begin
    perform public.open_direct_conversation('22222222-2222-4222-8222-222222222222'::uuid);
    raise exception 'FAIL: a conversation opened without a connection';
  exception when insufficient_privilege then
    raise notice 'ok   messaging is refused before mutual acceptance';
  end;
end;
$$;

-- The recipient accepts: this creates the connection in one transaction.
select pg_temp.act_as(:diego);
select pg_temp.assert_eq(
  (select status::text from public.respond_to_connection_request(
     'bbbbbbbb-0000-4000-8000-000000000001'::uuid, true)),
  'accepted', 'the recipient can accept a request');

select pg_temp.assert_eq(
  (select count(*) from public.connections), 1::bigint,
  'accepting created exactly one connection');

-- A client cannot insert into `connections` directly.
do $$
begin
  begin
    insert into public.connections (user_a, user_b)
    values ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: a member inserted a connection directly';
  exception when insufficient_privilege then
    raise notice 'ok   a connection cannot be inserted directly';
  end;
end;
$$;

-- ---- messaging now works, and only between the two ---------------------

select pg_temp.act_as(:amara);
select pg_temp.assert_eq(
  (select kind::text from public.open_direct_conversation('22222222-2222-4222-8222-222222222222'::uuid)),
  'direct', 'a connected member can open a direct conversation');

insert into public.messages (id, conversation_id, sender_id, body)
values ('cccccccc-0000-4000-8000-000000000001',
        (select id from public.conversations limit 1), :amara, 'Hello Diego');

select pg_temp.assert_eq(
  (select count(*) from public.messages), 1::bigint,
  'the sender can read back their message');

-- Priya is not a member of that conversation and must see nothing.
select pg_temp.act_as(:priya);
select pg_temp.assert_eq(
  (select count(*) from public.messages), 0::bigint,
  'a non-member cannot read a conversation');
select pg_temp.assert_eq(
  (select count(*) from public.conversations), 0::bigint,
  'a non-member cannot see a conversation');

-- And cannot post into it.
do $$
begin
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations limit 1),
            '33333333-3333-4333-8333-333333333333', 'Intruding');
    raise exception 'FAIL: a non-member posted into a conversation';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   a non-member cannot post into a conversation';
  end;
end;
$$;

-- ---- blocking -----------------------------------------------------------

select pg_temp.act_as(:priya);
insert into public.blocked_users (blocker_id, blocked_id) values (:priya, :diego);

select pg_temp.assert_eq(
  (select public.are_blocked(:priya, :diego)), true,
  'a block is detected in the blocking direction');
select pg_temp.assert_eq(
  (select public.are_blocked(:diego, :priya)), true,
  'a block is detected in both directions');

-- Priya blocked Diego, so Diego must no longer see Priya (and Priya always
-- sees herself).
select pg_temp.act_as(:diego);
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :priya), 0::bigint,
  'a blocked member no longer sees the blocker');
select pg_temp.act_as(:priya);
select pg_temp.assert_eq(
  (select count(*) from public.profiles where id = :priya), 1::bigint,
  'the blocker still sees their own profile');

-- A block prevents a request even if the pair is otherwise eligible.
select pg_temp.act_as(:diego);
do $$
begin
  begin
    insert into public.connection_requests (from_user, to_user)
    values ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: a request was sent past a block';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   a block prevents a new connection request';
  end;
end;
$$;

-- ---- reports are private to the reporter -------------------------------

select pg_temp.act_as(:diego);
insert into public.reports (reporter_id, subject_user_id, reason, detail)
values (:diego, :priya, 'harassment', 'Sent repeated unwanted messages.');
select pg_temp.assert_eq(
  (select count(*) from public.reports), 1::bigint,
  'a member can read back their own report');

select pg_temp.act_as(:amara);
select pg_temp.assert_eq(
  (select count(*) from public.reports), 0::bigint,
  'a report is invisible to another member');

-- ---- notifications -----------------------------------------------------

-- The trigger created a notification for Diego when the request arrived.
select pg_temp.act_as(:diego);
select pg_temp.assert_eq(
  (select count(*) from public.notifications where profile_id = :diego and kind = 'connection-request'),
  1::bigint, 'the request created a notification for the recipient');

select pg_temp.act_as(:amara);
select pg_temp.assert_eq(
  (select count(*) from public.notifications where profile_id = :diego), 0::bigint,
  'a member cannot read another member''s notifications');

-- A member cannot forge a notification for somebody else.
do $$
begin
  begin
    insert into public.notifications (profile_id, kind, title, body)
    values ('22222222-2222-4222-8222-222222222222', 'message', 'Forged', 'Forged');
    raise exception 'FAIL: a member forged a notification';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   a member cannot forge a notification';
  end;
end;
$$;

-- ---- geographic grid is enforced --------------------------------------

reset role;

do $$
begin
  begin
    update public.profiles set latitude = 53.456789, longitude = -2.251234
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: an exact coordinate was stored';
  exception when check_violation then
    raise notice 'ok   an off-grid coordinate is rejected';
  end;
end;
$$;

do $$
begin
  begin
    insert into public.events (community_id, title, description, starts_at, ends_at,
                               venue_name, is_public_venue)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'Private meet', 'Not allowed here.',
            now(), now() + interval '1 hour', 'Somewhere', false);
    raise exception 'FAIL: a non-public venue was accepted';
  exception when check_violation then
    raise notice 'ok   a non-public venue is rejected';
  end;
end;
$$;

-- ---- an unauthenticated request sees nothing ---------------------------

reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);

do $$
begin
  if (select public.can_see_profile('11111111-1111-4111-8111-111111111111')) then
    raise exception 'FAIL: an unauthenticated request could see a profile';
  end if;
  raise notice 'ok   an unauthenticated request sees no profile';
end;
$$;

select 'RLS TESTS PASSED' as result;
