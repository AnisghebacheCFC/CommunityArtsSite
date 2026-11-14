-- Run in the Supabase SQL editor. Does not delete existing journal rows.

alter table public.journal_entries drop constraint if exists journal_entries_status_check;
alter table public.journal_entries
  add constraint journal_entries_status_check
  check (status in ('pending', 'approved', 'rejected', 'unpublished'));

create table if not exists public.admin_action_log (
  id bigint generated always as identity primary key,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_action_log enable row level security;

alter table public.journal_entries
  add column if not exists journal text not null default 'community';

alter table public.journal_entries
  add column if not exists dev_category text;

alter table public.journal_entries drop constraint if exists journal_entries_journal_check;
alter table public.journal_entries
  add constraint journal_entries_journal_check
  check (
    (journal = 'community' and dev_category is null)
    or (
      journal = 'dev'
      and dev_category in ('AI', 'Filmmaking', 'Animation', 'Creative Technology', 'Artistic Practice')
    )
  );
