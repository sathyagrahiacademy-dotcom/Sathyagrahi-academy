# Examinations Phase 2 — Create Exam Wizard, Blueprint, Audience & Setup Workspace Implementation Plan

> **Execution mode:** Inline, task-by-task. Required skills: `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` on failures, and `superpowers:verification-before-completion` before completion claims.

**Goal:** Implement the approved six-step Create Exam workflow and setup-side Exam Workspace on top of Phase 1, switch new official exam creation to the final DT/WT/MT/GT + Batch + `SGA-{TYPE}-{BATCH2}{DDMM}` contract, and make publish readiness depend on structured coverage, question/mapping/key completeness, blueprint approval, audience, and result-release settings.

**Architecture:** Keep all Phase 2 UI and backend code dormant behind `window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED===true` until coordinated release. Extend the current `admin-exams` Edge Function and existing question-bank/question-management flows rather than replacing stable systems. Persist only canonical IDs and explicit planned counts; reconstruct wizard progress from stored exam/scope/question/assignment facts rather than storing arbitrary client-only status.

**Tech:** Static HTML/CSS/vanilla JS, Node 22 tests, Supabase Postgres/Auth/Edge Functions, existing Question Bank import/mapping engine, existing jsPDF blueprint generator, GitHub Actions.

**Source of truth:** `docs/superpowers/specs/2026-09-08-examinations-master-architecture-design.md`

## Global constraints

- Work only on `feature/examinations-master-phase-2` based on merged Phase 1 `main`.
- TDD: failing contract/policy test first, verify RED, minimal implementation, verify GREEN, then regression.
- Do not enable the master feature flag in production during Phase 2.
- Do not apply migrations or deploy Edge Functions in Phase 2 implementation commits.
- Final create types: `daily`, `weekly`, `monthly`, `grand`. Historical `unit` is read-only compatibility only.
- New official exam code: exactly `SGA-{DT|WT|MT|GT}-{BATCH2}{DDMM}` via `allocate_exam_code_v2`.
- Batch is Academy Batch Number, integer 1–99.
- Do not invent fixed WT/MT/GT question count, duration, or marks templates. Question count and duration are explicit Admin inputs. Total marks follows the official +4 per valid question rule.
- Daily Tests have no fixed common start/end time. Phase 2 stores duration and result-release configuration only.
- Result release modes are `manual` or `scheduled`; scheduled requires exact publication date/time. No immediate per-student AUTO mode.
- Exam publish notification never includes password.
- Canonical syllabus IDs only; no silent fuzzy mapping.
- Old exam snapshots/history are not rewritten.
- Student attempt, grading, countdown, result correction, PDF versioning, credentials register, and final Action Required engine beyond setup issues remain later phases.

---

## Task 1 — Lock Phase 2 Wizard Policy

**Create:**
- `supabase/functions/admin-exams/wizard-policy.mjs`
- `exam-wizard-policy.test.mjs`

**Pure interfaces:**

```js
normaliseWizardBasics(input)
suggestExamTitle({type,batch,date})
normaliseCoverageRows(rows,{syllabusLookup})
detectCoverageOverlap(rows)
buildWizardReadiness(input)
validateResultRelease({mode,publishAt})
```

**Required behavior:**
- Type must be Daily/Weekly/Monthly/Grand only.
- Batch 1–99.
- Date must be real `YYYY-MM-DD`.
- Expected questions integer >0.
- Duration integer >0.
- Total marks = expected questions × 4; browser may preview it but server is authoritative.
- Negative mark = 1 for wrong answer and 0 unattempted for official NEET tests.
- Coverage row contains canonical `subject`, `unitId`, `chapterId`, optional `subtopicId`, and `plannedQuestions >0`.
- Duplicate exact coverage rows blocked.
- Topic row overlapping a Whole Chapter row in the same chapter returns warning/blocking issue rather than silently saving both.
- Planned coverage grand total must equal expected questions before blueprint approval.
- `manual` result release requires no time.
- `scheduled` requires valid timestamp in the future at save/publish validation time.

**RED:** module absent.

**GREEN verification:** wizard policy tests + master policy + scope logic + publish validation contracts.

---

## Task 2 — Additive Phase 2 Schema Source

**Create:**
- `EXAMINATIONS_MASTER_PHASE2_MIGRATION.sql`
- `examinations-master-phase2-schema.test.mjs`

**Additive changes:**

```text
exam_scope_items.planned_questions integer nullable for legacy
```

For new master exams `planned_questions` must be positive when supplied.

Extend/create a v3 scope replacement RPC rather than changing historical rows in place:

```sql
replace_exam_scope_items_v3(p_exam_id uuid,p_items jsonb,p_created_by uuid)
```

The RPC stores canonical unit/chapter/subtopic IDs, deterministic sort order, and planned question count atomically. It rejects duplicate exact rows and invalid non-positive planned counts.

Do not drop `replace_exam_scope_items_v2`; historical/legacy paths keep it.

No deployment in this task.

---

## Task 3 — Final Master Create / Basic Update Server Contract

**Modify:**
- `supabase/functions/admin-exams/index.ts`

**Create tests:**
- `admin-exam-wizard-basic-contract.test.mjs`

**Actions:**

```text
wizard_bootstrap
create_master_exam
update_master_basics
```

`wizard_bootstrap` returns canonical syllabus tree + active student summary + supported master types, never passwords/answer data.

`create_master_exam`:
- validates master wizard basics with pure policy;
- inserts Draft exam with `batch_no`, `result_publish_mode`, optional `result_publish_at`;
- derives `total_marks = expected_questions*4`;
- uses `allocate_exam_code_v2(examType,batchNo,examDate)`;
- stores only password hash in existing `exam_access` for Phase 2;
- returns generated exam code plus exam id;
- rolls back/cleans partial rows on access/code/scope failure.

`update_master_basics`:
- Draft/Ready only;
- type, batch, exam date, and code become immutable after master exam creation;
- title, expected question count, duration, instructions, result-release mode/time may be changed before publish;
- optional new password means replace hash; blank means keep current hash.

Existing legacy `create/update` remain for stable fallback while feature flag is off.

---

## Task 4 — Six-Step Wizard UI Shell + Step 1 Basic Details

**Modify:**
- `admin-exams.html`
- `admin-examinations-nav.js`

**Create:**
- `admin-exam-wizard.js`
- `admin-exam-wizard-ui.test.mjs`

When master flag is ON, `+ CREATE EXAM` opens a six-step wizard:

1. Basic Details
2. Coverage / Syllabus
3. Questions
4. Blueprint & Validation
5. Students / Audience
6. Publish / Result Release

Step 1 UI:
- Test Type DT/WT/MT/GT
- Batch
- Exam Date
- Title auto-suggest editable
- Exam Code preview read-only based on final format
- Auto-generated password with SHOW / COPY / REGENERATE / MANUAL CHANGE before save
- Expected Questions
- Duration Minutes
- Total Marks derived read-only
- +4 / −1 / 0 strip
- Result Publication Mode Manual/Scheduled; schedule date/time visible only for Scheduled
- Instructions

On first successful Step 1 save, create Draft exam and hold `examId` for subsequent steps.

Do not expose stored password later in Phase 2; after Step 1 save, UI may show the password only from the in-memory creation session. Full recoverable Credentials Register comes in Phase 5.

---

## Task 5 — Step 2 Structured Coverage with Planned Counts

**Modify/Create:**
- `exam-scope-ui-utils.js`
- `admin-exam-wizard.js`
- `supabase/functions/admin-exams/index.ts`
- `exam-wizard-coverage.test.mjs`

Server actions:

```text
get_master_scope
replace_master_scope
```

Each row:

`Subject | Unit | Chapter | Topic / Whole Chapter | Questions Planned`

UI and server both enforce canonical parent-child relationships. Server is authoritative.

Display continuously:
- Physics planned
- Chemistry planned
- Biology planned
- Total planned / expected

Exact duplicate blocked. Whole Chapter + specific Topic overlap in same chapter shown as explicit conflict to resolve. No silent normalization that changes Admin selection.

Step 2 completion requires total planned == expected questions.

---

## Task 6 — Step 3 Questions: Reuse Existing Question Engine + Add Bank Selection

**Modify:**
- `admin-exam-questions.html`
- `admin-exam-questions.js`
- `supabase/functions/admin-question-bank/index.ts` only if required by existing contract

**Create tests:**
- `exam-wizard-questions-integration.test.mjs`

Required methods visible from Step 3:
- FROM QUESTION BANK
- EXCEL IMPORT
- MANUAL QUESTION

Reuse existing Excel import and manual-question flows. Add a focused Question Bank selection path if the existing Question Bank lacks “attach to exam” selection.

Question summary must show:
- Expected vs Added total
- Physics/Chemistry/Biology counts
- Mapped count
- Answer-key count
- row: QNo / Subject / Topic / Difficulty / Type / Source / Status

Existing exact auto-mapping behavior remains: exact normalized canonical match only; suggestions require explicit approval; unmapped/needs-review questions block blueprint approval.

Question Bank master records and exam snapshots stay separate; bank edits do not mutate old exam questions.

Provide `BACK TO EXAM SETUP` link to the wizard at Step 3.

---

## Task 7 — Step 4 Blueprint Validation + Approval

**Modify:**
- `supabase/functions/admin-exams/publish-validation.mjs`
- `supabase/functions/admin-exams/index.ts`
- `admin-exam-blueprint.js`
- `admin-exam-wizard.js`

**Create:**
- `exam-blueprint-approval.test.mjs`

Server actions:

```text
master_blueprint_validation
approve_master_blueprint
```

Validation requires:
- question count == expected
- marks == expected × 4 effective pre-invalidation max
- every question has valid key
- every question has approved syllabus mapping
- subject counts satisfy planned coverage totals
- no unresolved duplicate/overlap/mapping errors

Response is `EXAM READY` or `ACTION REQUIRED` with exact issues and navigation target.

Approval writes `blueprint_approved_at` only after green validation.

Any later Draft/Ready change to basics, coverage, questions, keys, or mapping invalidates approval (`blueprint_approved_at = null`) and requires re-approval.

Blueprint PDF continues to exclude password and answer key.

---

## Task 8 — Step 5 Audience Assignment in Wizard

**Modify:**
- `supabase/functions/admin-exams/index.ts`
- `admin-exam-wizard.js`

**Create:**
- `exam-wizard-audience.test.mjs`

Reuse existing `students` / `applyAudience` logic but expose wizard-safe action:

```text
master_students
save_master_audience
```

Modes:
- All Active Students
- Selected Students

UI: Name / Student ID / Batch if available / Assigned, with search, Select All, Clear All.

No inactive students, no duplicate assignments.

Step completion requires assigned count >0.

Post-publish attempt-sensitive unassignment remains later safety workflow; do not weaken existing rules.

---

## Task 9 — Step 6 Final Publish / Portal Notification / Result Release Configuration

**Modify:**
- `supabase/functions/admin-exams/index.ts`
- `supabase/functions/admin-exams/publish-validation.mjs`
- `admin-exam-wizard.js`
- student notification integration only through existing Academy communications/internal path

**Create:**
- `exam-master-publish-contract.test.mjs`

Server action:

```text
publish_master_exam
```

Publish requires:
- master basics valid
- structured coverage planned totals valid
- questions/keys/mappings valid
- blueprint approved and still current
- assigned students >0
- result-release configuration valid

Publish sets student-visible exam availability but does not impose a common Daily Test start time.

Portal notification includes:
- exam name
- code
- date
- duration
- marks
- syllabus/coverage summary
- “Start Anytime while available” wording for Daily Test
- result release wording

Notification must not contain password.

No result email is sent at publish.

---

## Task 10 — Setup-Side Exam Workspace

**Create:**
- `admin-exam-workspace.html`
- `admin-exam-workspace.js`
- `admin-exam-workspace.test.mjs`

**Modify:**
- `admin-exam-control-center.js`

Workspace tabs required now:

`OVERVIEW | COVERAGE | QUESTIONS | BLUEPRINT | STUDENTS`

Reserve visible disabled/future tabs for later phases only if useful:

`LIVE | RESULTS | PERFORMANCE | FILES | AUDIT`

Overview shows:
- Exam title/code/type/batch/date/duration
- Questions ready
- Mapping
- Assigned students
- Result mode
- Blueprint status
- Current lifecycle
- Next Action

Control Center actions for master exams route into the Workspace rather than scattered pages. Existing legacy exams continue current routes.

---

## Task 11 — Phase 2 Integration / Dormant Production Gate / CI

**Modify tests/workflow only as needed:**
- `.github/workflows/examination-intelligence.yml`
- production gate contracts

Final verification on exact branch head:

```bash
node --test *.test.js *.test.mjs *.test.cjs
node --check admin-exams.js
node --check admin-exam-wizard.js
node --check admin-exam-workspace.js
node --check admin-exam-questions.js
for f in *.js; do node --check "$f"; done
npx --yes esbuild@0.25.9 supabase/functions/admin-exams/index.ts --bundle --platform=browser --format=esm --external:npm:* --external:jsr:* --outfile=/tmp/admin-exams.js
```

Also parse any modified question-bank Edge Function.

Before PR:
- compare branch to current `main`;
- ensure no student attempt/result/performance/morning communication implementation files changed unless explicitly required by Task 9 notification contract;
- ensure master flag remains OFF by default;
- ensure no migration/deploy was executed;
- ensure no fixed Daily Test start/end or AUTO result publication reappeared;
- ensure new official create path uses `allocate_exam_code_v2` only.

Create PR only after exact final head CI is green. Merge only after explicit user approval and production-safety review.
