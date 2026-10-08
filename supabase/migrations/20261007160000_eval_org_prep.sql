-- Institution prep board, staff links, events, snapshots.
-- Not applied to production. Does not alter duties, employees, leave_*, ff_*, roster_*.

create table if not exists public.eval_staff_links (
  leave_record_id bigint primary key,
  display_name text not null,
  job_type text not null default '',
  eval_role text,
  role_status text not null default 'review' check (role_status in ('mapped', 'review')),
  role_note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_org_checks (
  indicator_id int not null,
  mark text not null,
  role text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_leave_record_id bigint,
  updated_by_name text not null default '',
  primary key (indicator_id, mark, role)
);

create table if not exists public.eval_org_check_events (
  id uuid primary key default gen_random_uuid(),
  indicator_id int not null,
  mark text not null,
  role text not null,
  action text not null check (action in ('complete', 'cancel')),
  actor_leave_record_id bigint,
  actor_name text not null default '',
  as_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_role_assignments (
  indicator_id int not null,
  mark text not null default '',
  role text not null,
  source text not null check (source in ('org-duty', 'manual-text', 'review')),
  primary key (indicator_id, mark, role)
);

create table if not exists public.eval_check_snapshots (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid,
  checks jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.eval_staff_links enable row level security;
alter table public.eval_org_checks enable row level security;
alter table public.eval_org_check_events enable row level security;
alter table public.eval_role_assignments enable row level security;
alter table public.eval_check_snapshots enable row level security;

create policy eval_staff_links_admin on public.eval_staff_links
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy eval_org_checks_admin on public.eval_org_checks
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy eval_org_check_events_admin on public.eval_org_check_events
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy eval_role_assignments_admin on public.eval_role_assignments
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy eval_check_snapshots_admin on public.eval_check_snapshots
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Staff access is via server RPC/API using leave_staff sessions, not browser JWT.
revoke all on public.eval_org_checks from anon;
revoke all on public.eval_org_check_events from anon;
revoke all on public.eval_staff_links from anon;
revoke all on public.eval_role_assignments from anon;
revoke all on public.eval_check_snapshots from anon;
