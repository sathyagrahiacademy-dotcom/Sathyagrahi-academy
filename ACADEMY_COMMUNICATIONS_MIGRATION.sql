begin;

create table if not exists public.academy_communication_settings (
  id smallint primary key default 1 check (id = 1),
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  morning_plan_enabled boolean not null default false,
  exam_published_enabled boolean not null default false,
  result_performance_enabled boolean not null default false,
  morning_send_time time not null default '07:00:00',
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamp with time zone not null default now()
);

insert into public.academy_communication_settings (id)
values (1)
on conflict (id) do nothing;

create index if not exists academy_communication_settings_updated_by_idx
  on public.academy_communication_settings (updated_by);

create table if not exists public.academy_communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('morning_plan','exam_published','result_published','test_email','test_whatsapp')),
  event_key text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  recipient_masked text,
  provider text not null check (provider in ('resend','meta_whatsapp')),
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  failure_reason text,
  attempted_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_key, student_id, channel)
);

create index if not exists academy_communication_deliveries_student_idx
  on public.academy_communication_deliveries (student_id, created_at desc);

create index if not exists academy_communication_deliveries_status_idx
  on public.academy_communication_deliveries (status, created_at desc);

create index if not exists academy_communication_deliveries_event_idx
  on public.academy_communication_deliveries (event_type, created_at desc);

alter table public.academy_communication_settings enable row level security;
alter table public.academy_communication_deliveries enable row level security;

revoke all on table public.academy_communication_settings from anon, authenticated;
revoke all on table public.academy_communication_deliveries from anon, authenticated;

grant select, insert, update, delete on table public.academy_communication_settings to service_role;
grant select, insert, update, delete on table public.academy_communication_deliveries to service_role;

commit;
