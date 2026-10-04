create or replace function public.validate_official_exam_publish()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_expected_questions integer;
  v_expected_duration integer;
  v_expected_marks numeric;
  v_question_count integer := 0;
  v_question_marks numeric := 0;
  v_bad_marking integer := 0;
  v_valid_answer_keys integer := 0;
  v_valid_mapped_questions integer := 0;
  v_invalid_mapping_questions integer := 0;
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
  elsif new.exam_type in ('weekly','unit','monthly','grand') then
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

  with per_question as (
    select
      q.id,
      q.question_no,
      q.subject_label,
      q.unit_label,
      q.chapter_label,
      q.topic_label,
      count(m.question_id)::integer as canonical_rows,
      count(m.question_id) filter (where s.status='approved')::integer as approved_rows,
      max(u.subject) filter (where s.status='approved') as canonical_subject,
      (
        q.subject_label in ('Physics','Chemistry','Biology')
        and nullif(btrim(q.unit_label),'') is not null
        and nullif(btrim(q.chapter_label),'') is not null
        and nullif(btrim(q.topic_label),'') is not null
      ) as raw_ready
    from public.exam_questions q
    left join public.exam_question_syllabus_map m
      on m.question_id=q.id and m.exam_id=new.id
    left join public.neet_syllabus_subtopics s
      on s.id=m.subtopic_id
    left join public.neet_syllabus_topics t
      on t.id=s.chapter_id
    left join public.neet_syllabus_units u
      on u.id=t.unit_id
    where q.exam_id=new.id
    group by q.id,q.question_no,q.subject_label,q.unit_label,q.chapter_label,q.topic_label
  ),
  resolved as (
    select
      *,
      case
        when canonical_rows=1 and approved_rows=1 then canonical_subject
        when canonical_rows=0 and raw_ready then subject_label
        else null
      end as resolved_subject,
      case
        when canonical_rows=1 and approved_rows=1 then true
        when canonical_rows=0 and raw_ready then true
        else false
      end as mapping_ok
    from per_question
  )
  select
    count(*) filter (where mapping_ok)::integer,
    count(*) filter (where not mapping_ok)::integer,
    count(*) filter (where resolved_subject='Physics')::integer,
    count(*) filter (where resolved_subject='Chemistry')::integer,
    count(*) filter (where resolved_subject='Biology')::integer
  into v_valid_mapped_questions,v_invalid_mapping_questions,v_physics,v_chemistry,v_biology
  from resolved;

  if v_valid_mapped_questions<>v_question_count or v_invalid_mapping_questions>0 then
    raise exception 'Official exam requires exactly one approved canonical mapping OR complete Excel Subject/Unit/Chapter/Topic labels for every question';
  end if;

  if v_physics + v_chemistry + v_biology <> v_question_count then
    raise exception 'Official exam questions must resolve only to Physics, Chemistry or Biology';
  end if;

  if new.exam_type='daily' then
    if v_physics<>15 or v_chemistry<>15 or v_biology<>15 then
      raise exception 'Daily exam requires Physics 15, Chemistry 15 and Biology 15 questions';
    end if;
    if coalesce(new.physics_question_count,0)<>15
       or coalesce(new.chemistry_question_count,0)<>15
       or coalesce(new.biology_question_count,0)<>15 then
      raise exception 'Daily exam planned split must be Physics 15, Chemistry 15 and Biology 15';
    end if;
  elsif new.exam_type in ('weekly','unit','monthly','grand') then
    if v_physics<>45 or v_chemistry<>45 or v_biology<>90 then
      raise exception 'Weekly/Monthly/Grand exam requires Physics 45, Chemistry 45 and Biology 90 questions';
    end if;
    if coalesce(new.physics_question_count,0)<>45
       or coalesce(new.chemistry_question_count,0)<>45
       or coalesce(new.biology_question_count,0)<>90 then
      raise exception 'Weekly/Monthly/Grand planned split must be Physics 45, Chemistry 45 and Biology 90';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validate_official_exam_publish() is
  'Official exam publish guard: accepts one approved canonical syllabus mapping or complete raw Excel Subject/Unit/Chapter/Topic labels per question.';
