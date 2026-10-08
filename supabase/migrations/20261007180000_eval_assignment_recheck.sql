-- Recheck + exclude overlay. Not applied to production in this task.

alter table public.eval_assignment_overrides
  add column if not exists exclude_roles text[] not null default '{}',
  add column if not exists recheck_roles text[] not null default '{}';
