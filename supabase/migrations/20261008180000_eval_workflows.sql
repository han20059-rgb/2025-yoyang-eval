-- Linked workflows and AI review. Prepare only. Do not apply to production.

create table if not exists public.eval_workflows (
  id text primary key,
  payload jsonb not null,
  status text not null default 'candidate',
  original_id text,
  original_version text,
  file_hash text,
  reviewer_name text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_workflow_proposals (
  id text primary key,
  fingerprint text not null unique,
  kind text not null,
  payload jsonb not null,
  status text not null default 'open',
  sample boolean not null default false,
  decide_reason text not null default '',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_workflow_history (
  id text primary key,
  workflow_id text not null,
  action text not null,
  actor_name text,
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eval_workflow_proposals_status on public.eval_workflow_proposals (status);

alter table public.eval_workflows enable row level security;
alter table public.eval_workflow_proposals enable row level security;
alter table public.eval_workflow_history enable row level security;

revoke all on public.eval_workflows from anon, authenticated;
revoke all on public.eval_workflow_proposals from anon, authenticated;
revoke all on public.eval_workflow_history from anon, authenticated;
