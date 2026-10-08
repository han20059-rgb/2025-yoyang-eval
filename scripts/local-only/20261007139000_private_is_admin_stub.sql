-- Local-friendly stub. Production already has private.is_admin().
-- Staff admin for this app is eval_admins + leave_staff token, not JWT.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
as $$
  select false;
$$;
