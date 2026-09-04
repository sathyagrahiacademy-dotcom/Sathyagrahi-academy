# Central Question Bank, Syllabus-Aware Import, and Exam Blueprint Design

**Date:** 2026-09-05  
**Project:** Sathyagrahi Academy NEET Portal  
**Status:** Approved design formalization

## Goal

Turn the current exam-derived Question Bank into a permanent reusable syllabus-aware Question Bank, make AI-generated Excel imports auto-map questions to the official NEET syllabus, and add a downloadable Exam Blueprint PDF.

The admin should enter syllabus classification once in the AI-generated Excel. The system must validate those labels against the canonical syllabus, save the question permanently in the central bank, create the exam snapshot, and create the scoring mapping automatically.

## Core principles

1. **Question Bank is permanent.** Deleting an exam must never delete the central Question Bank question.
2. **Exam questions are snapshots.** Historical exams must not change if a central-bank question is edited later.
3. **Canonical syllabus IDs are authoritative.** Excel text is only an import label; successful import resolves it to official Unit/Chapter/Topic IDs.
4. **No silent fuzzy mapping.** Normalized exact matching is automatic; ambiguous or invalid hierarchy is rejected for review rather than guessed.
5. **Mapping remains editable.** The existing Syllabus Range Mapping screen stays as a correction/manual fallback.
6. **Blueprint is structural, not an answer sheet.** It includes coverage, distribution and validation, but never the complete question text or correct-answer list.

## Data model

### `question_bank_questions`

Permanent admin-only master records:

- `id uuid primary key`
- `subject text` (`Physics`, `Chemistry`, `Biology`)
- `unit_id bigint -> neet_syllabus_units`
- `chapter_id bigint -> neet_syllabus_topics`
- `subtopic_id bigint -> neet_syllabus_subtopics`
- `question_text text`
- `option_a` / `option_b` / `option_c` / `option_d`
- `correct_option text`
- `explanation text nullable`
- `default_marks numeric`
- `default_negative_marks numeric`
- `difficulty text nullable` (`Easy`, `Medium`, `Hard`)
- `question_type text nullable`
- `source_label text nullable`
- `source_year integer nullable`
- `content_hash text unique` for normalized deduplication
- `created_by uuid`
- `is_active boolean default true`
- timestamps

Direct browser CRUD is not required. The table is service-role controlled and exposed through protected admin Edge Functions.

### `exam_questions` additions

- `bank_question_id uuid nullable -> question_bank_questions(id) ON DELETE SET NULL`
- `difficulty text nullable`
- `question_type text nullable`
- `source_label text nullable`
- `source_year integer nullable`

The existing question content remains in `exam_questions` as the immutable exam snapshot.

## Syllabus-aware Excel format

The download template becomes:

`Question No | Subject | Unit | Chapter | Topic | Question | Option A | Option B | Option C | Option D | Correct Answer | Marks | Negative Marks | Explanation | Difficulty | Question Type | Source | Source Year`

Required for automatic mapping:

- Question No
- Subject
- Unit
- Chapter
- Topic
- Question
- Options A-D
- Correct Answer
- Marks
- Negative Marks

Optional:

- Explanation
- Difficulty
- Question Type
- Source
- Source Year

### Canonical matching

Matching normalizes whitespace and case but does not guess semantics.

For each row:

1. Subject must be Physics, Chemistry or Biology.
2. Unit must match an official Unit under that Subject.
3. Chapter must match an official Chapter under that Unit.
4. Topic must match an **approved** official Topic/Subtopic under that Chapter.
5. If any step fails or has multiple candidates, the row is rejected with a precise `Needs Review` reason.

No invalid Unit/Chapter is auto-created. A missing Topic is not silently created during bulk import because scoring and performance require canonical approved topics.

## Atomic import flow

The current client performs file parsing/preview validation, but the server is authoritative.

`Excel/CSV -> admin-exam-questions bulk_add -> canonical syllabus resolve -> atomic SQL RPC`

The atomic transaction must, for every valid row:

1. Resolve canonical syllabus IDs.
2. Compute normalized content hash.
3. Reuse an identical existing central-bank question or insert a new one.
4. Insert the exam snapshot in `exam_questions`, retaining `bank_question_id`.
5. Insert the answer key.
6. Create/update a mapping group for the resolved Topic.
7. Create the question-to-syllabus map.
8. Return import totals: imported, bank-created, bank-reused, auto-mapped.

If any row fails, no partial import remains.

## Manual questions and manual mapping

The existing manual Add Question flow remains supported.

When an admin maps a manually created exam question to an approved Topic, the server should upsert that question into the central bank and set `exam_questions.bank_question_id`. This ensures the permanent bank is complete even when Excel is not used.

## Central Question Bank UI

Replace the current exam-derived query with a protected `admin-question-bank` Edge Function.

### Filters

- Search
- Subject
- Unit
- Chapter
- Topic
- Difficulty
- Question Type

### Table

- Subject
- Unit
- Chapter
- Topic
- Question preview
- Difficulty
- Type
- Marks
- Manage / Add to Exam

### Reuse

`ADD SELECTED TO EXAM` copies selected bank questions into a target draft exam as snapshots, adds answer keys and syllabus mappings automatically. The bank records remain unchanged.

## Exam Blueprint PDF

Add a `BLUEPRINT PDF` action for each exam in the Exams table.

### Blueprint data

A protected `admin-exams` action returns:

- Exam identity: title, subject/type, code, duration, marks, negative marking, status
- Exam Coverage scope
- Question counts and marks
- Canonical syllabus mapping labels
- Difficulty and question-type distribution
- Mapping validation status
- Audience mode and assigned count
- First valid submitted date when available

### PDF sections

1. Sathyagrahi Academy branded header
2. Exam Identity
3. Syllabus Coverage
4. Question Distribution
   - Subject
   - Unit
   - Chapter
   - Topic
5. Mapping Blueprint / question ranges
6. Marks Blueprint
7. Difficulty and Question Type distribution
8. Validation Status
   - total questions
   - mapped questions
   - valid answer keys
   - marks match
   - publish readiness
9. Audience / Conduct information

### Draft vs Final

- Incomplete exam: `DRAFT BLUEPRINT`
- Fully validated publish-ready exam: `FINAL BLUEPRINT`

The PDF does not contain passwords, full question paper, or correct answers.

## Security

- New permanent Question Bank table: RLS enabled, direct `anon`/`authenticated` DML revoked, service-role access only.
- All bank operations use a JWT-protected admin Edge Function and verify `profiles.role='admin'` + `is_active=true`.
- Blueprint data endpoint is admin-only and does not expose exam passwords or password hashes.
- Existing student exam/access/result endpoints are unchanged.

## Compatibility

- Existing range mapping UI remains functional.
- Existing grading, attempts, results, re-exam, reset, performance and publish validation remain unchanged.
- Existing exam snapshots are not rewritten by the migration.
- There are currently no exam questions in production, so no historical question-bank migration is required.

## Success criteria

1. AI-generated syllabus-aware Excel can import an exam without manual range mapping when all labels are canonical.
2. Imported questions appear permanently in the Question Bank under the correct Subject -> Unit -> Chapter -> Topic.
3. Deleting the exam leaves the Question Bank questions intact.
4. Reusing bank questions into another exam creates independent exam snapshots and automatic syllabus mappings.
5. Manual question mapping also syncs the question to the bank.
6. Invalid or ambiguous syllabus labels are rejected before writes with row-level reasons.
7. Blueprint PDF downloads from the Exams page and accurately reflects draft/final status and distributions.
8. Existing exam, grading and performance regression tests remain green.
