begin;

-- Keep session IDs stable: deleting/recreating or renaming sessions could otherwise
-- bypass the six-object limit while leaving previous objects in Storage.
revoke all on public.preview_sessions from authenticated;
grant select, insert on public.preview_sessions to authenticated;
grant update (package_data, preview_mode, placement_step, avatar_path, thumbnail_paths)
  on public.preview_sessions to authenticated;
drop policy if exists "Users can delete their preview session" on public.preview_sessions;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.preview_sessions'::regclass and conname = 'preview_session_metadata_size') then
    alter table public.preview_sessions add constraint preview_session_metadata_size check (
      octet_length(package_data::text) <= 65536
      and octet_length(thumbnail_paths::text) <= 4096
      and octet_length(coalesce(avatar_path, '')) <= 512
    ) not valid;
  end if;
end $$;

-- Restrictive policies also constrain any existing permissive upload policies.
-- One account has one immutable session and exactly six permitted object names.
drop policy if exists "Limit preview asset inserts" on storage.objects;
create policy "Limit preview asset inserts" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'preview-assets' or exists (
      select 1 from public.preview_sessions s
      where s.user_id = (select auth.uid())
      and name = any (array[
        s.user_id::text || '/' || s.id::text || '/avatar',
        s.user_id::text || '/' || s.id::text || '/thumbnail-a',
        s.user_id::text || '/' || s.id::text || '/thumbnail-b',
        s.user_id::text || '/' || s.id::text || '/thumbnail-c',
        s.user_id::text || '/' || s.id::text || '/thumbnail-d',
        s.user_id::text || '/' || s.id::text || '/thumbnail-e'
      ])
    )
  );

drop policy if exists "Limit preview asset updates" on storage.objects;
create policy "Limit preview asset updates" on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'preview-assets' or (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id <> 'preview-assets' or exists (
      select 1 from public.preview_sessions s
      where s.user_id = (select auth.uid())
      and name = any (array[
        s.user_id::text || '/' || s.id::text || '/avatar',
        s.user_id::text || '/' || s.id::text || '/thumbnail-a',
        s.user_id::text || '/' || s.id::text || '/thumbnail-b',
        s.user_id::text || '/' || s.id::text || '/thumbnail-c',
        s.user_id::text || '/' || s.id::text || '/thumbnail-d',
        s.user_id::text || '/' || s.id::text || '/thumbnail-e'
      ])
    )
  );

update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'preview-assets';

commit;
