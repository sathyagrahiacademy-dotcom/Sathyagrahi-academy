-- Automatically sync manually created exam questions into the permanent Question Bank
-- when a canonical scoring mapping is inserted/changed.

create or replace function public.sync_mapped_question_to_bank_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q record;
  v_key record;
  v_topic record;
  v_chapter record;
  v_unit record;
  v_creator uuid;
  v_hash text;
  v_bank_id uuid;
begin
  select * into v_q from public.exam_questions where id=new.question_id and exam_id=new.exam_id;
  if not found or v_q.bank_question_id is not null then return new; end if;

  select correct_option,explanation into v_key from public.exam_answer_keys where question_id=new.question_id;
  if not found then return new; end if;

  select * into v_topic from public.neet_syllabus_subtopics where id=new.subtopic_id and status='approved';
  if not found then return new; end if;
  select * into v_chapter from public.neet_syllabus_topics where id=v_topic.chapter_id;
  if not found then return new; end if;
  select * into v_unit from public.neet_syllabus_units where id=v_chapter.unit_id;
  if not found or v_unit.subject not in ('Physics','Chemistry','Biology') then return new; end if;

  select created_by into v_creator from public.exam_mapping_groups where id=new.mapping_group_id;
  if v_creator is null then select created_by into v_creator from public.exams where id=new.exam_id; end if;

  v_hash := public.question_bank_content_hash(
    v_unit.subject,v_unit.id,v_chapter.id,v_topic.id,v_q.question_text,v_q.option_a,v_q.option_b,v_q.option_c,v_q.option_d,v_key.correct_option
  );

  insert into public.question_bank_questions(
    subject,unit_id,chapter_id,subtopic_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,
    default_marks,default_negative_marks,difficulty,question_type,source_label,source_year,content_hash,created_by
  ) values (
    v_unit.subject,v_unit.id,v_chapter.id,v_topic.id,v_q.question_text,v_q.option_a,v_q.option_b,v_q.option_c,v_q.option_d,v_key.correct_option,v_key.explanation,
    v_q.marks,v_q.negative_marks,v_q.difficulty,v_q.question_type,v_q.source_label,v_q.source_year,v_hash,v_creator
  ) on conflict(content_hash) do nothing returning id into v_bank_id;

  if v_bank_id is null then select id into v_bank_id from public.question_bank_questions where content_hash=v_hash; end if;
  update public.exam_questions set bank_question_id=v_bank_id where id=new.question_id and bank_question_id is null;
  return new;
end;
$$;

revoke all on function public.sync_mapped_question_to_bank_trigger() from public, anon, authenticated;
grant execute on function public.sync_mapped_question_to_bank_trigger() to service_role;

drop trigger if exists exam_question_map_sync_bank on public.exam_question_syllabus_map;
create trigger exam_question_map_sync_bank
after insert or update of subtopic_id on public.exam_question_syllabus_map
for each row execute function public.sync_mapped_question_to_bank_trigger();
