# Exam Range Mapping and Syllabus Performance Design

**Date:** 2026-09-04
**Status:** Approved design direction; implementation not started
**Project:** Sathyagrahi Academy Examinations

## 1. Goal

Build a reliable syllabus-aware examination layer so every Academy online exam can be mapped from questions to the NEET syllabus and, after submission, automatically produce student performance at **Unit → Chapter → Topic/Subtopic** level with student-wise **E1 / E2 / E3...** progression.

The design must preserve the current stable exam system, Phase-1 answer synchronization protection, Phase-2 All/Selected audience and Re-Exam/Reset controls, and all existing historical exam data.

## 2. Locked Product Decisions

1. Final syllabus hierarchy is **Subject → Unit → Chapter → Topic/Subtopic**.
2. Existing `neet_syllabus_topics.topic_title` is treated semantically as **Chapter**. The existing table is not renamed or destroyed because current learning-progress features already depend on it.
3. A new child Topic/Subtopic layer is added under each existing chapter.
4. Topic/Subtopic suggestions are auto-generated from the existing `official_detail` text and require Admin approval. Admin can rename, split, merge, remove, add, and approve suggestions.
5. Only **approved** Topic/Subtopic rows can be used for exam mapping.
6. Range Mapping supports both contiguous and mixed selectors, for example `1-10` and `1-10,17,22-28`.
7. Each exam question has exactly **one primary scoring Topic/Subtopic**. This prevents double-counting. Secondary tags are out of scope for this phase.
8. Admin explicitly chooses Topic coverage as **FULL** or **PARTIAL**. The system never guesses coverage from question count.
9. A partial valid test still participates in E-series and is clearly labelled PARTIAL.
10. E-numbering is **student-wise and exact-scope-wise**. A student's first valid exam for a scope is E1, second is E2, and so on.
11. Topic, Chapter, and Unit each maintain their own E-series.
12. Chapter and Unit scoring uses **actual mapped marks**, not a simple average of child percentages.
13. Chapter/Unit coverage is derived: FULL only when all approved descendants for that scope are included as FULL; otherwise PARTIAL.
14. Performance records are created immediately after a successful server-side exam submission. Admin can see them immediately; student visibility remains blocked until the corresponding result is published.
15. Negative performance is preserved as the real value. Example: `-2 / 20 = -10%`; it is not clamped to zero.
16. A technical RESET removes the invalid attempt and therefore it does not consume an E-number. A genuine RE-EXAM preserves prior valid history and the new valid attempt becomes the next E-number.
17. Historical exams are never automatically guessed into syllabus scopes. Existing raw results stay unchanged. A legacy exam enters syllabus performance only after Admin completes its mapping.
18. Exam publishing is blocked until the question paper is valid, fully mapped, and marks-consistent.

## 3. Recommended Architecture

Use a **question-level source of truth** with a lightweight range editor for Admin convenience.

Admin enters a selector such as `1-10,17,22-28` and chooses Subject → Unit → Chapter → Topic/Subtopic + FULL/PARTIAL. The system expands that selector into individual question mappings. Performance calculations never use the selector text directly; they use the expanded question-level mapping.

This gives the best combination of:
- fast Admin mapping,
- exact scoring,
- overlap detection,
- multi-subject support,
- safe re-exam history,
- future reuse by offline/manual exams.

## 4. Syllabus Topic/Subtopic Layer

### 4.1 Existing data stays intact

Current tables such as `neet_syllabus_units`, `neet_syllabus_topics`, and current learning-progress tables remain unchanged. Existing `neet_syllabus_topics` rows are interpreted as chapters by the new exam-mapping UI.

### 4.2 New table: `neet_syllabus_subtopics`

Recommended fields:
- `id bigint generated ... primary key`
- `chapter_id bigint not null references neet_syllabus_topics(id) on delete cascade`
- `subtopic_title text not null`
- `sort_order integer not null`
- `status text not null check (status in ('suggested','approved','disabled'))`
- `source text not null check (source in ('auto','admin'))`
- `created_at`, `updated_at`

Unique active titles should be constrained within a chapter where practical.

### 4.3 Auto-suggest mechanism

First implementation should be dependency-light and deterministic: generate initial suggestions from `official_detail` using clause/semicolon segmentation and normalization. This works well with the current official syllabus text and avoids adding an external AI/API dependency to the production student site.

Admin can then:
- Approve
- Rename
- Split
- Merge
- Remove/disable
- Add a missing Topic manually

The architecture leaves room for an AI-enhanced suggestion provider later without changing the database contract.

## 5. Exam Range Mapping

### 5.1 New table: `exam_mapping_groups`

Stores the Admin-facing mapping instruction:
- `id uuid primary key`
- `exam_id uuid references exams(id) on delete cascade`
- `subtopic_id bigint references neet_syllabus_subtopics(id)`
- `coverage text check (coverage in ('full','partial'))`
- `selector_text text` such as `1-10,17,22-28`
- `sort_order integer`
- `created_by uuid`
- timestamps

### 5.2 New table: `exam_question_syllabus_map`

This is the scoring source of truth:
- `question_id uuid primary key references exam_questions(id) on delete cascade`
- `exam_id uuid references exams(id) on delete cascade`
- `mapping_group_id uuid references exam_mapping_groups(id) on delete cascade`
- `subtopic_id bigint references neet_syllabus_subtopics(id)`
- timestamps

One `question_id` primary key guarantees that one question cannot contribute marks to two scoring Topics.

### 5.3 Selector parser

Accept friendly forms such as:
- `1-10`
- `1-10,17,22-28`
- optional `Q` prefix and spaces: `Q1-Q10, Q17`

Normalize to question numbers and reject:
- invalid syntax,
- reversed ranges,
- question numbers not present in the exam,
- duplicate numbers inside a selector,
- overlaps with another mapping group.

### 5.4 Mapping preview

Before publish, show:
- Total questions
- Mapped questions
- Unmapped questions
- Overlap count
- Invalid references
- Subject/Unit/Chapter/Topic breakdown
- FULL/PARTIAL badges
- Marks mapped per scope

A valid paper must show **Mapped = Total**, **Unmapped = 0**, **Overlaps = 0**, **Invalid = 0**.

## 6. Publish Validation Gate

Extend the server-side Admin publish action. UI warnings alone are not sufficient.

Publish must be rejected unless all of the following are true:
1. Exam has questions.
2. Every question has exactly one question-level syllabus mapping.
3. Every mapped Topic/Subtopic is approved and belongs to a valid Chapter/Unit/Subject chain.
4. No invalid question references or overlaps exist.
5. Sum of `exam_questions.marks` equals `exams.total_marks`.
6. Answer key coverage is complete.
7. Existing audience validation from Phase-2 passes.

The server returns a structured validation summary so Admin UI can show the exact reason publish is blocked.

## 7. Grading Consistency

Phase-3 must also close the known grading-semantic gap because syllabus performance and overall result must agree.

Rules:
- If `exams.negative_marking = true`, wrong answers subtract the question's `negative_marks`.
- If `exams.negative_marking = false`, wrong answers subtract **zero**, regardless of stored question defaults.
- Overall percentage uses the validated `exams.total_marks` denominator.
- Scope percentages use each scope's actual mapped maximum marks.
- Negative totals/percentages are preserved.

This change must be covered by regression tests before deployment.

## 8. Automatic Performance Generation

### 8.1 New raw table: `exam_scope_performance`

One submitted attempt produces materialized scope rows. Recommended columns:
- `id uuid primary key`
- `attempt_id uuid not null references exam_attempts(id) on delete cascade`
- `exam_id uuid not null references exams(id) on delete cascade`
- `student_id uuid not null references profiles(id) on delete cascade`
- `scope_level text check (scope_level in ('unit','chapter','topic'))`
- `unit_id bigint not null references neet_syllabus_units(id)`
- `chapter_id bigint null references neet_syllabus_topics(id)`
- `subtopic_id bigint null references neet_syllabus_subtopics(id)`
- `coverage text check (coverage in ('full','partial'))`
- `question_count integer`
- `max_marks numeric`
- `earned_marks numeric`
- `correct_count integer`
- `wrong_count integer`
- `unattempted_count integer`
- `percentage numeric`
- `created_at`

Use level-specific uniqueness so one attempt has only one row for the same Unit, Chapter, or Topic.

### 8.2 Generation timing

After final answer synchronization succeeds and the server grades the attempt:
1. Persist `exam_results`.
2. Join question mappings, answer keys, responses, and question marks.
3. Produce Topic aggregates.
4. Roll Topic data upward into Chapter aggregates using actual marks.
5. Roll Chapter data upward into Unit aggregates using actual marks.
6. Upsert `exam_scope_performance` in the same submission flow.

If performance generation fails, the server must not silently report a completely successful submission. It should retry safely or surface a recoverable integrity error while preserving idempotency.

## 9. E1 / E2 / E3 Sequencing

Do **not** permanently store E-number as a mutable counter on the raw performance row.

Create a database view or server query that derives sequence dynamically using chronological valid attempts:

`row_number() over (partition by student_id, exact_scope order by submitted_at, attempt_no, attempt_id)`

Benefits:
- technical RESET cascades the invalid attempt/performance away and sequence naturally closes the gap;
- genuine RE-EXAM keeps old data and becomes the next E-number;
- no renumber update job is required;
- Topic, Chapter, and Unit can each have independent sequence partitions.

A displayed scope record should read approximately:

`Menstrual Cycle — E2 • 8Q • PARTIAL • 78%`

## 10. Coverage Roll-Up

Topic coverage comes directly from Admin mapping (`FULL` or `PARTIAL`).

Chapter coverage:
- FULL only if all approved Topics/Subtopics under that chapter are represented in the exam and each is FULL.
- otherwise PARTIAL.

Unit coverage:
- FULL only if every approved Chapter/Topic descendant required for that Unit is fully represented.
- otherwise PARTIAL.

This prevents the system from calling a broad scope FULL when only a small subset was tested.

## 11. Admin Workflow

Recommended exam workflow:

`Create Exam → Add/Import Questions → Range Mapping → Preview → Validate 100% → Publish All/Selected → Student Writes → Submit → Automatic Performance`

Admin mapping screen should provide:
- question range selector,
- Subject dropdown,
- Unit dropdown,
- Chapter dropdown,
- approved Topic/Subtopic dropdown,
- FULL/PARTIAL selector,
- mapping list with Edit/Delete,
- preview and validation status.

If a Chapter has no approved subtopics, the screen offers **Generate Suggestions** and then the Admin review/approval panel.

## 12. Admin Performance Experience

Add an Exam Performance area that can filter by:
- Student
- Subject
- Unit
- Chapter
- Topic/Subtopic
- Exam
- FULL/PARTIAL

Primary display should show chronological E-history rather than a cluttered flat table.

Example:

**Physics → Motion in a Plane → Vectors**
- E1 • PARTIAL • 20Q • 64%
- E2 • FULL • 30Q • 78%
- E3 • FULL • 30Q • 86%

Admin can drill from a scope record to the source exam and attempt.

## 13. Student Performance Experience

Student sees only scope-performance rows whose corresponding result is published.

Student view should show:
- Subject → Unit → Chapter → Topic drilldown
- E1/E2/E3 history
- FULL/PARTIAL
- question count
- score/max marks
- percentage
- improvement trend

No unpublished performance data is exposed through direct client queries or UI hiding alone; access must be enforced by RLS/server logic.

## 14. Legacy Exam Behavior

Existing submitted exam attempts/results remain untouched.

For an old exam without syllabus mapping:
- raw Results remain available exactly as today;
- no automatic syllabus-performance rows are fabricated;
- Admin can map that old exam later;
- after mapping, a safe **Rebuild Performance** Admin action can generate scope records from the already stored responses/results.

This avoids inaccurate historical classification.

## 15. Security and Integrity

- Keep all exam mutation Edge Functions JWT-protected.
- Mapping write operations require active Admin.
- Student reads require active Student and ownership.
- New mapping/performance tables use RLS.
- Direct anonymous access is denied.
- Destructive Exam Delete cascades new mapping and performance tables too.
- Reset Attempt cascades that attempt's performance rows.
- Re-Exam never deletes prior scope performance.

## 16. Testing Strategy

Implementation must use TDD and include at minimum:

1. Range parser tests: contiguous, mixed, spaces/Q-prefix, invalid syntax, overlap, out-of-range.
2. Mapping validation tests: unmapped, duplicate, disabled/unapproved Topic, marks mismatch, missing answer key.
3. Scoring tests: correct/wrong/unattempted, negative marking ON/OFF, negative scope score.
4. Weighted roll-up tests: Topic → Chapter → Unit.
5. Coverage tests: Topic FULL/PARTIAL and derived Chapter/Unit coverage.
6. E-sequence tests: first exam E1, re-exam E2, technical reset removes invalid sequence, multiple students independent.
7. Visibility tests: Admin immediate access, Student blocked until result publication.
8. Legacy safety tests: unmapped old exam produces no fabricated scope performance.
9. Regression tests for Phase-1 answer synchronization and Phase-2 audience/re-exam behavior.
10. Production migration preflight and post-deploy count verification.

## 17. Migration / Deployment Strategy

Use small isolated patches:

1. Add syllabus subtopic schema and suggestion/review mechanism.
2. Add mapping schema + parser/validator + Admin Range Mapping UI.
3. Add publish validation gate.
4. Add performance schema + server-side aggregation.
5. Add dynamic E-sequence view/query.
6. Add Admin Performance display.
7. Add Student Performance display and publication visibility rules.
8. Add legacy Rebuild Performance action.

Do not modify historical attempts/results during schema migration. Deploy only after confirming no active exam attempt would be disrupted by the grading-function version update.

## 18. Deferred Scope

Not part of this Phase-3 implementation:
- Student-entered offline/manual exams and Admin approval workflow
- final unified EXAMINATIONS master-tab navigation cleanup
- AI-enhanced subtopic suggestion service
- secondary/multi-tag scoring for a single question

The new syllabus and performance architecture is deliberately designed so Manual Exams can reuse it in the next phase.

## 19. Success Criteria

Phase-3 is successful when:

- Admin can approve Chapter-level subtopics from auto-suggestions.
- Admin can map every exam question with simple or mixed ranges.
- Server blocks publication until mapping and marks are valid.
- Student submission automatically creates accurate Topic/Chapter/Unit performance.
- Weighted scores and negative marking exactly match the official result rules.
- E1/E2/E3 is student-wise and scope-wise, with Reset vs Re-Exam semantics preserved.
- Admin sees performance immediately after submit.
- Student sees it only after result publication.
- Existing historical results are not altered or guessed.
- Existing answer-save and audience protections continue to pass regression tests.
