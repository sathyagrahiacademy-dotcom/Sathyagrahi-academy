-- Retire future Question Bank growth while preserving historical rows.
-- Existing question_bank_questions data is not deleted.

drop trigger if exists exam_question_map_sync_bank on public.exam_question_syllabus_map;

comment on table public.question_bank_questions is
  'Legacy Question Bank retained for historical compatibility. New SGA exams import Excel questions directly into exam tables.';
