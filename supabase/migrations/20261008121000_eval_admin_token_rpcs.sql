-- Eval-app admin list/grant via staff token. Production already has these functions.

grant execute on function public.eval_list_admins(text) to anon, authenticated;
grant execute on function public.eval_set_admin(text, bigint, text, text) to anon, authenticated;
