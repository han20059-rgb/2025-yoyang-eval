-- Manual file editions for 2025-yoyang-eval.
-- Not applied to production in this task. Existing eval_progress and other app tables are untouched.

create table if not exists public.eval_manual_editions (
  id uuid primary key default gen_random_uuid(),
  eval_year int,
  doc_kind text not null default '시설급여 평가매뉴얼',
  published_on date,
  applied_on date,
  source text not null default '',
  edition_kind text not null check (edition_kind in ('original', 'revision')),
  parent_id uuid references public.eval_manual_editions(id),
  eval_cycle_note text not null default '',
  status text not null default 'draft' check (status in ('draft', 'reviewing', 'approved_pending_expose', 'exposed', 'rolled_back')),
  expose_to_staff boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.eval_manual_files (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.eval_manual_editions(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'hwp')),
  file_name text not null,
  storage_path text not null,
  byte_size int not null default 0,
  created_at timestamptz not null default now(),
  unique (edition_id, kind)
);

create table if not exists public.eval_manual_extracts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.eval_manual_editions(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'hwp')),
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (edition_id, kind)
);

create table if not exists public.eval_manual_reviews (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.eval_manual_editions(id) on delete cascade,
  compare jsonb not null default '{}'::jsonb,
  revision jsonb not null default '{}'::jsonb,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.eval_manual_editions enable row level security;
alter table public.eval_manual_files enable row level security;
alter table public.eval_manual_extracts enable row level security;
alter table public.eval_manual_reviews enable row level security;

create policy eval_manual_editions_admin on public.eval_manual_editions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy eval_manual_files_admin on public.eval_manual_files
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy eval_manual_extracts_admin on public.eval_manual_extracts
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy eval_manual_reviews_admin on public.eval_manual_reviews
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

insert into storage.buckets (id, name, public)
values ('eval-manuals', 'eval-manuals', false)
on conflict (id) do nothing;

create policy eval_manuals_storage_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'eval-manuals' and private.is_admin())
  with check (bucket_id = 'eval-manuals' and private.is_admin());
