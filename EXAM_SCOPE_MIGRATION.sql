create table if not exists public.exam_scope_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  unit_id bigint not null references public.neet_syllabus_units(id),
  chapter_id bigint not null references public.neet_syllabus_topics(id),
  subtopic_id bigint references public.neet_syllabus_subtopics(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_scope_items_exam_idx
  on public.exam_scope_items(exam_id, sort_order, id);

create unique index if not exists exam_scope_items_exact_unique
  on public.exam_scope_items(exam_id, unit_id, chapter_id, coalesce(subtopic_id, 0::bigint));

alter table public.exam_scope_items enable row level security;
revoke select, insert, update, delete on public.exam_scope_items from anon, authenticated;
grant select, insert, update, delete on public.exam_scope_items to service_role;

create or replace function public.replace_exam_scope_items(
  p_exam_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_unit_id bigint;
  v_chapter_id bigint;
  v_subtopic_id bigint;
  v_sort_order integer;
  v_inserted integer := 0;
  v_seen text[] := array[]::text[];
  v_key text;
begin
  if p_exam_id is null then
    raise exception 'Exam ID is required';
  end if;
  if not exists (select 1 from public.exams where id = p_exam_id) then
    raise exception 'Exam not found';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Scope items must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_unit_id := nullif(v_item->>'unitId','')::bigint;
    v_chapter_id := nullif(v_item->>'chapterId','')::bigint;
    v_subtopic_id := nullif(v_item->>'subtopicId','')::bigint;
    v_sort_order := coalesce(nullif(v_item->>'sortOrder','')::integer, v_inserted);

    if v_unit_id is null or v_unit_id <= 0 or v_chapter_id is null or v_chapter_id <= 0 then
      raise exception 'Each scope item requires a valid Unit and Chapter';
    end if;

    if not exists (select 1 from public.neet_syllabus_units where id = v_unit_id) then
      raise exception 'Scope Unit % was not found', v_unit_id;
    end if;

    if not exists (
      select 1 from public.neet_syllabus_topics
      where id = v_chapter_id and unit_id = v_unit_id
    ) then
      raise exception 'Scope Chapter % does not belong to Unit %', v_chapter_id, v_unit_id;
    end if;

    if v_subtopic_id is not null and not exists (
      select 1 from public.neet_syllabus_subtopics
      where id = v_subtopic_id and chapter_id = v_chapter_id and status = 'approved'
    ) then
      raise exception 'Scope Topic/Subtopic % is not an approved child of Chapter %', v_subtopic_id, v_chapter_id;
    end if;

    v_key := v_unit_id::text || ':' || v_chapter_id::text || ':' || coalesce(v_subtopic_id::text, '0');
    if v_key = any(v_seen) then
      raise exception 'Duplicate exam scope item: %', v_key;
    end if;
    v_seen := array_append(v_seen, v_key);
    v_inserted := v_inserted + 1;
  end loop;

  delete from public.exam_scope_items where exam_id = p_exam_id;

  v_inserted := 0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_unit_id := nullif(v_item->>'unitId','')::bigint;
    v_chapter_id := nullif(v_item->>'chapterId','')::bigint;
    v_subtopic_id := nullif(v_item->>'subtopicId','')::bigint;
    v_sort_order := coalesce(nullif(v_item->>'sortOrder','')::integer, v_inserted);

    insert into public.exam_scope_items(exam_id, unit_id, chapter_id, subtopic_id, sort_order, updated_at)
    values (p_exam_id, v_unit_id, v_chapter_id, v_subtopic_id, v_sort_order, now());
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.replace_exam_scope_items(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_exam_scope_items(uuid,jsonb) to service_role;