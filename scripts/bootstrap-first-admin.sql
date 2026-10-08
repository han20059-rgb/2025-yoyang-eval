-- First eval admin. Do not run against production in this task.
-- Identified staff: leave_records.id = 64, name 한태수, jobType 2.사무국장 (unique).
-- Apply only after eval_admins exists on the intended database.

insert into public.eval_admins (leave_record_id, name_snapshot, granted_by_leave_record_id, active)
values (64, '한태수', 64, true)
on conflict (leave_record_id) do update
  set active = true, name_snapshot = excluded.name_snapshot;

insert into public.eval_admin_events (target_leave_record_id, actor_leave_record_id, action, note)
values (64, 64, 'bootstrap', '최초 관리자 한태수 leave_record_id=64');
