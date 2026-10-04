alter table public.exams
  add column if not exists physics_question_count smallint not null default 0,
  add column if not exists chemistry_question_count smallint not null default 0,
  add column if not exists biology_question_count smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exams_subject_question_counts_nonnegative'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
      add constraint exams_subject_question_counts_nonnegative
      check (
        physics_question_count >= 0
        and chemistry_question_count >= 0
        and biology_question_count >= 0
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exams_subject_question_counts_match_expected'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
      add constraint exams_subject_question_counts_match_expected
      check (
        expected_questions is null
        or (physics_question_count + chemistry_question_count + biology_question_count) = 0
        or (physics_question_count + chemistry_question_count + biology_question_count) = expected_questions
      );
  end if;
end $$;
