begin;

-- SGA Examinations Master Architecture foundation.
-- Additive/compatibility migration only. Historical attempts, responses,
-- results, performance, snapshots and credentials are not rewritten.

alter table public.exams
  add column if not exists batch_no smallint,
  add column if not exists result_publish_mode text not null default 'manual',
  add column if not exists result_publish_at timestamp with time zone,
  add column if not exists new_starts_closed_at timestamp with time zone,
  add column if not exists blueprint_approved_at timestamp with time zone,
  add column if not exists archived_at timestamp with time zone;

-- Replace the older Daily/Unit/Monthly-only metadata constraints with
-- compatibility-safe constraints for the approved DT/WT/MT/GT model.
-- `unit` remains accepted here only so historical rows continue to validate.
alter table public.exams drop constraint if exists exams_intelligence_type_check;
alter table public.exams drop constraint if exists exams_intelligence_metadata_check;
alter table public.exams drop constraint if exists exams_master_type_compat_check;
alter table public.exams drop constraint if exists exams_master_batch_check;
alter table public.exams drop constraint if exists exams_master_result_mode_check;
alter table public.exams drop constraint if exists exams_master_positive_metadata_check;

alter table public.exams
  add constraint exams_master_type_compat_check
    check (exam_type is null or exam_type in ('daily','weekly','monthly','grand','unit')),
  add constraint exams_master_batch_check
    check (batch_no is null or batch_no between 1 and 99),
  add constraint exams_master_result_mode_check
    check (result_publish_mode in ('manual','scheduled')),
  add constraint exams_master_positive_metadata_check
    check (
      (expected_questions is null or expected_questions>0)
      and duration_minutes>0
      and total_marks>0
    );

create index if not exists exams_master_date_batch_idx
  on public.exams (exam_date desc,batch_no)
  where exam_date is not null;

create index if not exists exams_master_archive_idx
  on public.exams (archived_at)
  where archived_at is not null;

create index if not exists exams_master_result_release_idx
  on public.exams (result_publish_mode,result_publish_at)
  where result_publish_at is not null;

-- Final master-code allocator. Phase 2 will switch official new-exam creation
-- to this function after the six-step wizard and server contract are green.
-- The older allocate_exam_code/exam_code_counters remain untouched meanwhile.
create or replace function public.allocate_exam_code_v2(
  p_exam_type text,
  p_batch_no integer,
  p_exam_date date
)
returns text
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_type text := lower(btrim(coalesce(p_exam_type,'')));
  v_prefix text;
  v_code text;
begin
  if p_exam_date is null then
    raise exception 'Exam date is required';
  end if;

  if p_batch_no is null or p_batch_no<1 or p_batch_no>99 then
    raise exception 'Batch must be 1 to 99';
  end if;

  v_prefix := case v_type
    when 'daily' then 'DT'
    when 'weekly' then 'WT'
    when 'monthly' then 'MT'
    when 'grand' then 'GT'
    else null
  end;

  if v_prefix is null then
    raise exception 'Invalid exam type';
  end if;

  v_code := 'SGA-'||v_prefix||'-'||lpad(p_batch_no::text,2,'0')||to_char(p_exam_date,'DDMM');

  if exists(select 1 from public.exam_access where exam_code=v_code) then
    raise exception 'Exam code already exists: %',v_code;
  end if;

  return v_code;
end;
$$;

revoke all on function public.allocate_exam_code_v2(text,integer,date) from public,anon,authenticated;
grant execute on function public.allocate_exam_code_v2(text,integer,date) to service_role;

commit;
