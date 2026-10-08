do $$
begin
  begin
    create role authenticated nologin;
  exception when duplicate_object then null;
  end;
  begin
    create role anon nologin;
  exception when duplicate_object then null;
  end;
end
$$;
