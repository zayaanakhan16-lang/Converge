-- Profile photo privacy.
--
-- Replaces the public avatar bucket with a private one, and moves visibility
-- from a client-side convention into the database.
--
-- The previous design stored a public URL on `profiles.avatar_url`. That made
-- every avatar world-readable to anyone who obtained the URL, regardless of the
-- member's visibility setting, because a public bucket serves objects without
-- consulting RLS. The label said "private"; the storage layer did not enforce
-- it.
--
-- What replaces it:
--   * `profiles.avatar_path` holds the object key inside the bucket, not a URL.
--     There is no way to render it without an authorisation check.
--   * `profiles.photo_visibility` records who may see it.
--   * The bucket is private, so `getPublicUrl` returns a URL that does not work.
--     Readers request a short-lived signed URL instead.
--   * A storage SELECT policy decides, per object, whether this caller may read
--     it at all. Storage evaluates that policy before it will sign anything.
--
-- The four levels are the ones the storage layer can actually enforce:
--   public            any signed-in member
--   community         shares at least one community with the owner
--   connections       an accepted connection of the owner
--   private           the owner only
--
-- "public" still means signed-in, not anonymous: Converge has no anonymous
-- surface, and a signed URL is required either way.

-- Who may see a member's photo. Separate from `visibility_level`, which governs
-- profile discovery and answers a different question.
create type public.photo_visibility as enum ('public', 'community', 'connections', 'private');

alter table public.profiles
  add column avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 300),
  add column photo_visibility public.photo_visibility not null default 'community';

comment on column public.profiles.avatar_path is
  'Object key inside the private `avatars` bucket. Render via a signed URL; never a public URL.';
comment on column public.profiles.photo_visibility is
  'Who may be issued a signed URL for this photo. Enforced by the storage policy.';

-- The legacy public URL column is dropped rather than left in place: keeping it
-- would leave a second, unprotected route to the same image.
alter table public.profiles drop column avatar_url;

-- ---------------------------------------------------------------------------
-- Can `viewer` see the photo belonging to `owner`?
--
-- A security definer function so storage policies can call it without needing
-- the caller to hold SELECT on the underlying tables. It answers only the
-- visibility question; it deliberately does not return the path, so a caller
-- cannot use it to enumerate object keys.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_photo(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- A blocked relationship hides the photo in both directions, before any
    -- visibility level is considered.
    not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = viewer and b.blocked_id = owner)
         or (b.blocker_id = owner and b.blocked_id = viewer)
    )
    and (
      -- A member always sees their own photo.
      viewer = owner
      or case (select p.photo_visibility from public.profiles p where p.id = owner)
        when 'public' then true
        when 'private' then false
        when 'community' then exists (
          select 1
          from public.community_members mine
          join public.community_members theirs
            on theirs.community_id = mine.community_id
          where mine.user_id = viewer
            and theirs.user_id = owner
            and mine.state = 'member'
            and theirs.state = 'member'
        )
        when 'connections' then exists (
          select 1 from public.connections c
          where c.user_low = least(viewer, owner)
            and c.user_high = greatest(viewer, owner)
        )
        else false
      end
    );
$$;

revoke all on function public.can_view_photo(uuid, uuid) from public;
grant execute on function public.can_view_photo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket and per-object read policy.
-- Skipped when the storage schema is absent, so the migrations still apply to a
-- plain PostgreSQL instance used for policy testing.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present: skipping avatar storage policies';
    return;
  end if;

  -- `public = false` is the change that matters. A public bucket bypasses RLS
  -- on read entirely, which is how the previous version leaked.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'avatars',
    'avatars',
    false,
    2097152, -- 2 MB: a profile photo, not a photo library
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "avatars are readable by signed-in members" on storage.objects;
  drop policy if exists "members upload their own avatar" on storage.objects;
  drop policy if exists "members replace their own avatar" on storage.objects;
  drop policy if exists "members delete their own avatar" on storage.objects;
  drop policy if exists "avatars are readable when visibility permits" on storage.objects;

  -- Read: the owner, or anyone the owner's photo_visibility admits.
  --
  -- The owner is the first path segment of the object key, which is how the
  -- upload policy writes it. Storage checks this policy before issuing a signed
  -- URL, so a member who fails it cannot obtain a working link at all.
  create policy "avatars are readable when visibility permits"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'avatars'
      and public.can_view_photo(auth.uid(), ((storage.foldername(name))[1])::uuid)
    );

  -- Write: only inside the caller's own folder.
  create policy "members upload their own avatar"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "members replace their own avatar"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "members delete their own avatar"
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
end;
$$;
