-- Storage policies for profile avatars.
--
-- Avatars are the only thing Converge stores in Supabase Storage. The bucket is
-- public for reads (an avatar URL is embedded in a profile row that RLS already
-- gates), but a member may only write inside their own `${userId}/` folder.
--
-- The whole file is skipped when the `storage` schema is absent, so the
-- migrations also apply to a plain PostgreSQL instance used for policy testing.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present: skipping storage policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MB: a profile photo, not a photo library
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Replacing the policy set is idempotent, so the migration can be re-run.
  drop policy if exists "avatars are readable by signed-in members" on storage.objects;
  drop policy if exists "members upload their own avatar" on storage.objects;
  drop policy if exists "members replace their own avatar" on storage.objects;
  drop policy if exists "members delete their own avatar" on storage.objects;

  create policy "avatars are readable by signed-in members"
    on storage.objects for select to authenticated
    using (bucket_id = 'avatars');

  -- The first path segment must be the caller's own id.
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
