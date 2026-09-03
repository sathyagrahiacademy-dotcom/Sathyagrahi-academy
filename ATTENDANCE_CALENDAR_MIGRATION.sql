-- Sathyagrahi Academy Attendance Calendar migration
-- Run once on production Supabase before enabling the calendar UI.

create table if not exists public.academy_calendar_days (
  id uuid primary key default gen_random_uuid(),
  calendar_date date not null unique,
  day_type text not null check (day_type in ('holiday','working_day')),
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_calendar_days_calendar_date_idx
  on public.academy_calendar_days(calendar_date);

alter table public.academy_calendar_days enable row level security;

-- This project does not auto-grant CRUD privileges to authenticated on tables
-- created by the postgres role, so grants must be explicit for Data API access.
revoke all on table public.academy_calendar_days from anon;
grant select, insert, update, delete on table public.academy_calendar_days to authenticated;
grant select, insert, update, delete on table public.academy_calendar_days to service_role;

drop policy if exists "calendar_authenticated_read" on public.academy_calendar_days;
create policy "calendar_authenticated_read"
  on public.academy_calendar_days
  for select
  to authenticated
  using (true);

drop policy if exists "calendar_admin_insert" on public.academy_calendar_days;
create policy "calendar_admin_insert"
  on public.academy_calendar_days
  for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  ));

drop policy if exists "calendar_admin_update" on public.academy_calendar_days;
create policy "calendar_admin_update"
  on public.academy_calendar_days
  for update
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  ));

drop policy if exists "calendar_admin_delete" on public.academy_calendar_days;
create policy "calendar_admin_delete"
  on public.academy_calendar_days
  for delete
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  ));

-- Support Leave without changing existing rows.
alter table public.attendance
  drop constraint if exists attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present','absent','leave'));
