begin;

-- Phase 2 setup metadata is additive. Historical scope rows remain valid with NULL planned_questions.
alter table public.exam_scope_items
  add column if not exists planned_questions integer;

alter table public.exam_scope_items
  drop constraint if exists exam_scope_items_planned_questions_check;

alter table public.exam_scope_items
  add constraint exam_scope_items_planned_questions_check
  check (planned_questions is null or planned_questions > 0);

-- Strict master-scope replacement for new DT/WT/MT/GT exams.
-- Unlike V2, this function never creates/promotes syllabus topics: only approved canonical IDs are accepted.
create or replace function public.replace_exam_scope_items_v3(
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
  v_subject text;
  v_unit_id bigint;
  v_chapter_id bigint;
  v_subtopic_id bigint;
  v_sort_order integer;
  v_planned_questions integer;
  v_index integer := 0;
  v_key text;
  v_chapter_key text;
  v_seen text[] := array[]::text[];
  v_whole_chapters text[] := array[]::text[];
  v_topic_chapters text[] := array[]::text[];
  v_resolved jsonb := '[]'::jsonb;
begin
  if p_exam_id is null then raise exception 'Exam ID is required'; end if;
  if p_created_by is null then raise exception 'Admin creator is required'; end if;
  if not exists (select 1 from public.exams where id = p_exam_id) then raise exception 'Exam not found'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_created_by and role = 'admin' and is_active = true
  ) then raise exception 'Active Admin creator is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Scope items must be an array'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_subject := btrim(coalesce(v_item->>'subject',''));
    v_unit_id := nullif(v_item->>'unitId','')::bigint;
    v_chapter_id := nullif(v_item->>'chapterId','')::bigint;
    v_subtopic_id := nullif(v_item->>'subtopicId','')::bigint;
    v_sort_order := coalesce(nullif(v_item->>'sortOrder','')::integer, v_index);
    v_planned_questions := nullif(v_item->>'plannedQuestions','')::integer;

    if v_subject not in ('Physics','Chemistry','Biology') then
      raise exception 'Each scope item requires Physics, Chemistry or Biology Subject';
    end if;
    if v_unit_id is null or v_unit_id <= 0 then raise exception 'Each scope item requires a valid Unit'; end if;
    if v_chapter_id is null or v_chapter_id <= 0 then raise exception 'Each scope item requires a valid Chapter'; end if;
    if v_planned_questions is null or v_planned_questions <= 0 then
      raise exception 'Each scope item requires positive Questions Planned';
    end if;

    if not exists (
      select 1 from public.neet_syllabus_units
      where id = v_unit_id and subject = v_subject
    ) then raise exception 'Selected Unit does not belong to selected Subject'; end if;

    if not exists (
      select 1 from public.neet_syllabus_topics
      where id = v_chapter_id and unit_id = v_unit_id
    ) then raise exception 'Selected Chapter does not belong to selected Unit'; end if;

    if v_subtopic_id is not null and not exists (
      select 1 from public.neet_syllabus_subtopics
      where id = v_subtopic_id
        and chapter_id = v_chapter_id
        and status = 'approved'
    ) then raise exception 'Selected Topic is not an approved Topic for selected Chapter'; end if;

    v_chapter_key := v_subject || ':' || v_unit_id::text || ':' || v_chapter_id::text;
    v_key := v_chapter_key || ':' || coalesce(v_subtopic_id::text,'0');

    if v_key = any(v_seen) then raise exception 'Duplicate exam scope row'; end if;
    v_seen := array_append(v_seen, v_key);

    if v_subtopic_id is null then
      if v_chapter_key = any(v_topic_chapters) then
        raise exception 'Whole Chapter overlaps a Specific Topic in the same Chapter';
      end if;
      if not (v_chapter_key = any(v_whole_chapters)) then
        v_whole_chapters := array_append(v_whole_chapters, v_chapter_key);
      end if;
    else
      if v_chapter_key = any(v_whole_chapters) then
        raise exception 'Whole Chapter overlaps a Specific Topic in the same Chapter';
      end if;
      if not (v_chapter_key = any(v_topic_chapters)) then
        v_topic_chapters := array_append(v_topic_chapters, v_chapter_key);
      end if;
    end if;

    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'subject', v_subject,
      'unitId', v_unit_id,
      'chapterId', v_chapter_id,
      'subtopicId', v_subtopic_id,
      'sortOrder', v_sort_order,
      'plannedQuestions', v_planned_questions
    ));
    v_index := v_index + 1;
  end loop;

  delete from public.exam_scope_items where exam_id = p_exam_id;

  insert into public.exam_scope_items(exam_id, unit_id, chapter_id, subtopic_id, sort_order, planned_questions, updated_at)
  select
    p_exam_id,
    (x->>'unitId')::bigint,
    (x->>'chapterId')::bigint,
    nullif(x->>'subtopicId','')::bigint,
    coalesce((x->>'sortOrder')::integer, ordinality::integer - 1),
    (x->>'plannedQuestions')::integer,
    now()
  from jsonb_array_elements(v_resolved) with ordinality as r(x, ordinality);

  return jsonb_build_object('count', jsonb_array_length(v_resolved), 'items', v_resolved);
end;
$$;

revoke all on function public.replace_exam_scope_items_v3(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.replace_exam_scope_items_v3(uuid,jsonb,uuid) to service_role;

-- Blueprint approval represents the exact current setup. Any later mutation of
-- scope, questions, answer keys, or syllabus mapping invalidates that approval.
-- This DB-level guard covers every writer, including legacy/manual question tools.
create or replace function public.invalidate_exam_blueprint_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_question_id uuid;
begin
  if tg_table_name = 'exam_scope_items' then
    v_exam_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end;
  elsif tg_table_name = 'exam_questions' then
    v_exam_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end;
  elsif tg_table_name = 'exam_question_syllabus_map' then
    v_exam_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end;
  elsif tg_table_name = 'exam_answer_keys' then
    v_question_id := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
    select q.exam_id into v_exam_id
    from public.exam_questions q
    where q.id = v_question_id;
  end if;

  if v_exam_id is not null then
    update public.exams
    set blueprint_approved_at = null
    where id = v_exam_id
      and is_published = false
      and blueprint_approved_at is not null;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.invalidate_exam_blueprint_approval() from public, anon, authenticated;

drop trigger if exists trg_invalidate_blueprint_scope on public.exam_scope_items;
create trigger trg_invalidate_blueprint_scope
after insert or update or delete on public.exam_scope_items
for each row execute function public.invalidate_exam_blueprint_approval();

drop trigger if exists trg_invalidate_blueprint_questions on public.exam_questions;
create trigger trg_invalidate_blueprint_questions
after insert or update or delete on public.exam_questions
for each row execute function public.invalidate_exam_blueprint_approval();

drop trigger if exists trg_invalidate_blueprint_answer_keys on public.exam_answer_keys;
create trigger trg_invalidate_blueprint_answer_keys
after insert or update or delete on public.exam_answer_keys
for each row execute function public.invalidate_exam_blueprint_approval();

drop trigger if exists trg_invalidate_blueprint_mapping on public.exam_question_syllabus_map;
create trigger trg_invalidate_blueprint_mapping
after insert or update or delete on public.exam_question_syllabus_map
for each row execute function public.invalidate_exam_blueprint_approval();

commit;
