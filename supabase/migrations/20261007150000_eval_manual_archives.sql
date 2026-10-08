-- Check archives and apply log for manual revisions.
-- Not applied to production. Does not alter eval_progress or other business tables.

create table if not exists public.eval_manual_check_archives (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.eval_manual_editions(id) on delete cascade,
  archived_at timestamptz not null default now(),
  checks jsonb not null default '{}'::jsonb,
  recheck_keys jsonb not null default '[]'::jsonb,
  keep_keys jsonb not null default '[]'::jsonb,
  note text not null default ''
);

create table if not exists public.eval_manual_apply_log (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.eval_manual_editions(id) on delete cascade,
  action text not null check (action in ('preview', 'apply_recheck', 'rollback', 'approve_pending')),
  expose_to_staff boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.eval_manual_check_archives enable row level security;
alter table public.eval_manual_apply_log enable row level security;

create policy eval_manual_check_archives_admin on public.eval_manual_check_archives
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy eval_manual_apply_log_admin on public.eval_manual_apply_log
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
