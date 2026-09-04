-- Exam Scope V2: atomic manual-topic resolution and canonical scope replacement.
-- Additive migration. Historical exam scope, attempts, responses, results and performance are not rewritten.

create or replace function public.replace_exam_scope_items_v2(
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
  v_scope_type text;
  v_topic_name text;
  v_topic_norm text;
  v_subtopic_id bigint;
  v_subtopic_title text;
  v_subtopic_status text;
  v_sort_order integer;
  v_next_topic_sort integer;
  v_index integer := 0;
  v_key text;
  v_seen text[] := array[]::text[];
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

  -- Resolve and validate every row first. Any exception rolls back topic promotions/creates too.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_subject := btrim(coalesce(v_item->>'subject',''));
    v_unit_id := nullif(v_item->>'unitId','')::bigint;
    v_chapter_id := nullif(v_item->>'chapterId','')::bigint;
    v_scope_type := lower(btrim(coalesce(v_item->>'scopeType','chapter')));
    v_sort_order := coalesce(nullif(v_item->>'sortOrder','')::integer, v_index);
    v_subtopic_id := null;
    v_subtopic_title := null;
    v_topic_name := '';

    if v_subject not in ('Physics','Chemistry','Biology') then
      raise exception 'Each scope item requires Physics, Chemistry or Biology Subject';
    end if;
    if v_unit_id is null or v_unit_id <= 0 then raise exception 'Each scope item requires a valid Unit'; end if;
    if v_chapter_id is null or v_chapter_id <= 0 then raise exception 'Each scope item requires a valid Chapter'; end if;
    if v_scope_type not in ('chapter','topic') then raise exception 'Scope Type must be Whole Chapter or Specific Topic'; end if;

    if not exists (
      select 1 from public.neet_syllabus_units
      where id = v_unit_id and subject = v_subject
    ) then raise exception 'Selected Unit does not belong to selected Subject'; end if;

    if not exists (
      select 1 from public.neet_syllabus_topics
      where id = v_chapter_id and unit_id = v_unit_id
    ) then raise exception 'Selected Chapter does not belong to selected Unit'; end if;

    if v_scope_type = 'topic' then
      v_topic_name := regexp_replace(btrim(coalesce(v_item->>'topicName','')), '[[:space:]]+', ' ', 'g');
      if nullif(v_topic_name,'') is null then raise exception 'Specific Topic requires Topic Name'; end if;
      v_topic_norm := lower(v_topic_name);

      -- Prefer an active exact match. Suggested matches are promoted in-place.
      select s.id, s.subtopic_title, s.status
        into v_subtopic_id, v_subtopic_title, v_subtopic_status
      from public.neet_syllabus_subtopics s
      where s.chapter_id = v_chapter_id
        and s.status in ('approved','suggested')
        and lower(regexp_replace(btrim(s.subtopic_title), '[[:space:]]+', ' ', 'g')) = v_topic_norm
      order by case when s.status = 'approved' then 0 else 1 end, s.id
      limit 1
      for update;

      if v_subtopic_id is not null then
        if v_subtopic_status = 'suggested' then
          update public.neet_syllabus_subtopics
          set status = 'approved', source = 'admin', updated_at = now()
          where id = v_subtopic_id;
        end if;
        select subtopic_title into v_subtopic_title
        from public.neet_syllabus_subtopics where id = v_subtopic_id;
      else
        -- Disabled curriculum data is intentionally never revived by an Exam save.
        if exists (
          select 1 from public.neet_syllabus_subtopics s
          where s.chapter_id = v_chapter_id
            and s.status = 'disabled'
            and lower(regexp_replace(btrim(s.subtopic_title), '[[:space:]]+', ' ', 'g')) = v_topic_norm
        ) then
          raise exception 'Topic "%" is disabled for this Chapter', v_topic_name;
        end if;

        select coalesce(max(sort_order),0) + 1 into v_next_topic_sort
        from public.neet_syllabus_subtopics where chapter_id = v_chapter_id;

        insert into public.neet_syllabus_subtopics(
          chapter_id, subtopic_title, sort_order, status, source, updated_at
        ) values (
          v_chapter_id, v_topic_name, v_next_topic_sort, 'approved', 'admin', now()
        ) returning id, subtopic_title into v_subtopic_id, v_subtopic_title;
      end if;
    end if;

    v_key := v_unit_id::text || ':' || v_chapter_id::text || ':' || coalesce(v_subtopic_id::text,'0');
    if v_key = any(v_seen) then raise exception 'Duplicate exam scope row'; end if;
    v_seen := array_append(v_seen, v_key);

    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'subject', v_subject,
      'unitId', v_unit_id,
      'chapterId', v_chapter_id,
      'scopeType', v_scope_type,
      'topicName', case when v_scope_type='topic' then v_subtopic_title else '' end,
      'subtopicId', v_subtopic_id,
      'subtopicTitle', v_subtopic_title,
      'sortOrder', v_sort_order
    ));
    v_index := v_index + 1;
  end loop;

  -- Replace only after every row has resolved successfully.
  delete from public.exam_scope_items where exam_id = p_exam_id;

  insert into public.exam_scope_items(exam_id, unit_id, chapter_id, subtopic_id, sort_order, updated_at)
  select
    p_exam_id,
    (x->>'unitId')::bigint,
    (x->>'chapterId')::bigint,
    nullif(x->>'subtopicId','')::bigint,
    coalesce((x->>'sortOrder')::integer, ordinality::integer - 1),
    now()
  from jsonb_array_elements(v_resolved) with ordinality as r(x, ordinality);

  return jsonb_build_object('count', jsonb_array_length(v_resolved), 'items', v_resolved);
end;
$$;

revoke all on function public.replace_exam_scope_items_v2(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.replace_exam_scope_items_v2(uuid,jsonb,uuid) to service_role;
