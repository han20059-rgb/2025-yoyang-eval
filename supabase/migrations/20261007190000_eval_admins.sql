-- Staff-account admins. Not applied to production in this task.
-- Privilege is leave_record_id, never name-only.
-- Confirmed first admin candidate (do not insert here):
--   leave_records.id = 64, name 한태수, jobType 2.사무국장

create table if not exists public.eval_admins (
  leave_record_id bigint primary key,
  name_snapshot text not null default '',
  granted_by_leave_record_id bigint,
  granted_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.eval_admin_events (
  id uuid primary key default gen_random_uuid(),
  target_leave_record_id bigint not null,
  actor_leave_record_id bigint not null,
  action text not null check (action in ('grant', 'revoke', 'bootstrap')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.eval_assignment_overrides
  add column if not exists actor_leave_record_id bigint;
alter table public.eval_assignment_events
  add column if not exists actor_leave_record_id bigint;

alter table public.eval_admins enable row level security;
alter table public.eval_admin_events enable row level security;

create policy eval_admins_no_anon on public.eval_admins
  for all to authenticated using (false) with check (false);
create policy eval_admin_events_no_anon on public.eval_admin_events
  for all to authenticated using (false) with check (false);

revoke all on public.eval_admins from anon;
revoke all on public.eval_admin_events from anon;
