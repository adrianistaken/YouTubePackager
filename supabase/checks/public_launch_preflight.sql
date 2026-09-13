-- Read-only deployment checks. Run before and after the security migration.
-- No user data or image contents are returned.
select relname, relrowsecurity
from pg_class
where oid in ('public.preview_sessions'::regclass, 'storage.objects'::regclass);

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'preview_sessions')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'preview_sessions'
  and grantee in ('anon', 'authenticated');

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'preview_sessions'
  and grantee in ('anon', 'authenticated')
order by grantee, column_name, privilege_type;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'preview-assets';

select count(*) as existing_oversized_metadata_rows
from public.preview_sessions
where octet_length(package_data::text) > 65536
   or octet_length(thumbnail_paths::text) > 4096
   or octet_length(coalesce(avatar_path, '')) > 512;

select count(*) as extra_existing_asset_objects
from storage.objects o
where o.bucket_id = 'preview-assets'
  and not exists (
    select 1 from public.preview_sessions s
    where o.name = any(array[
      s.user_id::text || '/' || s.id::text || '/avatar',
      s.user_id::text || '/' || s.id::text || '/thumbnail-a',
      s.user_id::text || '/' || s.id::text || '/thumbnail-b',
      s.user_id::text || '/' || s.id::text || '/thumbnail-c',
      s.user_id::text || '/' || s.id::text || '/thumbnail-d',
      s.user_id::text || '/' || s.id::text || '/thumbnail-e'
    ])
  );
