-- Admin assignment overlays. Not applied to production.
-- Does not alter duties, employees, leave_*, ff_*, roster_*.

create table if not exists public.eval_assignment_overrides (
  indicator_id int not null,
  mark text not null,
  roles text[] not null default '{}',
  staff_names text[] not null default '{}',
  reason text not null default '',
  actor_name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (indicator_id, mark)
);

create table if not exists public.eval_assignment_events (
  id uuid primary key default gen_random_uuid(),
  indicator_id int not null,
  mark text not null,
  before_roles text[] not null default '{}',
  after_roles text[] not null default '{}',
  reason text not null default '',
  actor_name text not null default '',
  as_admin boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.eval_assignment_overrides enable row level security;
alter table public.eval_assignment_events enable row level security;

create policy eval_assignment_overrides_admin on public.eval_assignment_overrides
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy eval_assignment_events_admin on public.eval_assignment_events
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

revoke all on public.eval_assignment_overrides from anon;
revoke all on public.eval_assignment_events from anon;
