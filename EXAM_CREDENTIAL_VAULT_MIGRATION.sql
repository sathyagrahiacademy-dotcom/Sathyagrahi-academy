create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.exam_credentials (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  ciphertext text not null check (length(ciphertext) > 0),
  iv text not null check (length(iv) > 0),
  key_version smallint not null default 1 check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null
);

alter table private.exam_credentials enable row level security;

revoke all on table private.exam_credentials from public, anon, authenticated;
grant select, insert, update on table private.exam_credentials to service_role;

create or replace function public.upsert_exam_credential_v1(
  p_exam_id uuid,
  p_exam_code text,
  p_password_hash text,
  p_ciphertext text,
  p_iv text,
  p_key_version smallint,
  p_updated_by uuid
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if p_exam_id is null then
    raise exception 'Exam ID is required';
  end if;
  if nullif(btrim(p_exam_code), '') is null then
    raise exception 'Exam Code is required';
  end if;
  if nullif(btrim(p_password_hash), '') is null then
    raise exception 'Password hash is required';
  end if;
  if nullif(btrim(p_ciphertext), '') is null or nullif(btrim(p_iv), '') is null then
    raise exception 'Encrypted credential is required';
  end if;
  if p_key_version is null or p_key_version <= 0 then
    raise exception 'Key version must be positive';
  end if;
  if p_updated_by is null then
    raise exception 'Updated by is required';
  end if;

  insert into public.exam_access (exam_id, exam_code, password_hash)
  values (p_exam_id, upper(btrim(p_exam_code)), p_password_hash)
  on conflict (exam_id) do update
    set exam_code = excluded.exam_code,
        password_hash = excluded.password_hash;

  insert into private.exam_credentials (
    exam_id,
    ciphertext,
    iv,
    key_version,
    updated_by
  ) values (
    p_exam_id,
    p_ciphertext,
    p_iv,
    p_key_version,
    p_updated_by
  )
  on conflict (exam_id) do update
    set ciphertext = excluded.ciphertext,
        iv = excluded.iv,
        key_version = excluded.key_version,
        updated_at = now(),
        updated_by = excluded.updated_by;
end;
$$;

create or replace function public.get_exam_credential_v1(
  p_exam_id uuid
) returns table(
  ciphertext text,
  iv text,
  key_version smallint
)
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select c.ciphertext, c.iv, c.key_version
  from private.exam_credentials c
  where c.exam_id = p_exam_id;
$$;

revoke all on function public.upsert_exam_credential_v1(uuid,text,text,text,text,smallint,uuid) from public, anon, authenticated;
grant execute on function public.upsert_exam_credential_v1(uuid,text,text,text,text,smallint,uuid) to service_role;

revoke all on function public.get_exam_credential_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_exam_credential_v1(uuid) to service_role;
