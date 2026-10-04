alter table public.exam_questions
  add column if not exists source_year_label text;

create or replace function public.import_exam_questions_direct(
  p_exam_id uuid,
  p_items jsonb,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_exam record;
  v_question_no integer;
  v_subject text;
  v_unit_id bigint;
  v_chapter_id bigint;
  v_subtopic_id bigint;
  v_question text;
  v_a text; v_b text; v_c text; v_d text;
  v_correct text;
  v_explanation text;
  v_marks numeric;
  v_negative numeric;
  v_difficulty text;
  v_type text;
  v_source text;
  v_source_year_label text;
  v_source_year integer;
  v_question_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_seen integer[] := array[]::integer[];
  v_sub bigint;
  v_group_id uuid;
  v_selector text;
  v_sort integer;
  v_physics integer := 0;
  v_chemistry integer := 0;
  v_biology integer := 0;
begin
  if p_exam_id is null then raise exception 'Exam ID is required'; end if;
  if p_created_by is null or not exists (
    select 1 from public.profiles where id=p_created_by and role='admin' and is_active=true
  ) then raise exception 'Active Admin creator is required'; end if;

  select id,is_published,status,expected_questions,
         physics_question_count,chemistry_question_count,biology_question_count
    into v_exam
  from public.exams where id=p_exam_id for update;

  if not found then raise exception 'Exam not found'; end if;
  if coalesce(v_exam.is_published,false) then raise exception 'Published exam questions are read-only'; end if;
  if exists(select 1 from public.exam_scope_performance where exam_id=p_exam_id) then
    raise exception 'This exam already has syllabus performance. Rebuild workflow is required before changing its questions.';
  end if;
  if exists(select 1 from public.exam_questions where exam_id=p_exam_id) then
    raise exception 'This exam already has questions. Use the protected rebuild workflow before importing again.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Questions must be a non-empty array';
  end if;
  if jsonb_array_length(p_items) <> coalesce(v_exam.expected_questions,0) then
    raise exception 'Excel question count must equal expected questions: %',coalesce(v_exam.expected_questions,0);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_question_no := nullif(v_item->>'questionNo','')::integer;
    v_subject := btrim(coalesce(v_item->>'subject',''));
    v_unit_id := nullif(v_item->>'unitId','')::bigint;
    v_chapter_id := nullif(v_item->>'chapterId','')::bigint;
    v_subtopic_id := nullif(v_item->>'subtopicId','')::bigint;
    v_question := btrim(coalesce(v_item->>'questionText',''));
    v_a := btrim(coalesce(v_item->>'optionA',''));
    v_b := btrim(coalesce(v_item->>'optionB',''));
    v_c := btrim(coalesce(v_item->>'optionC',''));
    v_d := btrim(coalesce(v_item->>'optionD',''));
    v_correct := upper(btrim(coalesce(v_item->>'correctOption','')));
    v_marks := nullif(btrim(coalesce(v_item->>'marks','')),'')::numeric;
    v_negative := nullif(btrim(coalesce(v_item->>'negativeMarks','')),'')::numeric;

    if v_question_no is null or v_question_no <= 0 then raise exception 'Invalid Question No'; end if;
    if v_question_no = any(v_seen) then raise exception 'Duplicate Question No % in import',v_question_no; end if;
    v_seen := array_append(v_seen,v_question_no);

    if v_subject='Physics' then v_physics:=v_physics+1;
    elsif v_subject='Chemistry' then v_chemistry:=v_chemistry+1;
    elsif v_subject='Biology' then v_biology:=v_biology+1;
    else raise exception 'Invalid Subject for Q%',v_question_no;
    end if;

    if not exists(select 1 from public.neet_syllabus_units where id=v_unit_id and subject=v_subject) then
      raise exception 'Invalid Unit hierarchy for Q%',v_question_no;
    end if;
    if not exists(select 1 from public.neet_syllabus_topics where id=v_chapter_id and unit_id=v_unit_id) then
      raise exception 'Invalid Chapter hierarchy for Q%',v_question_no;
    end if;
    if not exists(select 1 from public.neet_syllabus_subtopics where id=v_subtopic_id and chapter_id=v_chapter_id and status='approved') then
      raise exception 'Topic must be approved and belong to Chapter for Q%',v_question_no;
    end if;
    if v_question='' or v_a='' or v_b='' or v_c='' or v_d='' then raise exception 'Question/options missing for Q%',v_question_no; end if;
    if v_correct not in ('A','B','C','D') then raise exception 'Correct Answer must be A-D for Q%',v_question_no; end if;
    if v_marks <> 4 or v_negative <> 1 then raise exception 'Official marking must be +4 / -1 for Q%',v_question_no; end if;
  end loop;

  if v_physics <> coalesce(v_exam.physics_question_count,0)
     or v_chemistry <> coalesce(v_exam.chemistry_question_count,0)
     or v_biology <> coalesce(v_exam.biology_question_count,0) then
    raise exception 'Excel subject split must be Physics %, Chemistry %, Biology %',
      coalesce(v_exam.physics_question_count,0),
      coalesce(v_exam.chemistry_question_count,0),
      coalesce(v_exam.biology_question_count,0);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_question_no := (v_item->>'questionNo')::integer;
    v_subject := btrim(v_item->>'subject');
    v_unit_id := (v_item->>'unitId')::bigint;
    v_chapter_id := (v_item->>'chapterId')::bigint;
    v_subtopic_id := (v_item->>'subtopicId')::bigint;
    v_question := btrim(v_item->>'questionText');
    v_a := btrim(v_item->>'optionA'); v_b := btrim(v_item->>'optionB');
    v_c := btrim(v_item->>'optionC'); v_d := btrim(v_item->>'optionD');
    v_correct := upper(btrim(v_item->>'correctOption'));
    v_explanation := nullif(btrim(coalesce(v_item->>'explanation','')),'');
    v_marks := (v_item->>'marks')::numeric;
    v_negative := (v_item->>'negativeMarks')::numeric;
    v_difficulty := nullif(btrim(coalesce(v_item->>'difficulty','')),'');
    v_type := nullif(btrim(coalesce(v_item->>'questionType','')),'');
    v_source := nullif(btrim(coalesce(v_item->>'source','')),'');
    v_source_year_label := nullif(btrim(coalesce(v_item->>'sourceYear','')),'');
    v_source_year := case
      when v_source_year_label ~ '^\d{4}$'
       and v_source_year_label::integer between 1900 and 2200
      then v_source_year_label::integer
      else null
    end;

    insert into public.exam_questions(
      exam_id,question_no,question_text,option_a,option_b,option_c,option_d,marks,negative_marks,
      bank_question_id,difficulty,question_type,source_label,source_year,source_year_label
    ) values (
      p_exam_id,v_question_no,v_question,v_a,v_b,v_c,v_d,v_marks,v_negative,
      null,v_difficulty,v_type,v_source,v_source_year,v_source_year_label
    ) returning id into v_question_id;

    insert into public.exam_answer_keys(question_id,correct_option,explanation)
    values(v_question_id,v_correct,v_explanation);

    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'questionId',v_question_id,'questionNo',v_question_no,'subtopicId',v_subtopic_id
    ));
  end loop;

  select coalesce(max(sort_order),-1)+1 into v_sort from public.exam_mapping_groups where exam_id=p_exam_id;
  for v_sub in select distinct (x->>'subtopicId')::bigint from jsonb_array_elements(v_created) x
  loop
    select string_agg('Q'||(x->>'questionNo'),',' order by (x->>'questionNo')::integer)
      into v_selector
    from jsonb_array_elements(v_created) x
    where (x->>'subtopicId')::bigint=v_sub;

    insert into public.exam_mapping_groups(exam_id,subtopic_id,coverage,selector_text,sort_order,created_by)
    values(p_exam_id,v_sub,'partial',v_selector,v_sort,p_created_by)
    returning id into v_group_id;
    v_sort := v_sort+1;

    insert into public.exam_question_syllabus_map(question_id,exam_id,mapping_group_id,subtopic_id)
    select (x->>'questionId')::uuid,p_exam_id,v_group_id,v_sub
    from jsonb_array_elements(v_created) x
    where (x->>'subtopicId')::bigint=v_sub;
  end loop;

  return jsonb_build_object(
    'imported',jsonb_array_length(v_created),
    'autoMapped',jsonb_array_length(v_created),
    'physics',v_physics,
    'chemistry',v_chemistry,
    'biology',v_biology
  );
end;
$$;

revoke all on function public.import_exam_questions_direct(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_exam_questions_direct(uuid,jsonb,uuid) to service_role;
