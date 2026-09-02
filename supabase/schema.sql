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
