-- Conversations, messages, translations and notifications.
--
-- Private messaging requires mutual acceptance. This is enforced by the
-- `open_direct_conversation` function and by the insert policy on `messages`:
-- a member cannot post into a conversation they are not part of, and they
-- cannot be added to a direct conversation with someone they are not connected
-- to.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'direct',
  -- Set for group conversations tied to a community.
  community_id uuid references public.communities (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_group_needs_community check (
    kind = 'direct' or community_id is not null
  )
);

create index conversations_last_message_idx on public.conversations (last_message_at desc nulls last);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index conversation_members_profile_idx on public.conversation_members (profile_id);

create or replace function public.is_conversation_member(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conversation and profile_id = auth.uid()
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  voice_note_seconds integer check (voice_note_seconds is null or voice_note_seconds between 1 and 300),
  -- Validated attachment descriptors written by the client; never a raw URL to
  -- an unverified file.
  attachments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id, sender_id) where read_at is null;

create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return null;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

create table public.message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  target_language text not null references public.languages (code) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  -- Which service produced this. Never a fabricated provider name.
  provider text not null,
  was_translated boolean not null default true,
  created_at timestamptz not null default now(),
  -- One translation per message per language.
  unique (message_id, target_language)
);

create index message_translations_message_idx on public.message_translations (message_id);

-- Open (or reuse) the direct conversation between the caller and another
-- member. Refuses unless the two are connected and neither is blocked.
create or replace function public.open_direct_conversation(other_user uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing public.conversations;
  created public.conversations;
begin
  if me is null then
    raise exception 'You need to be signed in to do that.' using errcode = '42501';
  end if;
  if other_user = me then
    raise exception 'You cannot start a conversation with yourself.' using errcode = '22023';
  end if;
  if public.are_blocked(me, other_user) then
    raise exception 'This conversation is not available.' using errcode = '42501';
  end if;
  if not public.is_connected(me, other_user) then
    raise exception 'Messaging opens once you are both connected.' using errcode = '42501';
  end if;

  select c.* into existing
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.profile_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.profile_id = other_user
  where c.kind = 'direct'
  limit 1;

  if existing.id is not null then
    return existing;
  end if;

  insert into public.conversations (kind) values ('direct') returning * into created;
  insert into public.conversation_members (conversation_id, profile_id)
  values (created.id, me), (created.id, other_user);
  return created;
end;
$$;

-- ---- notifications ------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('connection-request', 'message', 'community', 'event')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 400),
  target_screen text,
  target_params jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;

create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, kind, title, body, target_screen, target_params)
  select
    new.to_user,
    'connection-request',
    'New connection request',
    coalesce(p.display_name, 'A member') || ' would like to connect.',
    'Connections',
    jsonb_build_object('tab', 'incoming')
  from public.profiles p
  where p.id = new.from_user;
  return null;
end;
$$;

create trigger connection_requests_notify
  after insert on public.connection_requests
  for each row execute function public.notify_connection_request();

-- Notifications are only ever created by the database, so a member cannot
-- forge one for somebody else.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, kind, title, body, target_screen, target_params)
  select
    cm.profile_id,
    'message',
    coalesce(p.display_name, 'New message'),
    left(new.body, 200),
    'Chat',
    jsonb_build_object('conversationId', new.conversation_id)
  from public.conversation_members cm
  left join public.profiles p on p.id = new.sender_id
  where cm.conversation_id = new.conversation_id
    and cm.profile_id <> new.sender_id;
  return null;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();
