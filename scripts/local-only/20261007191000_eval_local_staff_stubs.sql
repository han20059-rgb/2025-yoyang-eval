-- Virtual staff for isolated local Supabase only.
-- If production leave_staff_login exists, this migration does nothing.

create extension if not exists pgcrypto;

create table if not exists public.eval_local_staff (
  leave_record_id bigint primary key,
  name text not null,
  yymmdd text not null,
  pw text not null,
  job_type text not null default ''
);

create table if not exists public.eval_local_staff_tokens (
  token text primary key,
  leave_record_id bigint not null references public.eval_local_staff(leave_record_id),
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'leave_staff_login'
  ) then
    return;
  end if;

  execute $fn$
    create function public.leave_staff_login(yymmdd text, pw text, remember boolean)
    returns json
    language plpgsql
    as $body$
    declare
      rec public.eval_local_staff%rowtype;
      tok text;
    begin
      select * into rec from public.eval_local_staff s
        where s.yymmdd = leave_staff_login.yymmdd and s.pw = leave_staff_login.pw;
      if not found then
        return json_build_object('ok', false, 'error', '로그인에 실패했습니다.');
      end if;
      tok := encode(gen_random_bytes(24), 'hex');
      insert into public.eval_local_staff_tokens(token, leave_record_id) values (tok, rec.leave_record_id);
      return json_build_object('ok', true, 'token', tok, 'mustChange', false, 'remember', remember);
    end;
    $body$;
  $fn$;

  execute $fn$
    create function public.leave_staff_me(token text)
    returns json
    language plpgsql
    as $body$
    declare
      rec public.eval_local_staff%rowtype;
      recs json;
    begin
      select s.* into rec
        from public.eval_local_staff_tokens t
        join public.eval_local_staff s on s.leave_record_id = t.leave_record_id
        where t.token = leave_staff_me.token;
      if not found then
        return json_build_object('ok', false, 'error', '로그인이 만료되었습니다.');
      end if;
      recs := json_build_object(rec.name, json_build_object('jobType', rec.job_type));
      return json_build_object('ok', true, 'leaveRecordId', rec.leave_record_id, 'records', recs);
    end;
    $body$;
  $fn$;

  insert into public.eval_local_staff (leave_record_id, name, yymmdd, pw, job_type)
  values
    (900001, '한태수(가상)', '800101', 'local-eval-test', '2.사무국장'),
    (900002, '일반직원(가상)', '900202', 'local-eval-test', '3.사회복지사')
  on conflict (leave_record_id) do nothing;

  insert into public.eval_admins (leave_record_id, name_snapshot, granted_by_leave_record_id, active)
  values (900001, '한태수(가상)', 900001, true)
  on conflict (leave_record_id) do nothing;
end
$$;
