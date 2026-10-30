-- Location discovery: nearby people, place search and nearby communities.
--
-- The privacy model from `20260101000300_profiles.sql` is unchanged and is the
-- reason this migration is short: the database only ever holds a coordinate
-- snapped to a 0.05 degree grid (about 5 km), enforced by a check constraint.
-- A precise device position cannot be exposed by a query here because a precise
-- device position is never stored. What this migration adds is the ability to
-- ask "who is near this point" efficiently, and to do so only for members who
-- have explicitly opted in.
--
-- Two independent opt-ins exist, and they mean different things:
--
--   share_approximate_location  share a coarse area so distance can rank matches
--   nearby_discovery_enabled    appear in the Nearby Network browse list
--
-- A member may want the first without the second: "use my area to rank people
-- for me" is not the same consent as "list me for people around me". Both
-- default to false, and the second is what every nearby query filters on.

alter table public.profiles
  add column nearby_discovery_enabled boolean not null default false,
  -- When the coarse area was last written. Used to age out a stale area rather
  -- than present a year-old location as current.
  add column location_updated_at timestamptz,
  -- Derived from reverse geocoding on the device. Two letters, or null.
  add column country_code text check (country_code is null or char_length(country_code) = 2),
  add column city text check (city is null or char_length(city) <= 80);

comment on column public.profiles.nearby_discovery_enabled is
  'Opt-in to appearing in Nearby Network results. Distinct from sharing a coarse area for matching.';
comment on column public.profiles.location_updated_at is
  'When latitude/longitude/area_label were last written, so a stale area can be aged out.';

-- Communities carry the same coarse place fields so they can be browsed by area.
alter table public.communities
  add column country_code text check (country_code is null or char_length(country_code) = 2),
  add column city text check (city is null or char_length(city) <= 80),
  add column location_updated_at timestamptz;

-- Indexes.
--
-- The partial GiST index is the one that matters: a radius query only ever
-- considers opted-in, discoverable members, so indexing only those rows keeps
-- the index small and the lookup fast on a modest database.
create index profiles_nearby_gist_idx
  on public.profiles using gist (coarse_point)
  where nearby_discovery_enabled and visibility = 'discoverable';

create index profiles_city_trgm_idx on public.profiles using gin (city gin_trgm_ops);
create index profiles_country_idx on public.profiles (country_code)
  where country_code is not null;

create index communities_nearby_gist_idx
  on public.communities using gist (coarse_point)
  where coarse_point is not null;
create index communities_city_trgm_idx on public.communities using gin (city gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Nearby people.
--
-- Returns a deliberately narrow projection: no coordinates, no exact position,
-- only a distance rounded to whole kilometres. Rounding is not cosmetic — an
-- unrounded distance measured from a 5 km grid could be combined with repeated
-- queries to narrow down where someone is, so the value that leaves here cannot
-- be more precise than the grid it came from.
--
-- SECURITY DEFINER because the caller needs to see rows belonging to members
-- whose profile visibility would otherwise not admit them in a browse list.
-- The function therefore re-states every condition that grants access:
-- opted in, discoverable, not blocked, not the caller.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_profiles(
  viewer uuid,
  center_lat double precision,
  center_lng double precision,
  radius_km double precision default 25,
  max_results integer default 40
)
returns table (
  id uuid,
  display_name text,
  headline text,
  area_label text,
  city text,
  country_code text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography as point
  )
  select
    p.id,
    p.display_name,
    p.headline,
    p.area_label,
    p.city,
    p.country_code,
    round((st_distance(p.coarse_point, origin.point) / 1000)::numeric)::double precision
      as distance_km
  from public.profiles p, origin
  where p.id <> viewer
    and p.nearby_discovery_enabled
    and p.visibility = 'discoverable'
    and p.coarse_point is not null
    and st_dwithin(p.coarse_point, origin.point, radius_km * 1000)
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = viewer and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer)
    )
  order by p.coarse_point <-> origin.point
  -- Clamped so a caller cannot ask for the whole table.
  limit least(greatest(max_results, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- People by place, for global discovery.
--
-- Matches on the reverse-geocoded city and country rather than on coordinates,
-- so a search for "Lagos" or "DE" returns members who recorded that place. A
-- null argument means "anywhere", which is how the worldwide browse works.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_in_place(
  viewer uuid,
  place_city text default null,
  place_country text default null,
  max_results integer default 40
)
returns table (
  id uuid,
  display_name text,
  headline text,
  area_label text,
  city text,
  country_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.headline,
    p.area_label,
    p.city,
    p.country_code
  from public.profiles p
  where p.id <> viewer
    and p.visibility = 'discoverable'
    and (place_city is null or p.city ilike '%' || place_city || '%')
    and (place_country is null or p.country_code = upper(place_country))
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = viewer and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer)
    )
  order by p.display_name
  limit least(greatest(max_results, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Nearby communities.
--
-- Public communities are visible to any signed-in member; a private one is
-- returned only if the viewer already belongs to it, because a private
-- community's location is itself information about the community.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_communities(
  viewer uuid,
  center_lat double precision,
  center_lng double precision,
  radius_km double precision default 25,
  max_results integer default 40
)
returns table (
  id uuid,
  name text,
  slug text,
  purpose text,
  area_label text,
  city text,
  country_code text,
  is_private boolean,
  member_count integer,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography as point
  )
  select
    c.id,
    c.name,
    c.slug,
    c.purpose,
    c.area_label,
    c.city,
    c.country_code,
    c.is_private,
    c.member_count,
    round((st_distance(c.coarse_point, origin.point) / 1000)::numeric)::double precision
      as distance_km
  from public.communities c, origin
  where c.coarse_point is not null
    and st_dwithin(c.coarse_point, origin.point, radius_km * 1000)
    and (
      not c.is_private
      or exists (
        select 1 from public.community_members m
        where m.community_id = c.id and m.profile_id = viewer and m.state = 'member'
      )
    )
  order by c.coarse_point <-> origin.point
  limit least(greatest(max_results, 1), 100);
$$;

revoke all on function public.nearby_profiles(uuid, double precision, double precision, double precision, integer) from public;
revoke all on function public.profiles_in_place(uuid, text, text, integer) from public;
revoke all on function public.nearby_communities(uuid, double precision, double precision, double precision, integer) from public;

grant execute on function public.nearby_profiles(uuid, double precision, double precision, double precision, integer) to authenticated;
grant execute on function public.profiles_in_place(uuid, text, text, integer) to authenticated;
grant execute on function public.nearby_communities(uuid, double precision, double precision, double precision, integer) to authenticated;
