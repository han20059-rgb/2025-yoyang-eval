-- Eval-app only. Do not replace private.is_admin(). Do not create eval_local_staff in production.

grant execute on function public.eval_is_staff_admin(bigint) to anon, authenticated;
grant execute on function public.eval_list_assignment_overrides(text) to anon, authenticated;
grant execute on function public.eval_save_assignment_change(text, integer, text, text[], text[], text[], text) to anon, authenticated;
grant execute on function public.eval_list_org_checks(text) to anon, authenticated;
grant execute on function public.eval_save_org_check(text, integer, text, text, boolean) to anon, authenticated;
