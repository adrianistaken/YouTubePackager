-- Run this file once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  package_data jsonb not null default '{}'::jsonb,
  preview_mode text not null default 'desktop' check (preview_mode in ('desktop', 'mobile')),
  placement_step integer not null default 0,
  avatar_path text,
  thumbnail_paths jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preview_sessions enable row level security;
revoke all on public.preview_sessions from anon;
grant select, insert, update, delete on public.preview_sessions to authenticated;

drop policy if exists "Users can read their preview session" on public.preview_sessions;
create policy "Users can read their preview session"
  on public.preview_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their preview session" on public.preview_sessions;
create policy "Users can create their preview session"
  on public.preview_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their preview session" on public.preview_sessions;
create policy "Users can update their preview session"
  on public.preview_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their preview session" on public.preview_sessions;
create policy "Users can delete their preview session"
  on public.preview_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_preview_session_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_preview_session_updated_at on public.preview_sessions;
create trigger set_preview_session_updated_at
  before update on public.preview_sessions
  for each row execute function public.set_preview_session_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'preview-assets',
  'preview-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their preview assets" on storage.objects;
create policy "Users can read their preview assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'preview-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their preview assets" on storage.objects;
create policy "Users can upload their preview assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'preview-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their preview assets" on storage.objects;
create policy "Users can update their preview assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'preview-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'preview-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their preview assets" on storage.objects;
create policy "Users can delete their preview assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'preview-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Public launch hardening (also available as a migration for existing projects).
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
