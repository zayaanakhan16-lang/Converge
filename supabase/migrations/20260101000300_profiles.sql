-- Profiles and the profile relation tables.
--
-- Privacy defaults are the safe ones: a new member is visible to their
-- communities only, location sharing is off, and no exact coordinate is ever
-- stored. `latitude`/`longitude` hold a grid-snapped point written by the app;
-- a check constraint rejects a point that is not on the grid.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  headline text check (headline is null or char_length(headline) <= 120),
  bio text check (bio is null or char_length(bio) <= 600),

  visibility public.visibility_level not null default 'community',
  share_approximate_location boolean not null default false,
  allow_connection_requests boolean not null default true,
  show_in_community_lists boolean not null default true,

  notify_connection_requests boolean not null default true,
  notify_messages boolean not null default true,
  notify_community_activity boolean not null default true,
  notify_event_reminders boolean not null default true,
  notify_product_updates boolean not null default false,

  -- Coarse area, snapped to a 0.05 degree grid by the client.
  latitude double precision,
  longitude double precision,
  area_label text check (area_label is null or char_length(area_label) <= 60),
  -- Generated PostGIS point, used for radius queries. Never a live coordinate.
  coarse_point geography(point, 4326)
    generated always as (
      case
        when latitude is null or longitude is null then null
        else st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      end
    ) stored,

  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A stored point must sit on the coarse grid: 0.05 divides the value evenly.
  constraint profiles_coarse_grid check (
    latitude is null
    or (abs(latitude / 0.05 - round(latitude / 0.05)) < 0.000001
        and abs(longitude / 0.05 - round(longitude / 0.05)) < 0.000001)
  ),
  constraint profiles_location_paired check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  )
);

create index profiles_visibility_idx on public.profiles (visibility);
create index profiles_discoverable_idx on public.profiles (visibility)
  where visibility <> 'private';
create index profiles_coarse_point_idx on public.profiles using gist (coarse_point);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name gin_trgm_ops);

create table public.profile_interests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest_id text not null references public.interests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  intent public.skill_intent not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id, intent)
);

create table public.profile_languages (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  proficiency text not null default 'conversational'
    check (proficiency in ('beginner', 'conversational', 'fluent', 'native')),
  created_at timestamptz not null default now(),
  primary key (profile_id, language_code)
);

create table public.profile_goals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  goal_id text not null references public.goals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, goal_id)
);

create table public.profile_activities (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_id text not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);

create index profile_interests_interest_idx on public.profile_interests (interest_id);
create index profile_skills_skill_idx on public.profile_skills (skill_id);
create index profile_languages_code_idx on public.profile_languages (language_code);
create index profile_goals_goal_idx on public.profile_goals (goal_id);
create index profile_activities_activity_idx on public.profile_activities (activity_id);

-- Keep updated_at honest without trusting the client.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile row when Supabase Auth creates the user, so a member never
-- exists without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_name text;
begin
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'member'), '@', 1)
  );
  insert into public.profiles (id, display_name)
  values (new.id, left(requested_name, 60))
  on conflict (id) do nothing;

  -- Everyone starts able to speak English; the app lets them change it.
  insert into public.profile_languages (profile_id, language_code, proficiency)
  values (new.id, 'en', 'conversational')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
