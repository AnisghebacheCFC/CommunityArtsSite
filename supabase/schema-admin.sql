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
