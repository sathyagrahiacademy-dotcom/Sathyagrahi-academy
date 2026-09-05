# Examination Intelligence System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Sathyagrahi Academy Examination Branch so Daily/Unit/Monthly exams become server-defined, traceable preparation data that drives secure question-time, coverage, difficulty, retention and mentor-guidance intelligence.

**Architecture:** Preserve the existing Exam → Questions → Mapping → Publish → Attempt → Results → Performance architecture. Add small pure policy modules for deterministic rules, additive schema for exam metadata and per-question activity, and extend the existing Edge Functions/UI rather than introducing a parallel exam system. Legacy exams without `exam_type` remain functional.

**Tech Stack:** Static HTML/CSS/JS on GitHub Pages, Node built-in test runner, Supabase Postgres 17, Supabase Auth, Supabase Edge Functions (Deno/TypeScript), existing jsPDF exam blueprint flow.

**Spec:** `docs/superpowers/specs/2026-09-05-examination-intelligence-system-design.md`

## Global Constraints

- Preserve the existing Examination Branch flow and historical exam snapshots.
- Official new exam types are Daily (`DLY`), Unit (`UNT`) and Monthly (`MON`).
- Daily = 45 questions / 45 minutes / 180 marks; Unit and Monthly = 180 questions / 180 minutes / 720 marks.
- Official marking is +4 / -1 / 0.
- Unit/Monthly mapped distribution is Physics 45 / Chemistry 45 / Biology 90.
- Exam Type, Exam Date and generated Exam Code are immutable after creation.
- Existing strict full-batch Question Bank import remains atomic; no partial import.
- Existing answer save/submit/grading path remains authoritative and must not depend on activity tracking.
- No answer keys in normal unauthenticated/browser-readable payloads before result visibility allows them.
- No service-role key in browser code.
- New server-owned public-schema tables must enable RLS and revoke direct anon/authenticated access unless a deliberate safe policy is added.
- Existing legacy exams without `exam_type` continue under old behavior.

---

### Task 1: Lock Pure Examination Policy

**Files:**
- Create: `supabase/functions/_shared/exam-intelligence-policy.mjs`
- Create: `exam-intelligence-policy.test.mjs`

**Interfaces:**
- Produces `EXAM_TYPES`, `normaliseExamType(value)`, `templateForExamType(type)`, `buildExamCode({type,date,sequence})`, `allowedQuestionTypes(subject)`, `validateQuestionType(subject,type)`, `validateOfficialQuestionMarking({marks,negativeMarks})`, `validateExamTemplateCounts({examType,examSubject,totalQuestions,subjectCounts})`.

- [ ] **Step 1: Write failing policy tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  templateForExamType,
  buildExamCode,
  validateQuestionType,
  validateOfficialQuestionMarking,
  validateExamTemplateCounts
} from './supabase/functions/_shared/exam-intelligence-policy.mjs'

test('Daily exam template is fixed at 45 questions / 45 min / 180 marks',()=>{
  assert.deepEqual(templateForExamType('daily'),{code:'DLY',questions:45,durationMinutes:45,totalMarks:180,negativeMarking:true})
})

test('buildExamCode uses academy type date and three-digit sequence',()=>{
  assert.equal(buildExamCode({type:'unit',date:'2026-09-20',sequence:2}),'SGA-UNT-20260920-002')
})

test('Biology rejects Circuit Based question format',()=>{
  assert.equal(validateQuestionType('Biology','Circuit Based').ok,false)
})

test('official bank marking requires +4 and -1',()=>{
  assert.equal(validateOfficialQuestionMarking({marks:4,negativeMarks:1}).ok,true)
  assert.equal(validateOfficialQuestionMarking({marks:3,negativeMarks:1}).ok,false)
})

test('Monthly exam requires 45 Physics 45 Chemistry 90 Biology',()=>{
  assert.equal(validateExamTemplateCounts({examType:'monthly',examSubject:'NEET',totalQuestions:180,subjectCounts:{Physics:45,Chemistry:45,Biology:90}}).ok,true)
  assert.equal(validateExamTemplateCounts({examType:'monthly',examSubject:'NEET',totalQuestions:180,subjectCounts:{Physics:50,Chemistry:40,Biology:90}}).ok,false)
})
```

- [ ] **Step 2: Run RED**

Run: `node --test exam-intelligence-policy.test.mjs`
Expected: FAIL because `exam-intelligence-policy.mjs` does not exist.

- [ ] **Step 3: Implement minimal pure policy**

Use immutable constant maps for the three templates and the exact subject question-format lists from the approved spec. `buildExamCode` must reject invalid dates/sequences and always zero-pad sequence to three digits.

- [ ] **Step 4: Run GREEN**

Run: `node --test exam-intelligence-policy.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run existing pure Examination tests**

Run: `node --test exam-*.test.mjs admin-exam-*.test.mjs question-bank-*.test.mjs`
Expected: all existing tests PASS.

---

### Task 2: Add Additive Database Foundation

**Files:**
- Create: `EXAMINATION_INTELLIGENCE_FOUNDATION_MIGRATION.sql`
- Create: `exam-intelligence-schema.test.mjs`

**Interfaces:**
- Adds nullable legacy-safe columns to `public.exams`: `exam_type`, `exam_date`, `expected_questions`.
- Adds immutable generated-code sequence support table `exam_code_counters` or an equivalent collision-safe SQL function.
- Adds `exam_question_activity` keyed by `(attempt_id,question_id)`.
- Adds service-role-only `record_exam_question_activity(...)` if an additive SQL helper is used.

- [ ] **Step 1: Write failing schema contract test**

Test must read the migration SQL and assert it contains:
- `exam_type`, `exam_date`, `expected_questions`;
- a check limiting exam_type to `daily/unit/monthly` while allowing NULL legacy rows;
- unique/collision-safe exam-code generation support;
- `exam_question_activity` with `active_seconds`, `visit_count`, `answer_change_count`, `first_viewed_at`, `last_viewed_at`;
- RLS enabled on new server-owned tables;
- anon/authenticated privileges revoked;
- ownership/filter indexes on `attempt_id` and `question_id`.

- [ ] **Step 2: Run RED**

Run: `node --test exam-intelligence-schema.test.mjs`
Expected: FAIL because migration file does not exist.

- [ ] **Step 3: Write migration**

Use additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. Preserve NULL for old exams. Use an atomic Postgres function to allocate `{type,date}` sequence and compose `SGA-{TYPE}-{YYYYMMDD}-{NNN}`. Restrict helper execution to `service_role`.

- [ ] **Step 4: Run GREEN**

Run: `node --test exam-intelligence-schema.test.mjs`
Expected: PASS.

- [ ] **Step 5: Apply migration to production only after branch regression is green**

Before application, read current production counts/constraints. Apply once through the connected Supabase project, then verify columns, constraints, indexes, RLS and grants with read-only SQL.

---

### Task 3: Server-Defined Exam Creation and Auto Code

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`
- Create: `admin-exam-intelligence-contract.test.mjs`

**Interfaces:**
- `admin-exams` create consumes `examType` and `examDate`; ignores/rejects admin-supplied exam code for official types; allocates code server-side.
- Update rejects changes to existing non-null `exam_type` or `exam_date`.
- UI shows Exam Type and Exam Date; official template duration/marks are read-only derived values; Exam Code is read-only and generated on create.

- [ ] **Step 1: Write failing source/contract tests**

Assert UI contains `examType` and `examDate`, code input is readonly/generated-copy, and backend imports/uses the shared policy. Assert official create path calls server-side code allocation and never trusts `body.examCode` for a new official exam.

- [ ] **Step 2: Run RED**

Run: `node --test admin-exam-intelligence-contract.test.mjs`
Expected: FAIL on missing controls/backend policy use.

- [ ] **Step 3: Implement backend create/update rules**

For official create:
1. normalize type;
2. validate ISO exam date;
3. derive template;
4. validate title/subject/scope as today;
5. allocate code atomically;
6. insert exam with derived `duration_minutes`, `total_marks`, `negative_marking`, `expected_questions`, `exam_type`, `exam_date`;
7. insert `exam_access` with generated code and password hash;
8. preserve existing cleanup-on-failure behavior.

For legacy update, preserve existing behavior. For official update, retain type/date/code and derived template values.

- [ ] **Step 4: Implement UI**

Create form order:
Exam Type → Exam Date → Exam Title → Subject/Coverage → Scope → derived Duration/Questions/Marks → generated Exam Code → Password → Instructions.

- [ ] **Step 5: Run GREEN + existing exam tests**

Run new contract test plus existing exam scope/audience/publish tests.

---

### Task 4: Subject-Specific Question Format Validation

**Files:**
- Modify: `supabase/functions/admin-question-bank/import-policy.mjs`
- Modify: `question-bank-import-policy.test.mjs`
- Modify: `admin-question-bank.html`
- Modify: `admin-question-bank.js`

**Interfaces:**
- Import policy calls shared `validateQuestionType` and `validateOfficialQuestionMarking`.
- Bank UI exposes approved question-format options/legend by subject without breaking existing free-text historical rows.

- [ ] **Step 1: Add failing tests**

Add cases:
- Physics `Circuit Based` accepted;
- Biology `Circuit Based` rejected;
- Chemistry `Reaction / Product` accepted;
- unsupported type rejected with row-specific error;
- marks other than 4 rejected;
- negative marks other than 1 rejected.

- [ ] **Step 2: Run RED**

Run: `node --test question-bank-import-policy.test.mjs`
Expected: new cases FAIL.

- [ ] **Step 3: Implement policy validation**

Keep all previous required-field, canonical syllabus, duplicate Question No and full-batch rules intact.

- [ ] **Step 4: Run GREEN**

Run import-policy and Question Bank contract tests.

---

### Task 5: Publish Template Validation and Derived Exam Notices

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Modify: `supabase/functions/student-exam-access/index.ts`
- Modify: `student-notifications.js`
- Create: `exam-template-publish.test.mjs`
- Create: `exam-notification-contract.test.mjs`

**Interfaces:**
- Publish computes mapped subject counts using approved syllabus hierarchy and shared template policy.
- `student-exam-access` returns eligible published exam metadata including type/date/code/template values.
- Student Notifications merges generic notifications with derived eligible exam notices.

- [ ] **Step 1: Write failing publish tests**

Test pure helper/contract paths for Unit/Monthly 45/45/90, Daily single-subject purity and mixed Daily total 45.

- [ ] **Step 2: Run RED**

Run new tests; expected FAIL because publish template validation/notice shape is missing.

- [ ] **Step 3: Implement publish gate**

Legacy `exam_type IS NULL` uses current mapping validation only. Official exams require both current mapping gate and template-count gate.

- [ ] **Step 4: Implement derived notices**

Student notice list must only include exams the authenticated student can attempt. Unpublish naturally removes the notice. No generic notification row is inserted for an exam.

- [ ] **Step 5: Run GREEN**

Run new tests plus audience/student-access/publish tests.

---

### Task 6: Question Active-Time and Answer-Change Tracking

**Files:**
- Modify: `supabase/functions/student-exam-attempt/index.ts`
- Modify: `student-exam-attempt.js`
- Create: `exam-question-activity-policy.mjs`
- Create: `exam-question-activity.test.mjs`

**Interfaces:**
- Client sends `action:'activity'` with `attemptId`, `questionId`, `activeSecondsDelta`, `visitDelta`, `answerChangeDelta`, `eventId`.
- Server validates active owned attempt and exam question then writes through additive activity helper.
- Activity failure never invalidates a successfully saved answer.

- [ ] **Step 1: Write failing pure activity tests**

Test delta normalization: no negative values, sensible per-event active-time cap, integer visit/change deltas, stable event IDs.

- [ ] **Step 2: Run RED**

Expected FAIL because activity policy module is missing.

- [ ] **Step 3: Implement server action**

Validate ownership and question membership before service-role write. Keep answer save/submit code unchanged except optional best-effort activity flush.

- [ ] **Step 4: Implement visibility-aware client tracker**

Track only while `document.visibilityState === 'visible'`. Flush on question navigation, before submit, and when visibility changes to hidden. Increment answer-change only when a previously non-null answer changes to a different non-null option.

- [ ] **Step 5: Run GREEN and answer-reliability regression**

Run activity tests plus `exam-attempt-sync-utils.test.js` and `exam-submit-sync.test.mjs`.

---

### Task 7: Enrich Answered Question Paper

**Files:**
- Modify: `supabase/functions/exam-performance/index.ts` or the existing result-detail endpoint used by student results
- Modify: `student-results.js`
- Modify: `student-results.html` only if layout hooks are required
- Create: `student-answered-paper-intelligence.test.mjs`

**Interfaces:**
- Published-result detail includes safe per-question difficulty/topic/time/change/explanation fields along with the already-authorized answer-key information.

- [ ] **Step 1: Write failing visibility/shape test**

Assert answer intelligence is only returned through published-result visibility path and contains no data for another student.

- [ ] **Step 2: Run RED**

Expected FAIL because time/change enrichment is absent.

- [ ] **Step 3: Implement backend join**

Join attempt-owned activity and snapshot/bank metadata without changing grading totals.

- [ ] **Step 4: Implement UI rows**

Show `Time Taken` and `Answer Changed` beside Difficulty and Topic in the answered-paper section.

- [ ] **Step 5: Run GREEN**

Run visibility/performance/results regressions.

---

### Task 8: Performance Intelligence and Mentor Guidance

**Files:**
- Create: `supabase/functions/exam-performance/intelligence-logic.mjs`
- Create: `exam-performance-intelligence.test.mjs`
- Modify: `supabase/functions/exam-performance/index.ts`
- Modify: `exam-performance-ui-utils.js`
- Modify: `admin-performance.js`
- Modify: `admin-performance.html`
- Modify: `admin-examinations-nav.js` text label only

**Interfaces:**
- Pure `buildPerformanceIntelligence(input)` returns summary, scope rows and mentor signals.
- Metrics include total faced, unique bank faced, coverage, repeats, difficulty accuracy, active-time average, trend, retention and evidence label.

- [ ] **Step 1: Write failing deterministic intelligence tests**

Cases:
- high accuracy + low coverage never returns Mastered;
- sustained low accuracy with sufficient evidence returns Weak;
- later wrong answer to previously correct same bank question creates retention signal;
- slow topic produces speed issue;
- low coverage produces coverage gap;
- next-exam focus prioritizes weak/low-coverage evidence.

- [ ] **Step 2: Run RED**

Expected FAIL because intelligence module is missing.

- [ ] **Step 3: Implement minimal deterministic logic**

No AI service calls. Thresholds are named constants inside the pure module and can be revised later.

- [ ] **Step 4: Extend backend inputs**

Load only the student’s eligible exam attempts, linked bank IDs, question difficulty, mappings and activity rows. Compute intelligence server-side and return display-safe metrics.

- [ ] **Step 5: Upgrade Performance UI**

Rename branch label to `Performance Intelligence`. Add overview, topic drill-down metrics and mentor-guidance blocks while retaining existing exact E-history.

- [ ] **Step 6: Run GREEN**

Run new intelligence tests plus all existing performance tests.

---

### Task 9: Full Regression, Security Review, Merge and Production Verification

**Files:**
- No feature file changes unless verification finds a defect.

**Interfaces:**
- Produces verified PR and production deployment state.

- [ ] **Step 1: Run full Examination suite**

Run all root `exam-*.test.mjs`, `admin-exam-*.test.mjs`, `question-bank-*.test.mjs`, `exam-attempt-sync-utils.test.js` and new intelligence tests.

- [ ] **Step 2: Security review**

Verify new activity/counter tables RLS and grants; verify helper execute privileges; verify Edge Functions require authenticated student/admin as appropriate; verify service-role secrets remain server-only.

- [ ] **Step 3: Database integrity smoke**

Read-only checks for orphan activity rows, duplicate `(attempt_id,question_id)`, invalid official exam templates, duplicate exam codes and legacy row preservation.

- [ ] **Step 4: Create PR and inspect diff**

Confirm only intended Examination files changed. Review for answer-key leakage, historical mutation and audience bypass.

- [ ] **Step 5: Merge verified PR to `main`**

Use the repository’s normal merge flow once tests/security gates are green.

- [ ] **Step 6: Verify GitHub Pages deployment**

Confirm Pages workflow success for the merged SHA and compare critical deployed artifact files to `main` where artifact access is available.

- [ ] **Step 7: Verify deployed Edge Functions and production schema**

Confirm active function versions and read-only production constraints/grants. Do not claim authenticated visual browser verification unless a real authenticated browser session is actually used.
