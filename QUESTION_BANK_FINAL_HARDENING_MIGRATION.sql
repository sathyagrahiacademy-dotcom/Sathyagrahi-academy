-- Final production hardening for Question Bank RPCs that were deployed before feature verification.
-- Keeps historical exams immutable after syllabus performance exists and requires explicit marks on Excel import.

create or replace function public.import_exam_questions_to_bank(
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
  v_source_year integer;
  v_hash text;
  v_bank_id uuid;
  v_question_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_seen integer[] := array[]::integer[];
  v_sub bigint;
  v_group_id uuid;
  v_selector text;
  v_sort integer;
  v_bank_created integer := 0;
  v_bank_reused integer := 0;
begin
  if p_exam_id is null then raise exception 'Exam ID is required'; end if;
  if p_created_by is null or not exists (
    select 1 from public.profiles where id=p_created_by and role='admin' and is_active=true
  ) then raise exception 'Active Admin creator is required'; end if;

  select id,is_published,status into v_exam from public.exams where id=p_exam_id for update;
  if not found then raise exception 'Exam not found'; end if;
  if coalesce(v_exam.is_published,false) then raise exception 'Published exam questions are read-only'; end if;
  if exists(select 1 from public.exam_scope_performance where exam_id=p_exam_id) then
    raise exception 'This exam already has syllabus performance. Rebuild workflow is required before changing its questions.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Questions must be a non-empty array';
  end if;
  if jsonb_array_length(p_items) > 250 then raise exception 'Maximum 250 questions per import'; end if;

  -- Validate the entire batch before any write.
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
    v_difficulty := nullif(btrim(coalesce(v_item->>'difficulty','')),'');
    v_source_year := nullif(v_item->>'sourceYear','')::integer;

    if v_question_no is null or v_question_no <= 0 then raise exception 'Invalid Question No'; end if;
    if v_question_no = any(v_seen) then raise exception 'Duplicate Question No % in import', v_question_no; end if;
    v_seen := array_append(v_seen,v_question_no);
    if exists(select 1 from public.exam_questions where exam_id=p_exam_id and question_no=v_question_no) then
      raise exception 'Question No % already exists in this exam', v_question_no;
    end if;
    if v_subject not in ('Physics','Chemistry','Biology') then raise exception 'Invalid Subject for Q%',v_question_no; end if;
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
    if v_marks is null then raise exception 'Marks are required for Q%',v_question_no; end if;
    if v_negative is null then raise exception 'Negative Marks are required for Q%',v_question_no; end if;
    if v_marks <= 0 or v_negative < 0 then raise exception 'Invalid marks for Q%',v_question_no; end if;
    if v_difficulty is not null and v_difficulty not in ('Easy','Medium','Hard') then raise exception 'Difficulty must be Easy, Medium or Hard for Q%',v_question_no; end if;
    if v_source_year is not null and (v_source_year < 1900 or v_source_year > 2200) then raise exception 'Invalid Source Year for Q%',v_question_no; end if;
  end loop;

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
    v_marks := nullif(btrim(coalesce(v_item->>'marks','')),'')::numeric;
    v_negative := nullif(btrim(coalesce(v_item->>'negativeMarks','')),'')::numeric;
    v_difficulty := nullif(btrim(coalesce(v_item->>'difficulty','')),'');
    v_type := nullif(btrim(coalesce(v_item->>'questionType','')),'');
    v_source := nullif(btrim(coalesce(v_item->>'source','')),'');
    v_source_year := nullif(v_item->>'sourceYear','')::integer;
    v_hash := public.question_bank_content_hash(v_subject,v_unit_id,v_chapter_id,v_subtopic_id,v_question,v_a,v_b,v_c,v_d,v_correct);

    v_bank_id := null;
    insert into public.question_bank_questions(
      subject,unit_id,chapter_id,subtopic_id,question_text,option_a,option_b,option_c,option_d,
      correct_option,explanation,default_marks,default_negative_marks,difficulty,question_type,source_label,source_year,
      content_hash,created_by
    ) values (
      v_subject,v_unit_id,v_chapter_id,v_subtopic_id,v_question,v_a,v_b,v_c,v_d,
      v_correct,v_explanation,v_marks,v_negative,v_difficulty,v_type,v_source,v_source_year,v_hash,p_created_by
    ) on conflict (content_hash) do nothing returning id into v_bank_id;

    if v_bank_id is null then
      select id into v_bank_id from public.question_bank_questions where content_hash=v_hash;
      v_bank_reused := v_bank_reused + 1;
    else
      v_bank_created := v_bank_created + 1;
    end if;

    insert into public.exam_questions(
      exam_id,question_no,question_text,option_a,option_b,option_c,option_d,marks,negative_marks,
      bank_question_id,difficulty,question_type,source_label,source_year
    ) values (
      p_exam_id,v_question_no,v_question,v_a,v_b,v_c,v_d,v_marks,v_negative,
      v_bank_id,v_difficulty,v_type,v_source,v_source_year
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
    v_sort := v_sort + 1;

    insert into public.exam_question_syllabus_map(question_id,exam_id,mapping_group_id,subtopic_id)
    select (x->>'questionId')::uuid,p_exam_id,v_group_id,v_sub
    from jsonb_array_elements(v_created) x
    where (x->>'subtopicId')::bigint=v_sub;
  end loop;

  return jsonb_build_object(
    'imported',jsonb_array_length(v_created),
    'bankCreated',v_bank_created,
    'bankReused',v_bank_reused,
    'autoMapped',jsonb_array_length(v_created)
  );
end;
$$;

revoke all on function public.import_exam_questions_to_bank(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.import_exam_questions_to_bank(uuid,jsonb,uuid) to service_role;

create or replace function public.add_bank_questions_to_exam(
  p_exam_id uuid,
  p_bank_ids uuid[],
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam record;
  v_bank record;
  v_next integer;
  v_question_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_sub bigint;
  v_group_id uuid;
  v_selector text;
  v_sort integer;
begin
  if p_created_by is null or not exists(select 1 from public.profiles where id=p_created_by and role='admin' and is_active=true) then
    raise exception 'Active Admin creator is required';
  end if;
  select id,is_published into v_exam from public.exams where id=p_exam_id for update;
  if not found then raise exception 'Target exam not found'; end if;
  if coalesce(v_exam.is_published,false) then raise exception 'Published exam questions are read-only'; end if;
  if exists(select 1 from public.exam_scope_performance where exam_id=p_exam_id) then
    raise exception 'This exam already has syllabus performance. Rebuild workflow is required before changing its questions.';
  end if;
  if p_bank_ids is null or cardinality(p_bank_ids)=0 then raise exception 'Select at least one bank question'; end if;
  if cardinality(p_bank_ids)>250 then raise exception 'Maximum 250 questions per operation'; end if;
  if (select count(distinct x) from unnest(p_bank_ids) x) <> cardinality(p_bank_ids) then raise exception 'Duplicate bank selection'; end if;
  if exists(select 1 from public.exam_questions where exam_id=p_exam_id and bank_question_id=any(p_bank_ids)) then
    raise exception 'One or more selected questions already exist in this exam';
  end if;
  if exists(
    select 1 from public.question_bank_questions q
    left join public.neet_syllabus_subtopics s on s.id=q.subtopic_id
    where q.id=any(p_bank_ids) and (not q.is_active or s.id is null or s.status<>'approved')
  ) then raise exception 'Selected bank questions must use active approved Topics'; end if;
  select coalesce(max(question_no),0)+1 into v_next from public.exam_questions where exam_id=p_exam_id;

  for v_bank in select * from public.question_bank_questions where id=any(p_bank_ids) and is_active=true order by created_at,id
  loop
    insert into public.exam_questions(
      exam_id,question_no,question_text,option_a,option_b,option_c,option_d,marks,negative_marks,
      bank_question_id,difficulty,question_type,source_label,source_year
    ) values (
      p_exam_id,v_next,v_bank.question_text,v_bank.option_a,v_bank.option_b,v_bank.option_c,v_bank.option_d,
      v_bank.default_marks,v_bank.default_negative_marks,v_bank.id,v_bank.difficulty,v_bank.question_type,v_bank.source_label,v_bank.source_year
    ) returning id into v_question_id;
    insert into public.exam_answer_keys(question_id,correct_option,explanation)
    values(v_question_id,v_bank.correct_option,v_bank.explanation);
    v_created := v_created || jsonb_build_array(jsonb_build_object('questionId',v_question_id,'questionNo',v_next,'subtopicId',v_bank.subtopic_id));
    v_next := v_next + 1;
  end loop;
  if jsonb_array_length(v_created) <> cardinality(p_bank_ids) then raise exception 'One or more selected bank questions were not found/active'; end if;

  select coalesce(max(sort_order),-1)+1 into v_sort from public.exam_mapping_groups where exam_id=p_exam_id;
  for v_sub in select distinct (x->>'subtopicId')::bigint from jsonb_array_elements(v_created) x
  loop
    select string_agg('Q'||(x->>'questionNo'),',' order by (x->>'questionNo')::integer) into v_selector
    from jsonb_array_elements(v_created) x where (x->>'subtopicId')::bigint=v_sub;
    insert into public.exam_mapping_groups(exam_id,subtopic_id,coverage,selector_text,sort_order,created_by)
    values(p_exam_id,v_sub,'partial',v_selector,v_sort,p_created_by) returning id into v_group_id;
    v_sort := v_sort+1;
    insert into public.exam_question_syllabus_map(question_id,exam_id,mapping_group_id,subtopic_id)
    select (x->>'questionId')::uuid,p_exam_id,v_group_id,v_sub from jsonb_array_elements(v_created) x
    where (x->>'subtopicId')::bigint=v_sub;
  end loop;
  return jsonb_build_object('added',jsonb_array_length(v_created));
end;
$$;

revoke all on function public.add_bank_questions_to_exam(uuid,uuid[],uuid) from public, anon, authenticated;
grant execute on function public.add_bank_questions_to_exam(uuid,uuid[],uuid) to service_role;
