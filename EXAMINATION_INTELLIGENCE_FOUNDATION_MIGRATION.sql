begin;

alter table public.exams
  add column if not exists exam_type text,
  add column if not exists exam_date date,
  add column if not exists expected_questions integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.exams'::regclass
      and conname='exams_intelligence_type_check'
  ) then
    alter table public.exams
      add constraint exams_intelligence_type_check
      check (exam_type is null or exam_type in ('daily','unit','monthly'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.exams'::regclass
      and conname='exams_intelligence_metadata_check'
  ) then
    alter table public.exams
      add constraint exams_intelligence_metadata_check
      check (
        (exam_type is null and exam_date is null and expected_questions is null)
        or
        (
          exam_type is not null
          and exam_date is not null
          and expected_questions = case
            when exam_type='daily' then 45
            when exam_type in ('unit','monthly') then 180
            else null
          end
        )
      );
  end if;
end $$;

create index if not exists exams_type_date_idx
  on public.exams (exam_type, exam_date desc)
  where exam_type is not null;

create table if not exists public.exam_code_counters (
  exam_type text not null check (exam_type in ('daily','unit','monthly')),
  exam_date date not null,
  last_sequence integer not null default 0 check (last_sequence between 0 and 999),
  updated_at timestamp with time zone not null default now(),
  primary key (exam_type, exam_date)
);

alter table public.exam_code_counters enable row level security;
revoke all on table public.exam_code_counters from public;
revoke all on table public.exam_code_counters from anon, authenticated;
grant select, insert, update, delete on table public.exam_code_counters to service_role;

create or replace function public.allocate_exam_code(
  p_exam_type text,
  p_exam_date date
)
returns text
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_type text := lower(trim(coalesce(p_exam_type,'')));
  v_prefix text;
  v_sequence integer;
begin
  if p_exam_date is null then
    raise exception 'Exam date is required';
  end if;

  v_prefix := case v_type
    when 'daily' then 'DLY'
    when 'unit' then 'UNT'
    when 'monthly' then 'MON'
    else null
  end;

  if v_prefix is null then
    raise exception 'Invalid exam type';
  end if;

  insert into public.exam_code_counters(exam_type, exam_date, last_sequence, updated_at)
  values (v_type, p_exam_date, 1, now())
  on conflict (exam_type, exam_date) do update
    set last_sequence = public.exam_code_counters.last_sequence + 1,
        updated_at = now()
  returning last_sequence into v_sequence;

  if v_sequence < 1 or v_sequence > 999 then
    raise exception 'Exam code sequence exhausted for % on %', v_type, p_exam_date;
  end if;

  return 'SGA-' || v_prefix || '-' || to_char(p_exam_date,'YYYYMMDD') || '-' || lpad(v_sequence::text,3,'0');
end;
$$;

revoke all on function public.allocate_exam_code(text,date) from public;
revoke all on function public.allocate_exam_code(text,date) from anon, authenticated;
grant execute on function public.allocate_exam_code(text,date) to service_role;

create table if not exists public.exam_question_activity (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  visit_count integer not null default 0 check (visit_count >= 0),
  answer_change_count integer not null default 0 check (answer_change_count >= 0),
  first_viewed_at timestamp with time zone,
  last_viewed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists exam_question_activity_attempt_idx
  on public.exam_question_activity (attempt_id);
create index if not exists exam_question_activity_question_idx
  on public.exam_question_activity (question_id);

alter table public.exam_question_activity enable row level security;
revoke all on table public.exam_question_activity from public;
revoke all on table public.exam_question_activity from anon, authenticated;
grant select, insert, update, delete on table public.exam_question_activity to service_role;

create table if not exists public.exam_question_activity_events (
  event_id uuid primary key,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  active_seconds_delta integer not null default 0 check (active_seconds_delta between 0 and 300),
  visit_delta integer not null default 0 check (visit_delta between 0 and 10),
  answer_change_delta integer not null default 0 check (answer_change_delta between 0 and 10),
  viewed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create index if not exists exam_question_activity_events_attempt_idx
  on public.exam_question_activity_events (attempt_id);
create index if not exists exam_question_activity_events_question_idx
  on public.exam_question_activity_events (question_id);

alter table public.exam_question_activity_events enable row level security;
revoke all on table public.exam_question_activity_events from public;
revoke all on table public.exam_question_activity_events from anon, authenticated;
grant select, insert, update, delete on table public.exam_question_activity_events to service_role;

create or replace function public.record_exam_question_activity(
  p_event_id uuid,
  p_attempt_id uuid,
  p_question_id uuid,
  p_active_seconds_delta integer,
  p_visit_delta integer,
  p_answer_change_delta integer,
  p_viewed_at timestamp with time zone
)
returns boolean
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_rows integer := 0;
  v_valid boolean := false;
  v_viewed_at timestamp with time zone := coalesce(p_viewed_at,now());
begin
  if p_event_id is null or p_attempt_id is null or p_question_id is null then
    raise exception 'Activity event, attempt and question are required';
  end if;
  if coalesce(p_active_seconds_delta,-1) < 0 or p_active_seconds_delta > 300 then
    raise exception 'Invalid active time delta';
  end if;
  if coalesce(p_visit_delta,-1) < 0 or p_visit_delta > 10 then
    raise exception 'Invalid visit delta';
  end if;
  if coalesce(p_answer_change_delta,-1) < 0 or p_answer_change_delta > 10 then
    raise exception 'Invalid answer change delta';
  end if;

  select exists(
    select 1
    from public.exam_attempts a
    join public.exam_questions q on q.exam_id=a.exam_id
    where a.id=p_attempt_id and q.id=p_question_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Question does not belong to attempt exam';
  end if;

  insert into public.exam_question_activity_events(
    event_id,attempt_id,question_id,active_seconds_delta,visit_delta,answer_change_delta,viewed_at
  ) values (
    p_event_id,p_attempt_id,p_question_id,p_active_seconds_delta,p_visit_delta,p_answer_change_delta,v_viewed_at
  )
  on conflict (event_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows=0 then
    return false;
  end if;

  insert into public.exam_question_activity(
    attempt_id,question_id,active_seconds,visit_count,answer_change_count,first_viewed_at,last_viewed_at,updated_at
  ) values (
    p_attempt_id,p_question_id,p_active_seconds_delta,p_visit_delta,p_answer_change_delta,v_viewed_at,v_viewed_at,now()
  )
  on conflict (attempt_id,question_id) do update
    set active_seconds=public.exam_question_activity.active_seconds + excluded.active_seconds,
        visit_count=public.exam_question_activity.visit_count + excluded.visit_count,
        answer_change_count=public.exam_question_activity.answer_change_count + excluded.answer_change_count,
        first_viewed_at=coalesce(public.exam_question_activity.first_viewed_at,excluded.first_viewed_at),
        last_viewed_at=greatest(coalesce(public.exam_question_activity.last_viewed_at,excluded.last_viewed_at),excluded.last_viewed_at),
        updated_at=now();

  return true;
end;
$$;

revoke all on function public.record_exam_question_activity(uuid,uuid,uuid,integer,integer,integer,timestamp with time zone) from public;
revoke all on function public.record_exam_question_activity(uuid,uuid,uuid,integer,integer,integer,timestamp with time zone) from anon, authenticated;
grant execute on function public.record_exam_question_activity(uuid,uuid,uuid,integer,integer,integer,timestamp with time zone) to service_role;

commit;
