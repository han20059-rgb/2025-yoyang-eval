-- Already applied on the linked eval production database (2026-10-13).
-- Reproduce: first assign / role change does not create or accumulate recheck_roles.
-- Existing recheck_roles that remain in after_roles are kept. Assignment rows and events stay.
-- Signature stays 7 arguments. Do not apply other functions from this file.

create or replace function public.eval_save_assignment_change(
  token text,
  p_indicator_id integer,
  p_mark text,
  p_roles text[],
  p_exclude_roles text[],
  p_staff_names text[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me jsonb;
  leave_id bigint;
  actor text;
  prev_roles text[];
  prev_recheck text[];
  after_roles text[];
  recheck text[];
begin
  me := public.leave_staff_me(token);
  if coalesce(me->>'ok','') <> 'true' then
    raise exception 'unauthorized';
  end if;
  leave_id := coalesce((me->>'leaveRecordId')::bigint, 0);
  if not public.eval_is_staff_admin(leave_id) then
    raise exception 'forbidden';
  end if;
  actor := coalesce((select jsonb_object_keys(me->'records') limit 1), '관리자');
  select o.roles, o.recheck_roles into prev_roles, prev_recheck
    from public.eval_assignment_overrides o
    where o.indicator_id = p_indicator_id and o.mark = p_mark;
  prev_roles := coalesce(prev_roles, '{}');
  prev_recheck := coalesce(prev_recheck, '{}');
  after_roles := coalesce(p_roles, '{}');
  recheck := (
    select coalesce(array_agg(v), '{}')
    from (
      select v from unnest(prev_recheck) as t(v) where v = any(after_roles)
    ) s
  );
  insert into public.eval_assignment_overrides(
    indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, actor_leave_record_id, updated_at
  ) values (
    p_indicator_id, p_mark, after_roles, coalesce(p_exclude_roles,'{}'), recheck, coalesce(p_staff_names,'{}'), coalesce(p_reason,''), actor, leave_id, now()
  )
  on conflict (indicator_id, mark) do update set
    roles = excluded.roles,
    exclude_roles = excluded.exclude_roles,
    recheck_roles = excluded.recheck_roles,
    staff_names = excluded.staff_names,
    reason = excluded.reason,
    actor_name = excluded.actor_name,
    actor_leave_record_id = excluded.actor_leave_record_id,
    updated_at = now();
  insert into public.eval_assignment_events(
    indicator_id, mark, before_roles, after_roles, reason, actor_name, actor_leave_record_id, as_admin
  ) values (
    p_indicator_id, p_mark, prev_roles, after_roles, coalesce(p_reason,''), actor, leave_id, true
  );
  return jsonb_build_object('ok', true, 'before', to_jsonb(prev_roles), 'after', to_jsonb(after_roles));
end;
$$;

grant execute on function public.eval_save_assignment_change(text, integer, text, text[], text[], text[], text) to anon, authenticated;
