create schema if not exists storage;
create schema if not exists auth;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
create table if not exists auth.users (id uuid primary key);
