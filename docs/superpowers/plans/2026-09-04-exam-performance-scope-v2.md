# Exam Performance & Exam Scope V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Examinations → Exam Performance` student-first and subject-aware, while upgrading Create/Edit Exam to a reliable Subject → Unit → Chapter → Whole Chapter / Specific Topic flow where manually entered topics become canonical syllabus IDs.

**Architecture:** Preserve the existing exam engine, attempt lifecycle, grading, audience, result publication, exact-scope E-history, and question mapping truth. Add a service-only atomic scope V2 RPC that resolves/creates/promotes manual topics and replaces exam scope in one transaction. Extend the protected `exam-performance` Edge Function with student-first Admin read actions that derive subject membership and subject-specific scores from canonical question mappings. Replace only the Admin Exam Performance page presentation; do not change student-side visibility semantics.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2, Supabase Edge Functions/Deno, PostgreSQL/PLpgSQL, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-04-exam-performance-scope-v2-design.md`

## Global Constraints

- Keep `exam_question_syllabus_map` as scoring/performance truth. `exam_scope_items` is intended coverage/context only.
- Do not infer mappings or performance from `exams.syllabus` text.
- Do not fabricate a Subject-level E1/E2/E3 series. Official E numbering stays Unit/Chapter/Topic exact-scope-wise.
- Preserve negative scores, actual question marks, negative-marking ON/OFF semantics, weighted Chapter/Unit performance, RESET semantics, and RE-EXAM history.
- Existing attempts, responses, results, assignments, mappings, and generated performance must not be rewritten by the scope V2 migration.
- Direct `anon` / `authenticated` writes to new syllabus/scope operations remain prohibited; all mutation goes through protected Admin service logic.
- Mixed/NEET subject cards use mapped-question subject membership and subject-specific grading. A Mixed/NEET attempt must not copy the whole-exam score into each subject.
- Legacy unmapped `NEET` / `Mixed` exams are never guessed into Physics/Chemistry/Biology. Legacy single-subject Physics/Chemistry/Biology exams may fall back to their declared subject.
- Use patch-sized changes; no unrelated dashboard/sidebar redesign.

---

### Task 1: Add atomic manual-topic + scope replacement RPC

**Files:**
- Create: `EXAM_SCOPE_V2_MIGRATION.sql`
- Create: `exam-scope-v2-schema.test.mjs`

**New RPC:**

```sql
public.replace_exam_scope_items_v2(
  p_exam_id uuid,
  p_items jsonb,
  p_created_by uuid
) returns jsonb
```

**Input item shape:**

```json
{
  "subject":"Physics",
  "unitId":1,
  "chapterId":10,
  "scopeType":"chapter|topic",
  "topicName":"Projectile Motion",
  "subtopicId":100,
  "sortOrder":0
}
```

`subtopicId` is optional input convenience; `topicName` is authoritative for a manually typed Specific Topic. Output must return resolved canonical scope rows including canonical `subtopicId` and `subtopicTitle`.

- [ ] **Step 1: Write failing SQL contract tests**

Create `exam-scope-v2-schema.test.mjs` and assert the new migration contains:

```js
assert.match(sql,/create\s+or\s+replace\s+function\s+public\.replace_exam_scope_items_v2/i);
assert.match(sql,/security\s+definer/i);
assert.match(sql,/neet_syllabus_subtopics/i);
assert.match(sql,/status\s*=\s*'approved'/i);
assert.match(sql,/status\s*=\s*'disabled'/i);
assert.match(sql,/delete\s+from\s+public\.exam_scope_items/i);
assert.match(sql,/grant\s+execute[\s\S]+service_role/i);
assert.match(sql,/revoke\s+all[\s\S]+anon[\s\S]+authenticated/i);
```

Also assert the old `EXAM_SCOPE_MIGRATION.sql` remains present and is not rewritten as the new production migration.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test exam-scope-v2-schema.test.mjs
```

Expected: FAIL because `EXAM_SCOPE_V2_MIGRATION.sql` does not exist.

- [ ] **Step 3: Implement `replace_exam_scope_items_v2`**

The PL/pgSQL function must, inside one transaction/function call:

1. validate `p_exam_id`, `p_created_by`, and JSON array shape;
2. validate every Unit exists and matches item Subject;
3. validate every Chapter belongs to the selected Unit;
4. normalize `scopeType` to `chapter` or `topic`;
5. for `chapter`, force resolved subtopic to null;
6. for `topic`, normalize topic text with `btrim` and repeated-whitespace collapse for comparison;
7. search the selected Chapter case-insensitively across **all statuses**;
8. exact `approved` match → reuse ID;
9. exact `suggested` match → update the same row to `approved`, `source='admin'`, reuse ID;
10. exact `disabled` match → raise a clear exception and rollback the whole call;
11. no match → insert a new `approved`, `source='admin'` row using next Chapter sort order;
12. detect duplicate resolved `(unit,chapter,subtopic/null)` scope rows;
13. only after all items resolve successfully, replace `exam_scope_items`;
14. return JSON containing `count` and ordered resolved items.

Do **not** use `ON CONFLICT` to silently revive disabled topics. The existing active-title partial unique index remains the duplicate backstop.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test exam-scope-v2-schema.test.mjs exam-scope-schema.test.mjs exam-subtopic-admin-schema.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add EXAM_SCOPE_V2_MIGRATION.sql exam-scope-v2-schema.test.mjs
git commit -m "feat: add atomic exam scope topic resolver"
```

---

### Task 2: Extend pure scope logic and protected `admin-exams` API

**Files:**
- Modify: `supabase/functions/admin-exams/exam-scope-logic.mjs`
- Modify: `exam-scope-logic.test.mjs`
- Modify: `supabase/functions/admin-exams/index.ts`
- Modify: `admin-exam-scope-contract.test.mjs`

**V2 normalized browser/server item:**

```js
{
  subject:'Physics',
  unitId:1,
  chapterId:10,
  scopeType:'topic',
  topicName:'Projectile Motion',
  subtopicId:100|null,
  sortOrder:0
}
```

- [ ] **Step 1: Write failing pure-domain tests**

Extend `exam-scope-logic.test.mjs` first. Add cases proving:

- Whole Chapter accepts no topic and returns `scopeType:'chapter'`.
- Specific Topic requires a non-empty topic name after trim/collapse.
- Topic name whitespace is normalized (`'  Projectile   Motion '` → `'Projectile Motion'`).
- Subject is required and must be Physics/Chemistry/Biology.
- duplicate draft rows are rejected using normalized topic text for unsaved topics and canonical subtopic ID for saved topics.
- existing V1 ID-only structured rows returned by `get_scope` can be represented safely for edit/backward compatibility.

- [ ] **Step 2: Verify RED**

```bash
node --test exam-scope-logic.test.mjs
```

Expected: new V2 tests FAIL.

- [ ] **Step 3: Implement V2 normalization helpers**

Keep existing exports used elsewhere and add focused helpers, e.g.:

```js
normalizeTopicName(value)
normaliseExamScopeDraftV2(items)
```

Do not put DB lookup behavior in the pure helper.

- [ ] **Step 4: Write failing `admin-exams` source contract**

Extend `admin-exam-scope-contract.test.mjs` to require:

- `scope_tree` includes non-disabled topic suggestions rather than filtering to approved only;
- create/update calls `replace_exam_scope_items_v2`;
- resolved scope returned from RPC is used to build the human-readable `exams.syllabus` summary;
- `get_scope` enriches existing scope IDs with `subject`, `subtopicTitle`, and a derived `scopeType`.

- [ ] **Step 5: Update `scope_tree` safely**

Change `loadScopeTree` so chapter subtopics returned for Create/Edit autocomplete include `status in ('approved','suggested')`. Disabled topics remain hidden from browser suggestions, while the V2 DB RPC still queries all statuses to reject an exact disabled match.

- [ ] **Step 6: Integrate V2 RPC into create/update**

For create/update:

1. validate all non-scope exam fields as today;
2. normalize `scopeItems` with the V2 pure helper;
3. preserve the current legacy zero-scope update exception only for genuinely legacy exams;
4. create/update the exam record and access record using current behavior;
5. call `replace_exam_scope_items_v2` with Admin user ID;
6. use returned canonical IDs/titles to update the compatibility `exams.syllabus` summary;
7. if a create flow fails after exam insert, delete the new exam so cascade cleans access/scope;
8. if update scope replacement fails, return failure without mutating scope; the V2 RPC itself guarantees topic+scope atomicity.

Do not modify publish/audience/reset/re-exam branches.

- [ ] **Step 7: Verify backend regressions**

```bash
node --test \
  exam-scope-logic.test.mjs \
  admin-exam-scope-contract.test.mjs \
  exam-audience-policy.test.mjs \
  exam-attempt-policy.test.mjs \
  exam-publish-validation.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/admin-exams/exam-scope-logic.mjs exam-scope-logic.test.mjs supabase/functions/admin-exams/index.ts admin-exam-scope-contract.test.mjs
git commit -m "feat: resolve manual topics in protected exam scope save"
```

---

### Task 3: Upgrade Create/Edit Exam scope UI

**Files:**
- Modify: `exam-scope-ui-utils.js`
- Modify: `exam-scope-ui-utils.test.mjs`
- Modify: `admin-exam-scope-ui-contract.test.mjs`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`

- [ ] **Step 1: Write failing UI helper tests**

Extend `exam-scope-ui-utils.test.mjs` to prove:

- `unitsForSubject` returns the correct Units immediately after subject selection.
- `chaptersForUnit` returns only the selected Unit’s Chapters.
- helper exposes non-disabled topic suggestions for autocomplete.
- Whole Chapter normalizes to `{scopeType:'chapter', topicName:'', subtopicId:null}`.
- Specific Topic requires Topic Name.
- Specific Topic normalizes whitespace and preserves display capitalization.
- duplicate specific-topic rows are detected case-insensitively before save.

- [ ] **Step 2: Verify RED**

```bash
node --test exam-scope-ui-utils.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement V2 UMD helpers**

Keep UMD/browser compatibility. Replace the old approved-only selector helper with an active suggestion helper while retaining any old export still used by tests/consumers until call sites are migrated.

- [ ] **Step 4: Write failing HTML/JS contract tests**

Extend `admin-exam-scope-ui-contract.test.mjs` to assert:

- scope row renders a `Scope Type` select;
- values include `Whole Chapter` and `Specific Topic`;
- Specific Topic has a Topic Name input/autocomplete path;
- lower-level selectors are disabled until prerequisite values exist;
- payload includes `scopeType` and `topicName`;
- old always-visible Topic/Subtopic select is removed from Create/Edit Exam.

- [ ] **Step 5: Implement scope row presentation**

Each row renders:

`Subject | Unit | Chapter | Scope Type | Topic Name (conditional) | Remove`

Behavior:

- no Subject → Unit disabled with `Select Subject first`;
- Subject selected → Unit enabled/populated;
- no Unit → Chapter disabled with `Select Unit first`;
- Unit selected → Chapter enabled/populated;
- no Chapter → Scope Type disabled;
- Chapter selected → Scope Type enabled, default Whole Chapter;
- Specific Topic → show Topic Name field and datalist suggestions from active Chapter topics;
- Whole Chapter → hide/clear Topic Name and `subtopicId`;
- selecting an autocomplete suggestion may preserve its known `subtopicId`, but server resolution remains authoritative.

Keep `+ ADD SCOPE`, REMOVE, mixed-subject rows, and legacy scope note.

- [ ] **Step 6: Wire edit hydration**

`get_scope` canonical rows must hydrate:

- `scopeType='topic'` and Topic Name for non-null `subtopicId`;
- `scopeType='chapter'` for null `subtopicId`.

Do not infer old free-text legacy syllabus into structured rows.

- [ ] **Step 7: Verify UI contracts**

```bash
node --test exam-scope-ui-utils.test.mjs admin-exam-scope-ui-contract.test.mjs
node --check admin-exams.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add exam-scope-ui-utils.js exam-scope-ui-utils.test.mjs admin-exam-scope-ui-contract.test.mjs admin-exams.html admin-exams.js
git commit -m "feat: add whole chapter and manual topic exam scope UI"
```

---

### Task 4: Preserve Question Mapping preset behavior with V2 scope

**Files:**
- Modify only if needed: `supabase/functions/admin-exam-mapping/index.ts`
- Modify only if needed: `exam-mapping-ui-utils.js`
- Modify: `exam-mapping-ui-utils.test.mjs`
- Modify only if needed: `admin-exam-mapping-ui.js`

- [ ] **Step 1: Add failing preset regressions**

Add tests proving:

- Specific Topic scope converts to mapping selection including canonical `subtopicId`.
- Whole Chapter scope converts to Subject/Unit/Chapter with `subtopicId:null`.
- Whole Chapter never auto-creates a question mapping because mapping still requires an approved Topic/Subtopic.

- [ ] **Step 2: Verify RED or document existing GREEN behavior**

Run:

```bash
node --test exam-mapping-ui-utils.test.mjs admin-exam-mapping-source.test.mjs
```

If new tests already pass against existing pure behavior, do not make production code changes merely to create a diff. If they fail, implement only the minimal compatibility fix.

- [ ] **Step 3: Verify mapping flow**

Ensure `admin-exam-mapping` continues enriching `exam_scope_items` with canonical topic title and `admin-exam-mapping-ui.js` leaves Topic blank for Whole Chapter presets.

- [ ] **Step 4: Commit only if source/tests changed**

```bash
git add exam-mapping-ui-utils.test.mjs exam-mapping-ui-utils.js admin-exam-mapping-ui.js supabase/functions/admin-exam-mapping/index.ts
git commit -m "test: preserve mapping presets for scope v2"
```

---

### Task 5: Add pure subject-specific exam performance domain logic

**Files:**
- Create: `supabase/functions/exam-performance/admin-student-performance.mjs`
- Create: `exam-admin-student-performance.test.mjs`

**Purpose:** Keep the Edge Function orchestration small and test subject allocation/scoring without network/database dependencies.

**Suggested exports:**

```js
buildQuestionSubjectMap({mappings,subtopics,chapters,units})
buildSubjectAttempt({exam,attempt,questions,answerKeys,responses,subjectByQuestion})
buildStudentExamMonitor({eligibleExams,attempts,results,subjectAttempts,scopeRows})
```

- [ ] **Step 1: Write failing tests for subject allocation**

Use a Mixed exam fixture with Physics/Chemistry/Biology mapped questions. Prove:

- one exam contributes once to each mapped subject’s `Exams Set`;
- Physics score/max/correct/wrong/unattempted uses only Physics questions;
- Chemistry/Biology do likewise;
- negative marking respects the exam setting;
- negative subject score is preserved;
- whole exam total is not copied into each subject.

- [ ] **Step 2: Write latest-attempt summary tests**

Fixture one exam with valid Attempt 1 and RE-EXAM Attempt 2. Prove:

- both attempts stay in subject history;
- current average/accuracy uses latest valid attempt per distinct exam;
- best percentage may come from either valid attempt;
- subject history labels attempts using `attempt_no`, never Subject E-number.

- [ ] **Step 3: Write legacy classification tests**

Prove:

- unmapped legacy Physics exam can fall back to Physics;
- unmapped legacy NEET/Mixed does not enter any subject card and appears in `legacyUnmapped`.

- [ ] **Step 4: Verify RED**

```bash
node --test exam-admin-student-performance.test.mjs
```

Expected: FAIL because helper does not exist.

- [ ] **Step 5: Implement pure helper**

Reuse `gradeQuestions` for the subset of mapped questions instead of duplicating grading rules. For each subject attempt, set `totalMarks` to the sum of that subject’s question marks. Keep exact values; UI formatting can round later.

- [ ] **Step 6: Verify GREEN**

```bash
node --test exam-admin-student-performance.test.mjs exam-grading-performance.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/exam-performance/admin-student-performance.mjs exam-admin-student-performance.test.mjs
git commit -m "feat: add subject-specific exam performance domain"
```

---

### Task 6: Extend protected `exam-performance` API with student-first Admin reads

**Files:**
- Modify: `supabase/functions/exam-performance/index.ts`
- Modify: `exam-performance-contract.test.mjs`

**New actions:**

```json
{"action":"admin_students"}
{"action":"admin_student_detail","studentId":"<uuid>"}
```

- [ ] **Step 1: Write failing source contract**

Extend `exam-performance-contract.test.mjs` to require both new actions and import/use of `admin-student-performance.mjs`.

- [ ] **Step 2: Verify RED**

```bash
node --test exam-performance-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement `admin_students`**

Return active students with lightweight counts sufficient for the left list:

```json
{
  "id":"...",
  "fullName":"...",
  "studentCode":"...",
  "examsSet":5,
  "examsAttempted":4
}
```

Eligibility must use published exam audience truth:

- `audience_mode='all'` → active student eligible;
- `audience_mode='selected'` → active `exam_student_assignments.is_assigned=true` required.

Count distinct exams, not attempts.

- [ ] **Step 4: Implement `admin_student_detail` data loading**

For one active student load only required rows:

- eligible published exams and audience assignment data;
- valid submitted/auto_submitted/graded attempts + attempt number;
- exam results (Admin can see graded data even when `is_published=false`);
- exam questions, answer keys, responses for relevant attempts;
- question syllabus mappings;
- subtopic → chapter → unit hierarchy needed to derive subject;
- exact E-history from `exam_scope_performance_sequenced` for that student.

Use the pure helper to build:

```json
{
  "profile":{},
  "summary":{},
  "subjects":[...],
  "subjectHistory":{"Physics":[],"Chemistry":[],"Biology":[]},
  "scopeRows":[],
  "legacyUnmapped":[]
}
```

Do not return answer keys to browser unless needed for rendered fields; calculate subject grading server-side and return aggregates only.

- [ ] **Step 5: Keep existing actions backward compatible**

`admin_list`, `student_list`, `rebuild_exam` remain supported so student-side E-history and rebuild tooling do not break.

- [ ] **Step 6: Verify API/security regressions**

```bash
node --test \
  exam-performance-contract.test.mjs \
  exam-performance-visibility.test.mjs \
  exam-admin-student-performance.test.mjs \
  exam-grading-performance.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/exam-performance/index.ts exam-performance-contract.test.mjs
git commit -m "feat: add protected student-first exam performance API"
```

---

### Task 7: Redesign Admin Exam Performance page to student-first monitor

**Files:**
- Modify: `exam-performance-ui-utils.js`
- Modify: `exam-performance-ui-utils.test.mjs`
- Create: `admin-exam-performance-ui-contract.test.mjs`
- Modify: `admin-performance.html`
- Modify: `admin-performance.js`

- [ ] **Step 1: Write failing pure UI tests**

Extend `exam-performance-ui-utils.test.mjs` with helpers for:

- formatting subject cards (`Set`, `Attempted`, `Published`, `Avg`, `Best`);
- grouping exact E-history into Subject → Unit → Chapter → Topic hierarchy;
- maintaining negative percentages;
- sorting attempt history chronologically by submitted time / attempt number;
- never converting attempt numbers into Subject E labels.

- [ ] **Step 2: Write failing page contract**

Create `admin-exam-performance-ui-contract.test.mjs` and assert:

- page contains a left student list host and search;
- right detail host exists;
- Physics/Chemistry/Biology subject card rendering is driven by protected detail payload;
- old generic Academy analytics widgets (`Academy Average`, generic `Weakness Analysis`, generic all-student table) are removed from this page;
- `examSectionNav` remains loaded;
- controller calls only protected `exam-performance` actions for performance data, not direct `exam_results` client joins.

- [ ] **Step 3: Verify RED**

```bash
node --test exam-performance-ui-utils.test.mjs admin-exam-performance-ui-contract.test.mjs
```

Expected: new tests FAIL.

- [ ] **Step 4: Rebuild HTML using existing Admin Student Performance visual pattern**

Use a compact two-column layout:

- left sticky student card/list;
- right student header and summary cards;
- three Subject cards;
- selected Subject detail:
  1. subject exam attempt history table/cards;
  2. exact Unit/Chapter/Topic E-history hierarchy.

Keep SGA blue/white styling and existing Examinations subnav. Do not copy unrelated Study/Revision UI.

- [ ] **Step 5: Wire controller**

On load:

1. guard active Admin;
2. fetch `admin_students`;
3. select first student or clicked student;
4. fetch `admin_student_detail`;
5. render summary + subjects;
6. default to first subject with exams, otherwise Physics;
7. subject click renders only that subject’s exam attempts and exact E-history rows.

Show `No Exams Yet` rather than meaningless zero-row tables. Show a distinct Legacy/Unmapped notice for eligible legacy NEET/Mixed exams.

- [ ] **Step 6: Preserve rebuild capability without generic clutter**

If keeping `REBUILD SELECTED EXAM`, expose it contextually only when an exact mapped exam is selected from E-history. Do not reintroduce the old seven-filter analytics panel merely for rebuild. If this requires disproportionate UI complexity, leave rebuild reachable through the existing protected API/internal workflow and document it; no raw data behavior changes.

- [ ] **Step 7: Verify UI/syntax**

```bash
node --test exam-performance-ui-utils.test.mjs admin-exam-performance-ui-contract.test.mjs admin-examinations-nav.test.mjs
node --check admin-performance.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add exam-performance-ui-utils.js exam-performance-ui-utils.test.mjs admin-exam-performance-ui-contract.test.mjs admin-performance.html admin-performance.js
git commit -m "feat: redesign exam performance around students and subjects"
```

---

### Task 8: Full regression, production rollout, review, and merge

**Files:** no new product scope unless a regression requires a targeted fix.

- [ ] **Step 1: Run focused V2 suite**

```bash
node --test \
  exam-scope-v2-schema.test.mjs \
  exam-scope-schema.test.mjs \
  exam-scope-logic.test.mjs \
  exam-scope-ui-utils.test.mjs \
  admin-exam-scope-contract.test.mjs \
  admin-exam-scope-ui-contract.test.mjs \
  exam-mapping-ui-utils.test.mjs \
  admin-exam-mapping-source.test.mjs \
  exam-admin-student-performance.test.mjs \
  exam-performance-contract.test.mjs \
  exam-performance-ui-utils.test.mjs \
  admin-exam-performance-ui-contract.test.mjs \
  exam-performance-visibility.test.mjs
```

Expected: 0 failures.

- [ ] **Step 2: Run stable exam regressions**

```bash
node --test \
  exam-submit-sync.test.mjs \
  exam-answer-save-ordering.test.mjs \
  exam-audience-policy.test.mjs \
  exam-attempt-policy.test.mjs \
  exam-publish-validation.test.mjs \
  exam-grading-performance.test.mjs \
  admin-examinations-nav.test.mjs
```

Also run `node --check` for every changed browser `.js` file.

Expected: 0 failures.

- [ ] **Step 3: Production preflight counts**

Before DB/function changes record at minimum:

```sql
select count(*) from exams;
select count(*) from exam_questions;
select count(*) from exam_attempts;
select count(*) from exam_responses;
select count(*) from exam_results;
select count(*) from exam_student_assignments;
select count(*) from exam_scope_items;
select count(*) from exam_scope_performance;
select count(*) from exam_attempts where status='in_progress';
```

Also record approved/suggested/disabled subtopic counts by subject so any intentional topic promotion during smoke testing is explicit.

- [ ] **Step 4: Apply only V2 migration**

Apply `EXAM_SCOPE_V2_MIGRATION.sql` as migration name `exam_scope_v2_atomic_topic_support`.

Verify:

- RPC exists;
- `service_role` can execute;
- `anon` and `authenticated` cannot execute;
- no historical table counts changed merely by applying migration.

- [ ] **Step 5: Deploy only affected Edge Functions**

Deploy:

- `admin-exams`
- `exam-performance`

Deploy `admin-exam-mapping` only if Task 4 required a source change. Do **not** redeploy `student-exam-attempt` unless a verified regression forces a change.

- [ ] **Step 6: Safe smoke verification**

Prefer a new draft test exam or transaction-safe DB probe. Verify:

1. Subject → Unit → Chapter options load from production data;
2. Whole Chapter saves null subtopic;
3. Specific Topic exact suggested match promotes/reuses same ID;
4. new Specific Topic creates one approved ID;
5. disabled exact match rejects without partial scope replacement;
6. mapping preset receives the resolved canonical topic ID;
7. protected Admin student detail returns subject counts without exposing answer keys;
8. historical attempts/results remain unchanged.

Remove any disposable draft smoke exam after verification; do not delete historical data.

- [ ] **Step 7: Production postflight**

Repeat preflight counts. Historical exam/attempt/response/result/assignment/performance counts must match except for explicitly created-and-removed smoke data. Confirm in-progress attempts did not change.

- [ ] **Step 8: Code review**

Use a reviewer subagent if available. In this environment, if no subagent dispatcher exists, adapt by:

- compare branch against `main`;
- inspect every changed file;
- verify no unrelated large rewrites;
- check security boundaries, SQL grants, legacy compatibility, mixed-exam subject scoring, and no Subject E-series;
- fix all Critical/Important findings before merge.

- [ ] **Step 9: Fresh final verification**

Re-run the full commands from Steps 1 and 2 after any review fixes. Completion/merge claims require this fresh evidence.

- [ ] **Step 10: PR and direct merge**

Create a PR from `feature/exam-performance-scope-v2` to `main`, include test counts and production rollout evidence, wait for `mergeable=true`, then squash merge directly under the user’s standing authorization not to ask routine integration-option questions.

- [ ] **Step 11: Verify `main`**

Confirm `main` points to the merge SHA and fetch the changed live source files from `main`. Report that code is merged; do not claim visual browser verification unless a live screenshot is supplied or a browser tool is actually available.
