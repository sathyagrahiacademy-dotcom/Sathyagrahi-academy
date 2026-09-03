# Exam Answer Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent loss of selected exam answers by adding immediate server save, server-confirmed palette state, save-before-navigation, and a server-validated full-answer sync before grading.

**Architecture:** Keep the existing browser exam page and Supabase Edge Function, but separate local draft state from server-confirmed state. Add a small testable browser utility for full snapshots and status decisions. Extend the `student-exam-attempt` Edge Function so `submit` validates and persists a complete snapshot of every exam question before grading; normal `save` remains the lightweight per-question autosave path.

**Tech Stack:** Static HTML/JavaScript, Supabase JS v2, Supabase Edge Functions on Deno/TypeScript, PostgreSQL, Node `assert` tests.

**Spec:** `docs/superpowers/specs/2026-09-04-examinations-management-design.md`

## Global Constraints

- Preserve the existing stable live examination flow and implement this as an isolated patch.
- Server remains authoritative for timer, active-attempt status, final submission, and grading.
- A question is visually counted as Answered only after its current state has been confirmed by the server.
- Navigation must not silently discard a pending answer.
- Final submission must not grade an active attempt until the submitted full snapshot covers every exam question exactly once.
- Keep JWT verification enabled on `student-exam-attempt`.
- Do not modify existing submitted result data while deploying this reliability patch.
- Do not change publish/reset/re-exam architecture in this phase.

---

## File Structure

- Create `exam-attempt-sync-utils.js` — pure browser/Node-compatible helpers for normalized answer snapshots and confirmed-status calculation.
- Create `exam-attempt-sync-utils.test.js` — Node assertions for complete snapshot creation, missing-question detection, and server-confirmed palette behavior.
- Modify `student-exam-attempt.html` — load the helper before the exam controller and add a compact save-state indicator.
- Modify `student-exam-attempt.js` — draft/confirmed answer state, serialized per-question autosave, save-before-navigation, full final sync payload, and recoverable error handling.
- Create `supabase/functions/student-exam-attempt/index.ts` — version-controlled copy of the production Edge Function with full-snapshot validation and submit-time persistence.
- Deploy Supabase Edge Function `student-exam-attempt` from the version-controlled source after tests pass.

### Task 1: Add testable answer snapshot and confirmation helpers

**Files:**
- Create: `exam-attempt-sync-utils.js`
- Create: `exam-attempt-sync-utils.test.js`

**Interfaces:**
- Produces: `normaliseAnswer(value)` -> `null | 'A' | 'B' | 'C' | 'D'`
- Produces: `buildFullSnapshot(questions, responses)` -> `Array<{questionId:string,selectedOption:null|'A'|'B'|'C'|'D',markedForReview:boolean}>`
- Produces: `snapshotQuestionIds(snapshot)` -> `string[]`
- Produces: `isConfirmedCurrent(qid, responses, confirmed)` -> `boolean`
- Produces: `statusForQuestion({questionId,response,visited,confirmedCurrent})` -> one of `notvisited|notanswered|answered|review|reviewanswered`

- [ ] **Step 1: Write the failing Node test**

Create `exam-attempt-sync-utils.test.js` with assertions that:

```js
const assert = require('assert');
const u = require('./exam-attempt-sync-utils.js');

const questions = [{id:'q1'},{id:'q2'},{id:'q3'}];
const responses = {
  q1:{selected_option:'b',marked_for_review:false},
  q2:{selected_option:null,marked_for_review:true}
};
const snapshot = u.buildFullSnapshot(questions,responses);
assert.deepStrictEqual(snapshot,[
  {questionId:'q1',selectedOption:'B',markedForReview:false},
  {questionId:'q2',selectedOption:null,markedForReview:true},
  {questionId:'q3',selectedOption:null,markedForReview:false}
]);
assert.deepStrictEqual(u.snapshotQuestionIds(snapshot),['q1','q2','q3']);
assert.strictEqual(u.statusForQuestion({questionId:'q1',response:responses.q1,visited:true,confirmedCurrent:false}),'notanswered');
assert.strictEqual(u.statusForQuestion({questionId:'q1',response:responses.q1,visited:true,confirmedCurrent:true}),'answered');
assert.strictEqual(u.statusForQuestion({questionId:'q2',response:responses.q2,visited:true,confirmedCurrent:true}),'review');
console.log('exam-attempt-sync-utils tests passed');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node exam-attempt-sync-utils.test.js
```

Expected: FAIL because `exam-attempt-sync-utils.js` or required exports do not exist.

- [ ] **Step 3: Implement the minimal helper module**

Create a browser/CommonJS wrapper that exports the five functions. `buildFullSnapshot` must iterate the authoritative `questions` array, so even untouched questions appear with `selectedOption:null`. `statusForQuestion` must never return `answered` or `reviewanswered` when `confirmedCurrent` is false.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
node exam-attempt-sync-utils.test.js
```

Expected: `exam-attempt-sync-utils tests passed`.

- [ ] **Step 5: Commit**

```bash
git add exam-attempt-sync-utils.js exam-attempt-sync-utils.test.js
git commit -m "test: add exam answer sync state helpers"
```

### Task 2: Make browser answer state autosave-safe

**Files:**
- Modify: `student-exam-attempt.html`
- Modify: `student-exam-attempt.js`
- Test: `exam-attempt-sync-utils.test.js`

**Interfaces:**
- Consumes: `window.sgaExamAttemptSync.buildFullSnapshot`
- Consumes: `window.sgaExamAttemptSync.isConfirmedCurrent`
- Consumes: `window.sgaExamAttemptSync.statusForQuestion`
- Produces internal browser function: `queueSave(questionId, state)` -> Promise resolving after the latest state for that question is server-confirmed.
- Produces internal browser function: `flushQuestion(questionId)` -> Promise.
- Produces internal browser function: `flushAllPending()` -> Promise.

- [ ] **Step 1: Add helper script and save-state UI**

In `student-exam-attempt.html`, load:

```html
<script src="exam-attempt-sync-utils.js"></script>
<script src="student-exam-attempt.js"></script>
```

Add a small text element near the timer/candidate area:

```html
<span id="saveState" aria-live="polite">All answers saved</span>
```

Use existing typography/colors; no redesign.

- [ ] **Step 2: Split local drafts from confirmed server state**

In `student-exam-attempt.js` keep `responses` as the latest local desired state and add:

```js
const confirmed = {};
const saveWorkers = new Map();
const desiredStates = new Map();
```

When `start` returns existing server responses, populate both `responses[qid]` and `confirmed[qid]` from those rows.

- [ ] **Step 3: Replace option-change local-only behavior with queued autosave**

On A/B/C/D change:

```js
responses[q.id] = {...responseFor(q.id), selected_option:e.target.value};
delete confirmed[q.id];
render();
queueSave(q.id, responses[q.id]).catch(showRecoverableSaveError);
```

`queueSave` must serialize saves per question. If the student changes A -> B while A is still saving, B must be sent after A and B must be the final confirmed state. A stale response must never mark B as confirmed.

- [ ] **Step 4: Make palette status depend on confirmed current state**

`statusFor(i)` must call the helper with `confirmedCurrent = isConfirmedCurrent(q.id,responses,confirmed)`. A locally selected but unsaved answer remains visually Not Answered until the save request succeeds.

- [ ] **Step 5: Save before every navigation path**

Change Previous and palette clicks to async handlers that await `flushQuestion(currentQuestionId)` before changing `current`. Keep SAVE & NEXT and MARK FOR REVIEW & NEXT explicit, but route them through the same queue/flush mechanism. CLEAR RESPONSE must save its null state before allowing navigation.

If saving fails, stay on the current question and show a retryable message; do not silently navigate away.

- [ ] **Step 6: Build and send the complete final snapshot**

Before manual submit:

```js
await flushAllPending();
const snapshot = u.buildFullSnapshot(questions,responses);
await invoke({action:'submit',attemptId:attempt.id,auto:false,responses:snapshot});
```

For timer auto-submit, call the same full-snapshot submit path with `auto:true`.

Never swallow the final-current-question save error as the old code does.

- [ ] **Step 7: Update instructions copy**

Replace the old implication that only SAVE & NEXT saves answers with text explaining that selections are auto-saved and the final submit performs a final synchronization.

- [ ] **Step 8: Syntax and helper regression checks**

Run:

```bash
node --check student-exam-attempt.js
node exam-attempt-sync-utils.test.js
```

Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add student-exam-attempt.html student-exam-attempt.js exam-attempt-sync-utils.js exam-attempt-sync-utils.test.js
git commit -m "fix: autosave student exam answers safely"
```

### Task 3: Enforce complete snapshot sync in the Edge Function before grading

**Files:**
- Create: `supabase/functions/student-exam-attempt/index.ts`
- Test: Edge Function source static checks plus production shadow validation with a non-submitted disposable attempt only if a safe test account is available.

**Interfaces:**
- Existing request: `{action:'save',attemptId,questionId,selectedOption,markedForReview}` remains compatible.
- Extended submit request: `{action:'submit',attemptId,auto,responses:Array<{questionId,selectedOption,markedForReview}>}`.
- Submit success remains `{ok:true,status,summary}`.
- Invalid/incomplete snapshot returns HTTP 409 with a clear error and does not grade the active attempt.

- [ ] **Step 1: Copy current production Edge Function source into version control**

Start from production version 2 exactly, preserving JWT auth, student profile checks, start/save semantics, server timer calculation, and grading response shape.

- [ ] **Step 2: Add full-snapshot validation helper**

Implement a function that loads authoritative exam question IDs, then validates that submitted `responses`:

```ts
- is an array
- has exactly the same number of entries as exam questions
- has no duplicate questionId
- contains every exam questionId exactly once
- contains no questionId from another exam
- selectedOption is null or A/B/C/D
- markedForReview is boolean-coercible
```

Return 409 and do not modify attempt status when coverage is incomplete or invalid.

- [ ] **Step 3: Persist the full snapshot before grading**

For a valid active attempt, upsert every snapshot row into `exam_responses` with conflict key `attempt_id,question_id`, then re-read the rows and verify the count equals the exam question count. If verification fails, return 409 without calling `gradeAttempt`.

- [ ] **Step 4: Preserve timer authority with a narrow auto-submit sync grace**

Use:

```ts
const FINAL_SYNC_GRACE_MS = 15_000;
```

Manual submit may full-sync only while server time is not past `endsAt`. Auto-submit may full-sync only until `endsAt + FINAL_SYNC_GRACE_MS` to absorb browser/network scheduling delay. If an auto-submit arrives later than that, do not trust new client answer changes; grade the already server-saved responses.

- [ ] **Step 5: Keep idempotent already-submitted behavior**

If the attempt is already submitted/auto-submitted and `exam_results` exists, return the existing summary exactly as today; never overwrite the result from a later client retry.

- [ ] **Step 6: Verify source syntax and key invariants**

Check that:

```text
verify_jwt remains true at deploy time
start does not expose answer keys
save still verifies question belongs to exam
submit validates student ownership
submit validates snapshot before active-attempt grading
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/student-exam-attempt/index.ts
git commit -m "fix: require complete answer sync before exam grading"
```

### Task 4: Deploy safely and verify no regression

**Files:**
- Deploy from: `supabase/functions/student-exam-attempt/index.ts`
- No database migration required.

**Interfaces:**
- Production Edge Function slug remains `student-exam-attempt`.
- JWT verification remains enabled.

- [ ] **Step 1: Run all local regression checks**

Run:

```bash
node exam-attempt-sync-utils.test.js
node attendance-report-utils.test.js
node --check student-exam-attempt.js
```

Expected: all PASS.

- [ ] **Step 2: Verify current production data is untouched before deployment**

Record counts for `exam_attempts`, `exam_responses`, and `exam_results`; this step is read-only.

- [ ] **Step 3: Deploy the Edge Function with JWT verification enabled**

Deploy `student-exam-attempt` from the committed `index.ts` with `verify_jwt:true`.

- [ ] **Step 4: Verify deployed function metadata**

Confirm function is ACTIVE, version incremented, and `verify_jwt:true`.

- [ ] **Step 5: Verify historical rows were not mutated by deployment**

Re-read the counts and the three known submitted attempts. Deployment must not change historical attempts/responses/results.

- [ ] **Step 6: Open a pull request for the static-site changes**

PR scope must contain only this reliability patch and version-controlled Edge Function source. Do not include publish/reset/re-exam work.

- [ ] **Step 7: Review the PR diff and merge only after checks pass**

Verify changed files match the File Structure above, then squash merge.

## Self-Review

- Spec coverage for this phase: sections 5.1 through 5.5 and data-integrity rule 8 are fully covered.
- Deliberately deferred to later plans: Publish All/Selected, reset/re-exam, range mapping, performance, manual exams, unified navigation, result-publication expansion.
- No database schema change is required for the reliability patch.
- The existing grading semantic mismatch for `negative_marking=false` is not changed here; it will be handled as a separate grading-correctness patch so this production incident fix remains isolated and reviewable.
