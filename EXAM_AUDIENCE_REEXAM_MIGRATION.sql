begin;

alter table public.exams
  add column if not exists audience_mode text not null default 'all';

alter table public.exams
  drop constraint if exists exams_audience_mode_check;
alter table public.exams
  add constraint exams_audience_mode_check
  check (audience_mode in ('all','selected'));

alter table public.exam_attempts
  add column if not exists attempt_no integer not null default 1;

alter table public.exam_attempts
  drop constraint if exists exam_attempts_attempt_no_check;
alter table public.exam_attempts
  add constraint exam_attempts_attempt_no_check
  check (attempt_no > 0);

alter table public.exam_attempts
  drop constraint if exists exam_attempts_exam_id_student_id_key;
alter table public.exam_attempts
  drop constraint if exists exam_attempts_exam_student_attempt_key;
alter table public.exam_attempts
  add constraint exam_attempts_exam_student_attempt_key
  unique (exam_id, student_id, attempt_no);

create table if not exists public.exam_student_assignments (
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  is_assigned boolean not null default true,
  max_attempts integer not null default 1 check (max_attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);

create index if not exists exam_student_assignments_student_idx
  on public.exam_student_assignments(student_id, is_assigned);

alter table public.exam_student_assignments enable row level security;
revoke all on table public.exam_student_assignments from anon, authenticated;
grant select, insert, update, delete on table public.exam_student_assignments to service_role;

insert into public.exam_student_assignments (
  exam_id, student_id, is_assigned, max_attempts
)
select
  e.id,
  p.id,
  true,
  greatest(1, coalesce(a.attempt_count, 0)::integer)
from public.exams e
cross join public.profiles p
left join (
  select exam_id, student_id, count(*)::integer as attempt_count
  from public.exam_attempts
  group by exam_id, student_id
) a on a.exam_id = e.id and a.student_id = p.id
where e.is_published = true
  and p.role = 'student'
  and p.is_active = true
on conflict (exam_id, student_id) do update
set is_assigned = true,
    max_attempts = greatest(public.exam_student_assignments.max_attempts, excluded.max_attempts),
    updated_at = now();

commit;
