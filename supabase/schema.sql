create extension if not exists pgcrypto;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  entry_date date not null,
  body_html text not null,
  excerpt text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'unpublished')),
  review_token_hash text not null,
  image_paths text[] not null default '{}',
  video_paths text[] not null default '{}',
  video_embeds text[] not null default '{}',
  image_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  featured_path text,
  journal text not null default 'community',
  dev_category text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint journal_entries_journal_check check (
    (journal = 'community' and dev_category is null)
    or (
      journal = 'dev'
      and dev_category in ('AI', 'Filmmaking', 'Animation', 'Creative Technology', 'Artistic Practice', 'Fitness')
    )
    or (
      journal = 'anna'
      and dev_category in ('Child Development', 'Activities', 'Critical Engagement')
    )
    or (
      journal = 'miki'
      and dev_category in ('Workshops', 'Exhibitions', 'Art Practise')
    )
  )
);

create table if not exists public.submission_log (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_reactions (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  client_id uuid not null,
  reaction text not null check (reaction in ('love', 'applaud', 'inspired', 'growth', 'together')),
  created_at timestamptz not null default now(),
  unique (entry_id, client_id, reaction)
);

alter table public.journal_entries enable row level security;
alter table public.journal_reactions enable row level security;
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

create table if not exists public.featured_artwork (
  id integer primary key,
  image_path text,
  updated_at timestamptz not null default now(),
  constraint featured_artwork_singleton check (id = 1)
);

alter table public.featured_artwork enable row level security;
