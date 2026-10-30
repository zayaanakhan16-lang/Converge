-- Connection requests, connections, blocking and reports.
--
-- Two rules are structural rather than advisory:
--   1. A connection can only be created by accepting a pending request, and
--      only the recipient can accept it. Enforced in a database function.
--   2. A direct conversation can only be opened between connected members.
--      Enforced in `open_direct_conversation`.

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 400),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connection_requests_not_self check (from_user <> to_user)
);

-- At most one pending request per direction.
create unique index connection_requests_pending_unique
  on public.connection_requests (from_user, to_user)
  where status = 'pending';

create index connection_requests_to_user_idx
  on public.connection_requests (to_user, status);
create index connection_requests_from_user_idx
  on public.connection_requests (from_user, status);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  -- Stored with user_a < user_b so a pair has exactly one row.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  origin_request_id uuid references public.connection_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint connections_not_self check (user_a <> user_b),
  constraint connections_ordered check (user_a < user_b),
  unique (user_a, user_b)
);

create index connections_user_a_idx on public.connections (user_a);
create index connections_user_b_idx on public.connections (user_b);

create table public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

create index blocked_users_blocked_idx on public.blocked_users (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  subject_user_id uuid references public.profiles (id) on delete set null,
  subject_message_id uuid,
  reason public.report_reason not null,
  detail text check (detail is null or char_length(detail) <= 600),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_have_subject check (subject_user_id is not null or subject_message_id is not null)
);

create index reports_status_idx on public.reports (status, created_at desc);

-- ---- helpers ------------------------------------------------------------

-- Are these two members connected? Used by messaging policies.
create or replace function public.is_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connections
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

-- Is either member blocking the other, in either direction?
create or replace function public.are_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Is the caller an owner or organiser of this community? Security definer so
-- the membership policies can call it without re-entering themselves.
create or replace function public.is_community_organiser(community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = community
      and profile_id = auth.uid()
      and state = 'member'
      and role in ('owner', 'organiser')
  );
$$;

create or replace function public.is_community_member(community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = community
      and profile_id = auth.uid()
      and state = 'member'
  );
$$;

-- A community is visible when it is public, or the viewer belongs to it.
create or replace function public.can_see_community(community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.communities c
    where c.id = community
      and (
        not c.is_private
        or exists (
          select 1 from public.community_members m
          where m.community_id = c.id
            and m.profile_id = auth.uid()
            and m.state in ('member', 'invited', 'requested')
        )
      )
  );
$$;

-- Can the viewer see this profile at all? Public gallery, same community, or
-- an existing connection. A private profile is only visible to itself.
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- An unauthenticated request (auth.uid() is null) sees nothing.
    auth.uid() is not null
    and (
      target = auth.uid()
      or exists (
      select 1 from public.profiles p
      where p.id = target
        and p.visibility <> 'private'
        and not public.are_blocked(auth.uid(), target)
      )
      or public.is_connected(auth.uid(), target)
      or exists (
      select 1
        from public.community_members mine
        join public.community_members theirs on theirs.community_id = mine.community_id
        where mine.profile_id = auth.uid()
          and mine.state = 'member'
          and theirs.profile_id = target
          and theirs.state = 'member'
      )
    );
$$;

-- ---- accept / decline ---------------------------------------------------

-- Accepting a request creates the connection in the same transaction, so the
-- two rows cannot diverge. Only the recipient may call it.
create or replace function public.respond_to_connection_request(
  request_id uuid,
  accept boolean
)
returns public.connection_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.connection_requests;
  low uuid;
  high uuid;
begin
  select * into request_row
  from public.connection_requests
  where id = request_id
  for update;

  if request_row.id is null then
    raise exception 'That request no longer exists.' using errcode = 'P0002';
  end if;
  if request_row.to_user <> auth.uid() then
    raise exception 'Only the recipient can respond to this request.' using errcode = '42501';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'That request has already been answered.' using errcode = '23505';
  end if;

  update public.connection_requests
  set status = (case when accept then 'accepted' else 'declined' end)::public.request_status,
      responded_at = now()
  where id = request_id
  returning * into request_row;

  if accept then
    if public.are_blocked(request_row.from_user, request_row.to_user) then
      raise exception 'This connection is not available.' using errcode = '42501';
    end if;
    low := least(request_row.from_user, request_row.to_user);
    high := greatest(request_row.from_user, request_row.to_user);
    insert into public.connections (user_a, user_b, origin_request_id)
    values (low, high, request_row.id)
    on conflict (user_a, user_b) do nothing;
  end if;

  return request_row;
end;
$$;

-- ---- join codes ---------------------------------------------------------

-- A join code is an invitation shared in person, so it must not be readable by
-- anyone who can see the community. The `join_code` column is therefore not
-- selectable at all (see the grants migration); these two functions are the
-- only ways to touch it.
--
--   community_by_join_code  - resolve a code the user was given.
--   community_join_code     - read the code, but only as a member.
--
-- Both run as their definer so they can read the column, and both check who is
-- asking.

create or replace function public.community_by_join_code(lookup_code text)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.communities c
  where c.join_code = upper(trim(lookup_code));
$$;

create or replace function public.community_join_code(community uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.join_code
  from public.communities c
  where c.id = community
    and public.is_community_member(c.id);
$$;

-- Every join code the caller is entitled to, in one call, so a list screen does
-- not need one request per community.
create or replace function public.community_join_codes()
returns table (community_id uuid, join_code text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.join_code
  from public.communities c
  join public.community_members m
    on m.community_id = c.id
   and m.profile_id = auth.uid()
   and m.state = 'member'
  where c.join_code is not null;
$$;
