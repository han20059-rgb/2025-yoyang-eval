-- Situation board: optional staff_ids, optional reason, directives.
-- Prepare only. Do not apply to production from this change.

alter table public.eval_assignment_overrides
  add column if not exists staff_ids int[] not null default '{}';

alter table public.eval_assignment_overrides
  alter column reason set default '';

create table if not exists public.eval_directives (
  id uuid primary key default gen_random_uuid(),
  indicator_id int not null,
  mark text not null,
  target_roles text[] not null default '{}',
  target_staff_ids int[] not null default '{}',
  target_staff_names text[] not null default '{}',
  body text not null default '',
  due_on date,
  status text not null default 'open',
  author_name text not null default '',
  author_leave_record_id int,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eval_directives_crit on public.eval_directives (indicator_id, mark);

alter table public.eval_directives enable row level security;

revoke all on public.eval_directives from anon, authenticated;

create or replace function public.eval_save_assignment_change(
  token text,
  p_indicator_id int,
  p_mark text,
  p_roles text[],
  p_exclude_roles text[],
  p_staff_names text[],
  p_reason text,
  p_staff_ids int[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
  admin_ok boolean;
  before_roles text[];
  prev_recheck text[];
  after_roles text[];
  added text[];
  recheck text[];
  actor_name text;
  actor_id int;
begin
  select leave_staff_me(token) into ident;
  if ident is null or coalesce((ident->>'ok')::boolean, false) is not true then
    raise exception 'unauthorized';
  end if;
  actor_id := coalesce((ident->>'leaveRecordId')::int, 0);
  actor_name := coalesce((select jsonb_object_keys(ident->'records') limit 1), '');
  select public.eval_is_staff_admin(actor_id) into admin_ok;
  if admin_ok is not true then
    raise exception 'forbidden';
  end if;
  after_roles := coalesce(p_roles, '{}');
  select roles, recheck_roles into before_roles, prev_recheck
    from eval_assignment_overrides
    where indicator_id = p_indicator_id and mark = p_mark;
  before_roles := coalesce(before_roles, '{}');
  prev_recheck := coalesce(prev_recheck, '{}');
  added := array(select unnest(after_roles) except select unnest(before_roles));
  recheck := array(select distinct x from unnest(prev_recheck || added) as x where x = any(after_roles));
  insert into eval_assignment_overrides(
    indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, staff_ids, reason, actor_name, actor_leave_record_id, updated_at
  ) values (
    p_indicator_id, p_mark, after_roles, coalesce(p_exclude_roles, '{}'), recheck,
    coalesce(p_staff_names, '{}'), coalesce(p_staff_ids, '{}'), coalesce(p_reason, ''), actor_name, actor_id, now()
  )
  on conflict (indicator_id, mark) do update set
    roles = excluded.roles,
    exclude_roles = excluded.exclude_roles,
    recheck_roles = excluded.recheck_roles,
    staff_names = excluded.staff_names,
    staff_ids = excluded.staff_ids,
    reason = excluded.reason,
    actor_name = excluded.actor_name,
    actor_leave_record_id = excluded.actor_leave_record_id,
    updated_at = now();
  insert into eval_assignment_events(indicator_id, mark, before_roles, after_roles, reason, actor_name, actor_leave_record_id, as_admin)
  values (p_indicator_id, p_mark, before_roles, after_roles, coalesce(p_reason, ''), actor_name, actor_id, true);
  return jsonb_build_object('ok', true, 'before', to_jsonb(before_roles), 'after', to_jsonb(after_roles));
end;
$$;

grant execute on function public.eval_save_assignment_change(text, integer, text, text[], text[], text[], text, int[]) to anon, authenticated;

create or replace function public.eval_list_directives(token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
  actor_id int;
  admin_ok boolean;
  role_id text;
begin
  select leave_staff_me(token) into ident;
  if ident is null or coalesce((ident->>'ok')::boolean, false) is not true then
    raise exception 'unauthorized';
  end if;
  actor_id := coalesce((ident->>'leaveRecordId')::int, 0);
  select public.eval_is_staff_admin(actor_id) into admin_ok;
  if admin_ok is true then
    return coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from eval_directives d), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(d) order by d.created_at desc)
    from eval_directives d
    where actor_id = any(d.target_staff_ids)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.eval_create_directive(
  token text,
  p_indicator_id int,
  p_mark text,
  p_target_roles text[],
  p_target_staff_ids int[],
  p_target_staff_names text[],
  p_body text,
  p_due date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
  actor_id int;
  actor_name text;
  admin_ok boolean;
  row_id uuid;
begin
  select leave_staff_me(token) into ident;
  if ident is null or coalesce((ident->>'ok')::boolean, false) is not true then
    raise exception 'unauthorized';
  end if;
  actor_id := coalesce((ident->>'leaveRecordId')::int, 0);
  actor_name := coalesce((select jsonb_object_keys(ident->'records') limit 1), '');
  select public.eval_is_staff_admin(actor_id) into admin_ok;
  if admin_ok is not true then
    raise exception 'forbidden';
  end if;
  if coalesce(p_body, '') = '' then
    raise exception 'empty';
  end if;
  if coalesce(array_length(p_target_roles, 1), 0) = 0 and coalesce(array_length(p_target_staff_ids, 1), 0) = 0 then
    raise exception 'no_target';
  end if;
  insert into eval_directives(
    indicator_id, mark, target_roles, target_staff_ids, target_staff_names, body, due_on, author_name, author_leave_record_id
  ) values (
    p_indicator_id, p_mark, coalesce(p_target_roles, '{}'), coalesce(p_target_staff_ids, '{}'),
    coalesce(p_target_staff_names, '{}'), p_body, p_due, actor_name, actor_id
  ) returning id into row_id;
  return jsonb_build_object('ok', true, 'id', row_id);
end;
$$;

create or replace function public.eval_update_directive_status(
  token text,
  p_id uuid,
  p_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
  actor_id int;
  actor_name text;
  admin_ok boolean;
  d eval_directives%rowtype;
  note jsonb;
begin
  if p_status not in ('open', 'doing', 'done') then
    raise exception 'bad_status';
  end if;
  select leave_staff_me(token) into ident;
  if ident is null or coalesce((ident->>'ok')::boolean, false) is not true then
    raise exception 'unauthorized';
  end if;
  actor_id := coalesce((ident->>'leaveRecordId')::int, 0);
  actor_name := coalesce((select jsonb_object_keys(ident->'records') limit 1), '');
  select public.eval_is_staff_admin(actor_id) into admin_ok;
  select * into d from eval_directives where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  if admin_ok is not true and actor_id <> all(coalesce(d.target_staff_ids, '{}')) then
    raise exception 'forbidden';
  end if;
  note := jsonb_build_object(
    'at', now(),
    'actorName', actor_name,
    'actorId', actor_id,
    'text', coalesce(p_note, ''),
    'status', p_status
  );
  update eval_directives
    set status = p_status, notes = coalesce(notes, '[]'::jsonb) || note, updated_at = now()
    where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.eval_list_directives(text) to anon, authenticated;
grant execute on function public.eval_create_directive(text, integer, text, text[], int[], text[], text, date) to anon, authenticated;
grant execute on function public.eval_update_directive_status(text, uuid, text, text) to anon, authenticated;
