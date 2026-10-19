create extension if not exists pgcrypto;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  entry_date date not null,
  body_html text not null,
  excerpt text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_token_hash text not null,
  image_paths text[] not null default '{}',
  video_paths text[] not null default '{}',
  video_embeds text[] not null default '{}',
  image_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  featured_path text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.submission_log (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;
alter table public.submission_log enable row level security;

create policy "public can read approved journal entries"
on public.journal_entries
for select
to anon, authenticated
using (status = 'approved');

insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do nothing;

create policy "public can read published journal files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'journal' and (storage.foldername(name))[1] = 'public');
