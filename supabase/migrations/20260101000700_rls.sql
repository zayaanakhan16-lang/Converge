-- Row Level Security.
--
-- Every table is locked down and then opened by an explicit policy. The
-- baseline is deny: a table with no policy for an operation refuses it. The
-- helper functions used here are security definer so a policy can check
-- membership without re-entering the policy it is enforcing.

alter table public.profiles enable row level security;
alter table public.profile_interests enable row level security;
alter table public.profile_skills enable row level security;
alter table public.profile_languages enable row level security;
alter table public.profile_goals enable row level security;
alter table public.profile_activities enable row level security;
alter table public.interests enable row level security;
alter table public.skills enable row level security;
alter table public.languages enable row level security;
alter table public.goals enable row level security;
alter table public.activities enable row level security;
alter table public.communities enable row level security;
alter table public.community_interests enable row level security;
alter table public.community_languages enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.connection_requests enable row level security;
alter table public.connections enable row level security;
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_translations enable row level security;
alter table public.notifications enable row level security;

-- ---- reference vocabulary: readable by any signed-in member -------------

create policy "reference vocabulary is readable"
  on public.interests for select to authenticated using (true);
create policy "skills are readable"
  on public.skills for select to authenticated using (true);
create policy "languages are readable"
  on public.languages for select to authenticated using (true);
create policy "goals are readable"
  on public.goals for select to authenticated using (true);
create policy "activities are readable"
  on public.activities for select to authenticated using (true);

-- ---- profiles -----------------------------------------------------------

-- Visibility is the member's own choice. `can_see_profile` resolves it: public
-- gallery, a community in common, an existing connection, or yourself.
create policy "profiles are visible according to visibility"
  on public.profiles for select to authenticated
  using (public.can_see_profile(id));

create policy "profiles are created by their owner"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles are updated by their owner"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Deletion is handled by the delete-account function, not the client.
create policy "profiles are deleted by their owner"
  on public.profiles for delete to authenticated
  using (id = auth.uid());

-- Profile relation tables: read along with the profile, written only by its
-- owner. Reading is gated by the same visibility check as the profile.
create policy "profile interests follow the profile"
  on public.profile_interests for select to authenticated
  using (public.can_see_profile(profile_id));
create policy "profile interests are set by the owner"
  on public.profile_interests for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "profile skills follow the profile"
  on public.profile_skills for select to authenticated
  using (public.can_see_profile(profile_id));
create policy "profile skills are set by the owner"
  on public.profile_skills for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "profile languages follow the profile"
  on public.profile_languages for select to authenticated
  using (public.can_see_profile(profile_id));
create policy "profile languages are set by the owner"
  on public.profile_languages for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "profile goals follow the profile"
  on public.profile_goals for select to authenticated
  using (public.can_see_profile(profile_id));
create policy "profile goals are set by the owner"
  on public.profile_goals for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "profile activities follow the profile"
  on public.profile_activities for select to authenticated
  using (public.can_see_profile(profile_id));
create policy "profile activities are set by the owner"
  on public.profile_activities for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---- communities --------------------------------------------------------

create policy "communities are visible when public or joined"
  on public.communities for select to authenticated
  using (public.can_see_community(id));

create policy "communities are created by the signed-in member"
  on public.communities for insert to authenticated
  with check (created_by = auth.uid());

-- Only the owner or an organiser may edit a community.
create policy "communities are edited by owners and organisers"
  on public.communities for update to authenticated
  using (
    public.is_community_organiser(communities.id)
  );

create policy "communities are deleted by their owner"
  on public.communities for delete to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = communities.id
        and m.profile_id = auth.uid()
        and m.role = 'owner'
    )
  );

create policy "community interests are visible with the community"
  on public.community_interests for select to authenticated
  using (public.can_see_community(community_id));
create policy "community interests are set by organisers"
  on public.community_interests for all to authenticated
  using (
    public.is_community_organiser(community_interests.community_id)
  );

create policy "community languages are visible with the community"
  on public.community_languages for select to authenticated
  using (public.can_see_community(community_id));
create policy "community languages are set by organisers"
  on public.community_languages for all to authenticated
  using (
    public.is_community_organiser(community_languages.community_id)
  );

-- Membership rows are visible to the member themselves and to organisers of
-- that community. This is what stops a member enumerating every community.
create policy "memberships are visible to the member and organisers"
  on public.community_members for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_community_organiser(community_members.community_id)
  );

-- A member may join a community themselves, but only as an ordinary member,
-- and only when the community is visible to them.
create policy "members join communities themselves"
  on public.community_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and role = 'member'
    and public.can_see_community(community_id)
  );

-- Leaving. A member may remove their own row; organisers may remove others.
create policy "members leave communities"
  on public.community_members for delete to authenticated
  using (
    profile_id = auth.uid()
    or public.is_community_organiser(community_members.community_id)
  );

-- Approval of a request, promotion and role changes are organiser actions.
-- A member updating their own row may only change the request note: role and
-- state are left to organisers, which the trigger below enforces.
create policy "memberships are managed by organisers"
  on public.community_members for update to authenticated
  using (
    profile_id = auth.uid()
    or public.is_community_organiser(community_members.community_id)
  )
  with check (
    profile_id = auth.uid()
    or public.is_community_organiser(community_members.community_id)
  );

-- ---- events -------------------------------------------------------------

create policy "events are visible with their community"
  on public.events for select to authenticated
  using (public.can_see_community(community_id));

create policy "events are created by community members"
  on public.events for insert to authenticated
  with check (
    created_by = auth.uid() and public.is_community_member(community_id)
  );

create policy "events are edited by organisers"
  on public.events for update to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = events.community_id
        and m.profile_id = auth.uid()
        and m.role in ('owner', 'organiser')
    )
  );

create policy "events are deleted by organisers"
  on public.events for delete to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = events.community_id
        and m.profile_id = auth.uid()
        and m.role in ('owner', 'organiser')
    )
  );

create policy "attendees are visible to members of the community"
  on public.event_attendees for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_attendees.event_id
        and public.can_see_community(e.community_id)
    )
  );

-- A member may only take or release their own place, and only while the
-- community is visible to them.
create policy "members manage their own event place"
  on public.event_attendees for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_attendees.event_id
        and public.is_community_member(e.community_id)
    )
  );

create policy "members release their own event place"
  on public.event_attendees for delete to authenticated
  using (profile_id = auth.uid());

-- ---- community discussion ----------------------------------------------

create policy "community discussion is visible to members"
  on public.community_messages for select to authenticated
  using (public.is_community_member(community_id));

-- Posting requires membership: this is the rule the app also checks, but the
-- database is the authority.
create policy "community discussion is written by members"
  on public.community_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_community_member(community_id));

create policy "community posts are removed by their author or an organiser"
  on public.community_messages for delete to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.community_members m
      where m.community_id = community_messages.community_id
        and m.profile_id = auth.uid()
        and m.role in ('owner', 'organiser')
    )
  );

-- ---- connection requests and connections --------------------------------

-- Both sides can see a request; nobody else can.
create policy "requests are visible to both members"
  on public.connection_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- A request must come from the caller, must target someone they can see, and
-- must not be sent to somebody who has blocked them or disabled requests.
create policy "requests are sent by the caller"
  on public.connection_requests for insert to authenticated
  with check (
    from_user = auth.uid()
    and from_user <> to_user
    and not public.are_blocked(from_user, to_user)
    and exists (
      select 1 from public.profiles p
      where p.id = to_user and p.allow_connection_requests
    )
  );

-- Only the sender may cancel; the recipient accepts or declines through the
-- security-definer function.
create policy "requests are cancelled by the sender"
  on public.connection_requests for update to authenticated
  using (from_user = auth.uid())
  with check (from_user = auth.uid() and status = 'cancelled');

-- Connections are visible only to the two members involved.
create policy "connections are visible to their members"
  on public.connections for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

create policy "connections are ended by either member"
  on public.connections for delete to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- There is deliberately no insert policy on `connections`: a row may only be
-- created by `respond_to_connection_request`, which runs as the definer.

-- ---- blocking -----------------------------------------------------------

create policy "blocks are visible to the blocker"
  on public.blocked_users for select to authenticated
  using (blocker_id = auth.uid());

create policy "blocks are created by the blocker"
  on public.blocked_users for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

create policy "blocks are removed by the blocker"
  on public.blocked_users for delete to authenticated
  using (blocker_id = auth.uid());

-- ---- reports ------------------------------------------------------------

-- A member may file a report and read back their own. The moderation queue is
-- read by the backend with the service role, not by the client.
create policy "reports are filed by the reporter"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "reports are visible to the reporter"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- ---- conversations and messages -----------------------------------------

create policy "conversations are visible to their members"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id));

-- There is no client insert policy on `conversations`: a direct conversation
-- is created by `open_direct_conversation`, which checks the connection.

create policy "membership rows are visible to the conversation"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- A member may add themselves only to a group conversation for a community
-- they belong to. Direct conversations are created by the function.
create policy "members join group conversations"
  on public.conversation_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.kind = 'group'
        and c.community_id is not null
        and public.is_community_member(c.community_id)
    )
  );

create policy "members may leave a conversation"
  on public.conversation_members for delete to authenticated
  using (profile_id = auth.uid());

create policy "messages are visible to conversation members"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Sending requires membership, and the sender is always the caller. This is the
-- second half of the mutual-consent rule: no membership row, no message.
create policy "messages are sent by conversation members"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

create policy "messages are read-marked by recipients"
  on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id) and sender_id <> auth.uid())
  with check (sender_id <> auth.uid());

create policy "authors may delete their own message"
  on public.messages for delete to authenticated
  using (sender_id = auth.uid());

create policy "translations are visible with the message"
  on public.message_translations for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_translations.message_id
        and public.is_conversation_member(m.conversation_id)
    )
  );

-- Translations are written by the backend with the service role, so there is no
-- client insert policy: a member cannot fabricate a translation.

-- ---- notifications ------------------------------------------------------

create policy "notifications are visible to their member"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

create policy "notifications are read-marked by their member"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
