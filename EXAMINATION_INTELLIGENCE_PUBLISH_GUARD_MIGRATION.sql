begin;

-- Database-authoritative guard for official academy exams.
-- Legacy exams (exam_type is null) intentionally keep the pre-existing publish behavior.
create or replace function public.validate_official_exam_publish()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_expected_questions integer;
  v_expected_duration integer;
  v_expected_marks numeric;
  v_question_count integer := 0;
  v_question_marks numeric := 0;
  v_bad_marking integer := 0;
  v_valid_answer_keys integer := 0;
  v_mapping_rows integer := 0;
  v_mapped_questions integer := 0;
  v_physics integer := 0;
  v_chemistry integer := 0;
  v_biology integer := 0;
begin
  if not coalesce(new.is_published,false) then
    return new;
  end if;

  if new.exam_type is null then
    return new;
  end if;

  if new.exam_type='daily' then
    v_expected_questions := 45;
    v_expected_duration := 45;
    v_expected_marks := 180;
  elsif new.exam_type in ('unit','monthly') then
    v_expected_questions := 180;
    v_expected_duration := 180;
    v_expected_marks := 720;
  else
    raise exception 'Official exam has invalid Exam Type';
  end if;

  if new.expected_questions is distinct from v_expected_questions then
    raise exception 'Official % exam requires % expected questions',new.exam_type,v_expected_questions;
  end if;
  if new.duration_minutes is distinct from v_expected_duration then
    raise exception 'Official % exam requires % minutes',new.exam_type,v_expected_duration;
  end if;
  if new.total_marks is distinct from v_expected_marks then
    raise exception 'Official % exam requires % total marks',new.exam_type,v_expected_marks;
  end if;
  if coalesce(new.negative_marking,false) is not true then
    raise exception 'Official exam requires negative marking';
  end if;

  select
    count(*)::integer,
    coalesce(sum(q.marks),0),
    count(*) filter (where q.marks is distinct from 4 or q.negative_marks is distinct from 1)::integer
  into v_question_count,v_question_marks,v_bad_marking
  from public.exam_questions q
  where q.exam_id=new.id;

  if v_question_count<>v_expected_questions then
    raise exception 'Official % exam requires exactly % questions; found %',new.exam_type,v_expected_questions,v_question_count;
  end if;
  if v_question_marks<>v_expected_marks then
    raise exception 'Official exam question marks total must be %; found %',v_expected_marks,v_question_marks;
  end if;
  if v_bad_marking>0 then
    raise exception 'Official exam questions must use +4 / -1 marking';
  end if;

  select count(*)::integer
  into v_valid_answer_keys
  from public.exam_questions q
  join public.exam_answer_keys k on k.question_id=q.id and k.correct_option in ('A','B','C','D')
  where q.exam_id=new.id;

  if v_valid_answer_keys<>v_question_count then
    raise exception 'Official exam requires one valid answer key for every question';
  end if;

  select
    count(*)::integer,
    count(distinct q.id)::integer,
    count(distinct q.id) filter (where u.subject='Physics')::integer,
    count(distinct q.id) filter (where u.subject='Chemistry')::integer,
    count(distinct q.id) filter (where u.subject='Biology')::integer
  into v_mapping_rows,v_mapped_questions,v_physics,v_chemistry,v_biology
  from public.exam_questions q
  join public.exam_question_syllabus_map m
    on m.question_id=q.id and m.exam_id=new.id
  join public.neet_syllabus_subtopics s
    on s.id=m.subtopic_id and s.status='approved'
  join public.neet_syllabus_topics t
    on t.id=s.chapter_id
  join public.neet_syllabus_units u
    on u.id=t.unit_id
  where q.exam_id=new.id;

  if v_mapped_questions<>v_question_count or v_mapping_rows<>v_question_count then
    raise exception 'Official exam requires exactly one approved syllabus mapping for every question';
  end if;

  if new.exam_type in ('unit','monthly') then
    if new.subject<>'NEET' then
      raise exception 'Unit/Monthly official exam subject must be NEET';
    end if;
    if v_physics<>45 or v_chemistry<>45 or v_biology<>90 then
      raise exception 'Unit/Monthly exam requires Physics 45, Chemistry 45 and Biology 90 questions';
    end if;
  elsif new.exam_type='daily' then
    if new.subject='Physics' and not (v_physics=45 and v_chemistry=0 and v_biology=0) then
      raise exception 'Daily Physics exam requires all 45 questions from Physics';
    elsif new.subject='Chemistry' and not (v_physics=0 and v_chemistry=45 and v_biology=0) then
      raise exception 'Daily Chemistry exam requires all 45 questions from Chemistry';
    elsif new.subject='Biology' and not (v_physics=0 and v_chemistry=0 and v_biology=45) then
      raise exception 'Daily Biology exam requires all 45 questions from Biology';
    elsif new.subject not in ('Physics','Chemistry','Biology','Mixed','NEET') then
      raise exception 'Daily exam has invalid Subject';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_official_exam_publish() from public;
revoke all on function public.validate_official_exam_publish() from anon, authenticated;

drop trigger if exists exams_official_publish_guard on public.exams;
create trigger exams_official_publish_guard
before update of is_published on public.exams
for each row
when (new.is_published is true)
execute function public.validate_official_exam_publish();

commit;
