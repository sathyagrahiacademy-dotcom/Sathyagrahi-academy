-- Secure 07:00 Asia/Kolkata scheduler for Sathyagrahi Academy Morning Study Plan.
-- pg_cron schedules are UTC, therefore 07:00 IST = 01:30 UTC.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
begin
  if not exists (select 1 from vault.secrets where name='academy_project_url') then
    perform vault.create_secret('https://lzclqifnylbyftwzpbxy.supabase.co','academy_project_url','SGA production Supabase project URL');
  end if;
  if not exists (select 1 from vault.secrets where name='academy_morning_cron_key') then
    perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'academy_morning_cron_key','Server-only key for SGA morning cron');
  end if;
end $$;

create or replace function public.verify_academy_morning_cron_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select coalesce(
    length(btrim(p_key)) > 0
    and p_key = (select decrypted_secret from vault.decrypted_secrets where name='academy_morning_cron_key' limit 1),
    false
  );
$$;

revoke all on function public.verify_academy_morning_cron_key(text) from public, anon, authenticated;
grant execute on function public.verify_academy_morning_cron_key(text) to service_role;

select cron.schedule(
  'sga-morning-study-plan-email',
  '30 1 * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='academy_project_url' limit 1) || '/functions/v1/academy-morning-cron',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-sga-cron-key',(select decrypted_secret from vault.decrypted_secrets where name='academy_morning_cron_key' limit 1)
      ),
      body := jsonb_build_object('source','cron','scheduled_at',now()),
      timeout_milliseconds := 30000
    ) as request_id;
  $cron$
);
