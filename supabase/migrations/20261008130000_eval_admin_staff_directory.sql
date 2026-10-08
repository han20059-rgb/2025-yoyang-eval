-- Eval-app admin staff directory. Reads leave_records names/jobs only. Does not change passwords or leave balances.

grant execute on function public.eval_list_staff_directory(text) to anon, authenticated;
grant execute on function public.eval_list_admin_events(text) to anon, authenticated;
