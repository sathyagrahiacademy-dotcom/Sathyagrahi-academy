-- Phase 3 Task 3: atomic Admin subtopic split/merge helpers.
-- Apply after EXAM_MAPPING_PERFORMANCE_MIGRATION.sql.

create or replace function split_exam_subtopic(
  p_subtopic_id bigint,
  p_titles text[],
  p_created_by uuid
) returns bigint[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chapter_id bigint;
  v_sort_order integer;
  v_count integer;
  v_distinct integer;
  v_ids bigint[];
begin
  if p_created_by is null then raise exception 'Creator is required'; end if;
  if coalesce(cardinality(p_titles),0) < 2 then raise exception 'At least two split titles are required'; end if;

  select chapter_id, sort_order into v_chapter_id, v_sort_order
  from neet_syllabus_subtopics
  where id=p_subtopic_id and status <> 'disabled'
  for update;
  if v_chapter_id is null then raise exception 'Subtopic not found'; end if;

  if exists (select 1 from exam_mapping_groups where subtopic_id=p_subtopic_id)
     or exists (select 1 from exam_question_syllabus_map where subtopic_id=p_subtopic_id) then
    raise exception 'Mapped subtopic cannot be split';
  end if;

  select count(*), count(distinct lower(btrim(t))) into v_count, v_distinct
  from unnest(p_titles) as x(t)
  where nullif(btrim(t),'') is not null;
  if v_count <> cardinality(p_titles) or v_distinct <> v_count then
    raise exception 'Split titles must be non-empty and distinct';
  end if;

  update neet_syllabus_subtopics set status='disabled', updated_at=now() where id=p_subtopic_id;

  with inserted as (
    insert into neet_syllabus_subtopics(chapter_id,subtopic_title,sort_order,status,source)
    select v_chapter_id, btrim(t), v_sort_order + (row_number() over ())::integer, 'suggested', 'admin'
    from unnest(p_titles) as x(t)
    returning id
  )
  select array_agg(id order by id) into v_ids from inserted;

  return v_ids;
end;
$$;

create or replace function merge_exam_subtopics(
  p_chapter_id bigint,
  p_subtopic_ids bigint[],
  p_title text,
  p_created_by uuid
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id bigint;
  v_count integer;
  v_distinct integer;
  v_title text := btrim(p_title);
begin
  if p_chapter_id is null or p_created_by is null then raise exception 'Chapter and creator are required'; end if;
  if nullif(v_title,'') is null then raise exception 'Merge title is required'; end if;
  if coalesce(cardinality(p_subtopic_ids),0) < 2 then raise exception 'At least two subtopics are required'; end if;

  select count(*), count(distinct sid) into v_count, v_distinct from unnest(p_subtopic_ids) as x(sid);
  if v_count <> v_distinct then raise exception 'Merge subtopics must be distinct'; end if;

  if (select count(*) from neet_syllabus_subtopics where id=any(p_subtopic_ids) and chapter_id=p_chapter_id and status <> 'disabled') <> v_count then
    raise exception 'All merge subtopics must be active and belong to the same chapter';
  end if;

  select id into v_target_id
  from neet_syllabus_subtopics
  where chapter_id=p_chapter_id and status <> 'disabled' and lower(btrim(subtopic_title))=lower(v_title)
  order by case when id=any(p_subtopic_ids) then 0 else 1 end, id
  limit 1
  for update;

  if v_target_id is null then
    insert into neet_syllabus_subtopics(chapter_id,subtopic_title,sort_order,status,source)
    values(p_chapter_id,v_title,0,'approved','admin') returning id into v_target_id;
  else
    update neet_syllabus_subtopics
      set subtopic_title=v_title,status='approved',source='admin',updated_at=now()
      where id=v_target_id;
  end if;

  update exam_mapping_groups set subtopic_id=v_target_id, updated_at=now()
  where subtopic_id=any(p_subtopic_ids) and subtopic_id<>v_target_id;

  update exam_question_syllabus_map set subtopic_id=v_target_id, updated_at=now()
  where subtopic_id=any(p_subtopic_ids) and subtopic_id<>v_target_id;

  update neet_syllabus_subtopics set status='disabled', updated_at=now()
  where id=any(p_subtopic_ids) and id<>v_target_id;

  return v_target_id;
end;
$$;

revoke all on function split_exam_subtopic(bigint,text[],uuid) from public, anon, authenticated;
grant execute on function split_exam_subtopic(bigint,text[],uuid) to service_role;
revoke all on function merge_exam_subtopics(bigint,bigint[],text,uuid) from public, anon, authenticated;
grant execute on function merge_exam_subtopics(bigint,bigint[],text,uuid) to service_role;
