-- Communities, membership and events.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  description text not null check (char_length(description) between 10 and 800),
  purpose text not null check (char_length(purpose) between 3 and 300),

  -- A join code is an invitation, not a secret channel: it is resolvable only
  -- through a security-definer function and never returned by a plain select.
  join_code text unique check (join_code is null or join_code ~ '^[A-Z0-9-]{4,24}$'),
  membership_requires_approval boolean not null default true,
  is_private boolean not null default false,

  member_count integer not null default 0 check (member_count >= 0),
  cover_colour text not null default '#12303A' check (cover_colour ~ '^#[0-9A-Fa-f]{6}$'),

  latitude double precision,
  longitude double precision,
  area_label text check (area_label is null or char_length(area_label) <= 60),
  coarse_point geography(point, 4326)
    generated always as (
      case
        when latitude is null or longitude is null then null
        else st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      end
    ) stored,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint communities_coarse_grid check (
    latitude is null
    or (abs(latitude / 0.05 - round(latitude / 0.05)) < 0.000001
        and abs(longitude / 0.05 - round(longitude / 0.05)) < 0.000001)
  )
);

create index communities_member_count_idx on public.communities (member_count desc);
create index communities_name_trgm_idx on public.communities using gin (name gin_trgm_ops);
create index communities_coarse_point_idx on public.communities using gist (coarse_point);

create trigger communities_touch_updated_at
  before update on public.communities
  for each row execute function public.touch_updated_at();

create table public.community_interests (
  community_id uuid not null references public.communities (id) on delete cascade,
  interest_id text not null references public.interests (id) on delete cascade,
  primary key (community_id, interest_id)
);

create table public.community_languages (
  community_id uuid not null references public.communities (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  primary key (community_id, language_code)
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  state public.membership_state not null default 'requested',
  role public.membership_role not null default 'member',
  -- Optional note attached to a membership request, shown to organisers.
  note text check (note is null or char_length(note) <= 400),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, profile_id)
);

create index community_members_profile_idx on public.community_members (profile_id);
create index community_members_state_idx on public.community_members (community_id, state);

create trigger community_members_touch_updated_at
  before update on public.community_members
  for each row execute function public.touch_updated_at();

-- Only the creator may hold the owner role, and a community always has exactly
-- one owner. Enforced here rather than in the client.
create or replace function public.enforce_single_owner()
returns trigger
language plpgsql
as $$
declare
  owner_count integer;
begin
  if new.role = 'owner' then
    select count(*) into owner_count
    from public.community_members
    where community_id = new.community_id
      and role = 'owner'
      and profile_id <> new.profile_id;
    if owner_count > 0 then
      raise exception 'This community already has an owner.' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create trigger community_members_single_owner
  before insert or update on public.community_members
  for each row execute function public.enforce_single_owner();

-- A member may attach a note to their own membership request, but may not
-- promote themselves or approve their own request. Organisers may change
-- anything. The update policy allows the row; this trigger constrains the
-- columns.
create or replace function public.guard_membership_self_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_community_organiser(new.community_id) then
    return new;
  end if;
  if old.profile_id <> auth.uid() then
    raise exception 'Only an organiser can change this membership.'
      using errcode = '42501';
  end if;
  if new.role is distinct from old.role or new.state is distinct from old.state then
    raise exception 'Only an organiser can change a role or approve a request.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger community_members_guard_self_update
  before update on public.community_members
  for each row execute function public.guard_membership_self_update();

-- Membership count is derived, so it cannot drift from the member rows.
create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.community_id, old.community_id);
  update public.communities
  set member_count = (
    select count(*) from public.community_members
    where community_id = target and state = 'member'
  )
  where id = target;
  return null;
end;
$$;

create trigger community_members_sync_count
  after insert or update or delete on public.community_members
  for each row execute function public.sync_community_member_count();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 1200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null check (char_length(venue_name) between 3 and 160),
  -- Converge only supports activities at public venues. Enforced, not advised.
  is_public_venue boolean not null default true,
  latitude double precision,
  longitude double precision,
  capacity integer check (capacity is null or capacity > 0),
  attendee_count integer not null default 0 check (attendee_count >= 0),
  activity_ids text[] not null default '{}',
  language_codes text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at),
  constraint events_public_venue check (is_public_venue)
);

create index events_starts_at_idx on public.events (starts_at);
create index events_community_idx on public.events (community_id, starts_at);
create index events_activity_ids_idx on public.events using gin (activity_ids);

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create index event_attendees_profile_idx on public.event_attendees (profile_id);

create or replace function public.sync_event_attendee_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.event_id, old.event_id);
  update public.events
  set attendee_count = (select count(*) from public.event_attendees where event_id = target)
  where id = target;
  return null;
end;
$$;

create trigger event_attendees_sync_count
  after insert or delete on public.event_attendees
  for each row execute function public.sync_event_attendee_count();

-- Capacity is enforced on the write path so a race cannot oversell a place.
create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
as $$
declare
  limit_value integer;
  taken integer;
begin
  select capacity into limit_value from public.events where id = new.event_id for update;
  if limit_value is null then
    return new;
  end if;
  select count(*) into taken from public.event_attendees where event_id = new.event_id;
  if taken >= limit_value then
    raise exception 'That activity is full.' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger event_attendees_capacity
  before insert on public.event_attendees
  for each row execute function public.enforce_event_capacity();

-- Group discussion. Separate from `messages` so community posts are never
-- mixed into a private conversation.
create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index community_messages_community_idx
  on public.community_messages (community_id, created_at desc);
