-- Policy tests.
--
-- These assert the behaviour of the rules that protect members, rather than the
-- existence of the tables. Every assertion raises an exception when it fails, so
-- the script exits non-zero and cannot be mistaken for a pass.
--
-- Covered here:
--   * photo visibility, across all four levels and the block rule
--   * storage read policy for the private avatars bucket
--   * nearby discovery: opt-in, discoverability, radius and blocking
--   * place search for global discovery
--
-- Run with `supabase/tests/run_policy_tests.sh`.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures.
-- ---------------------------------------------------------------------------

-- Fixed ids so the assertions below read plainly.
create temporary table t_ids (name text primary key, id uuid);

insert into t_ids (name, id) values
  ('viewer',            '00000000-0000-0000-0000-000000000001'),
  ('public',            '00000000-0000-0000-0000-000000000002'),
  ('community',         '00000000-0000-0000-0000-000000000003'),
  ('connections',       '00000000-0000-0000-0000-000000000004'),
  ('private',           '00000000-0000-0000-0000-000000000005'),
  ('blocked',           '00000000-0000-0000-0000-000000000006'),
  ('not_opted_in',      '00000000-0000-0000-0000-000000000007'),
  ('not_discoverable',  '00000000-0000-0000-0000-000000000008'),
  ('far_away',          '00000000-0000-0000-0000-000000000009'),
  ('community_owner',   '00000000-0000-0000-0000-00000000000a');

insert into auth.users (id, email)
  select id, name || '@test.local' from t_ids;

-- Creating an auth user fires `handle_new_user`, which inserts the profile
-- row, so the fixtures below update those rows rather than inserting them.
update public.profiles p
set
  display_name = initcap(replace(t.name, '_', ' ')),
  visibility = case
    when t.name in ('private', 'not_discoverable') then 'community'::public.visibility_level
    else 'discoverable'::public.visibility_level
  end,
  share_approximate_location = t.name not in ('private'),
  nearby_discovery_enabled = t.name in ('public', 'community', 'connections', 'blocked'),
  photo_visibility = case
    when t.name = 'public' then 'public'::public.photo_visibility
    when t.name = 'community' then 'community'::public.photo_visibility
    when t.name = 'connections' then 'connections'::public.photo_visibility
    when t.name = 'private' then 'private'::public.photo_visibility
    else 'public'::public.photo_visibility
  end,
  latitude = case when t.name = 'far_away' then 40.00 else 0.00 end,
  longitude = 0.00,
  area_label = case when t.name = 'far_away' then 'Elsewhere' else 'Central' end,
  city = case when t.name = 'far_away' then 'Elsewhere' else 'Central' end,
  country_code = case when t.name = 'far_away' then 'FR' else 'GB' end
from t_ids t
where p.id = t.id;

-- A shared community between the viewer and the `community` member, which is
-- what the `community` photo level keys on.
insert into public.communities (id, name, slug, description, purpose, created_by)
values (
  '00000000-0000-0000-0000-0000000000c1', 'Test Community', 'test-community',
  'A community used by the policy tests.', 'Exercising row level security.',
  (select id from t_ids where name = 'viewer')
);

insert into public.community_members (community_id, profile_id, state, joined_at)
values
  ('00000000-0000-0000-0000-0000000000c1', (select id from t_ids where name = 'viewer'), 'member', now()),
  ('00000000-0000-0000-0000-0000000000c1', (select id from t_ids where name = 'community'), 'member', now());

-- An accepted connection between the viewer and the `connections` member.
insert into public.connections (user_a, user_b)
values (
  least((select id from t_ids where name = 'viewer'), (select id from t_ids where name = 'connections')),
  greatest((select id from t_ids where name = 'viewer'), (select id from t_ids where name = 'connections'))
);

-- The `blocked` member has blocked the viewer.
insert into public.blocked_users (blocker_id, blocked_id)
values (
  (select id from t_ids where name = 'blocked'),
  (select id from t_ids where name = 'viewer')
);

-- Objects in the private bucket, one folder per member.
insert into storage.objects (bucket_id, name, owner)
select 'avatars', t.id::text || '/avatar.jpg', t.id from t_ids t;

-- ---------------------------------------------------------------------------
-- Assertions.
-- ---------------------------------------------------------------------------
do $$
declare
  viewer uuid := '00000000-0000-0000-0000-000000000001';
  id_public uuid := '00000000-0000-0000-0000-000000000002';
  id_community uuid := '00000000-0000-0000-0000-000000000003';
  id_connections uuid := '00000000-0000-0000-0000-000000000004';
  id_private uuid := '00000000-0000-0000-0000-000000000005';
  id_blocked uuid := '00000000-0000-0000-0000-000000000006';
  result boolean;
  failures text[] := '{}';
begin
  -- A member may always see their own photo.
  if not public.can_view_photo(viewer, viewer) then
    failures := failures || 'own photo should be visible';
  end if;

  if not public.can_view_photo(viewer, id_public) then
    failures := failures || 'public photo should be visible to any member';
  end if;

  if not public.can_view_photo(viewer, id_community) then
    failures := failures || 'community photo should be visible to a fellow member';
  end if;

  if not public.can_view_photo(viewer, id_connections) then
    failures := failures || 'connections photo should be visible to a connection';
  end if;

  if public.can_view_photo(viewer, id_private) then
    failures := failures || 'private photo must not be visible to another member';
  end if;

  -- Blocking overrides every level, including public.
  if public.can_view_photo(viewer, id_blocked) then
    failures := failures || 'a blocked member''s photo must not be visible';
  end if;

  -- A member with no shared community, no connection and no photo does not leak.
  result := public.can_view_photo(
    '00000000-0000-0000-0000-00000000000b'::uuid, id_community
  );
  if result then
    failures := failures || 'an unrelated member must not see a community photo';
  end if;

  if array_length(failures, 1) is not null then
    raise exception 'photo visibility: %', array_to_string(failures, '; ');
  end if;
end $$;

-- Nearby discovery: only opted-in, discoverable, unblocked members within range.
do $$
declare
  viewer uuid := '00000000-0000-0000-0000-000000000001';
  ids uuid[];
begin
  select array_agg(id order by id) into ids
  from public.nearby_profiles(viewer, 0, 0, 25, 50);

  if ids is null then
    raise exception 'nearby discovery: expected results, got none';
  end if;

  if '00000000-0000-0000-0000-000000000007' = any(ids) then
    raise exception 'nearby discovery: returned a member who has not opted in';
  end if;

  if '00000000-0000-0000-0000-000000000008' = any(ids) then
    raise exception 'nearby discovery: returned a member who is not discoverable';
  end if;

  if '00000000-0000-0000-0000-000000000006' = any(ids) then
    raise exception 'nearby discovery: returned a member who blocked the viewer';
  end if;

  if '00000000-0000-0000-0000-000000000009' = any(ids) then
    raise exception 'nearby discovery: returned a member outside the radius';
  end if;

  if not ('00000000-0000-0000-0000-000000000002' = any(ids)) then
    raise exception 'nearby discovery: did not return an eligible nearby member';
  end if;

  -- The viewer must never appear in their own nearby results.
  if viewer = any(ids) then
    raise exception 'nearby discovery: returned the viewer';
  end if;
end $$;

-- The radius argument is honoured.
do $$
declare
  viewer uuid := '00000000-0000-0000-0000-000000000001';
  count_near int;
  count_wide int;
begin
  select count(*) into count_near from public.nearby_profiles(viewer, 0, 0, 1, 50);
  select count(*) into count_wide from public.nearby_profiles(viewer, 40, 0, 5, 50);

  if count_near = 0 then
    raise exception 'radius: a 1 km query returned nothing from the origin';
  end if;

  -- A query centred on the far member must not return the origin members.
  if count_wide > 0 and count_near = count_wide then
    raise exception 'radius: a query 40 degrees away returned the origin set';
  end if;
end $$;

-- Place search returns members who recorded that place, and never the viewer.
do $$
declare
  viewer uuid := '00000000-0000-0000-0000-000000000001';
  ids uuid[];
begin
  select array_agg(id) into ids from public.profiles_in_place(viewer, 'Elsewhere', 'FR', 50);

  if ids is null or not ('00000000-0000-0000-0000-000000000009' = any(ids)) then
    raise exception 'place search: did not find the member in Elsewhere, FR';
  end if;

  if viewer = any(ids) then
    raise exception 'place search: returned the viewer';
  end if;

  select array_agg(id) into ids from public.profiles_in_place(viewer, null, 'GB', 50);
  if ids is not null and '00000000-0000-0000-0000-000000000009' = any(ids) then
    raise exception 'place search: country filter was ignored';
  end if;
end $$;

-- Storage read policy, evaluated as the `authenticated` role so the policy is
-- actually exercised rather than bypassed by the superuser.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
declare
  visible int;
  other_visible int;
begin
  -- The viewer may read their own object, and the public-photo member's.
  select count(*) into visible from storage.objects
  where bucket_id = 'avatars'
    and name in (
      '00000000-0000-0000-0000-000000000001/avatar.jpg',
      '00000000-0000-0000-0000-000000000002/avatar.jpg'
    );

  if visible <> 2 then
    raise exception 'storage: expected 2 readable objects, saw %', visible;
  end if;

  -- The private-photo member's object must not be readable.
  select count(*) into other_visible from storage.objects
  where bucket_id = 'avatars'
    and name = '00000000-0000-0000-0000-000000000005/avatar.jpg';

  if other_visible <> 0 then
    raise exception 'storage: a private photo was readable';
  end if;

  -- The blocked member's object must not be readable either.
  select count(*) into other_visible from storage.objects
  where bucket_id = 'avatars'
    and name = '00000000-0000-0000-0000-000000000006/avatar.jpg';

  if other_visible <> 0 then
    raise exception 'storage: a blocked member''s photo was readable';
  end if;
end $$;

reset role;

rollback;

select 'policy tests passed' as result;
