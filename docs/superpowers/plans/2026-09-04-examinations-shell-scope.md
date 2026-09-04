# Unified Examinations Shell & Exam Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining Admin Examinations architecture by consolidating exam functions under one EXAMINATIONS area and replacing free-text exam syllabus entry with canonical Subject → Unit → Chapter → Topic/Subtopic scope rows.

**Architecture:** Keep the current stable exam pages and backend behavior, then add a normalized service-controlled `exam_scope_items` layer. `admin-exams` owns structured exam-scope reads/writes, while question-level mapping remains the scoring source of truth. A shared Examinations sub-navigation unifies existing Exams, Question Bank, Results, and Exam Performance pages without rebuilding them as a SPA.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2, Supabase Edge Functions/Deno, PostgreSQL migrations/RPCs, Node `node:test` regression tests.

**Spec:** `docs/superpowers/specs/2026-09-04-examinations-shell-scope-design.md`

## Global Constraints

- Preserve the current production answer auto-save/final-sync path, audience enforcement, reset/re-exam semantics, publish validation, grading, and E-history behavior.
- Existing `exams.syllabus` text remains readable for legacy exams; do not infer structured scope from legacy free text.
- `exam_scope_items` is authoritative exam-level coverage metadata; question-level `exam_question_syllabus_map` remains authoritative for scoring/performance.
- Only approved `neet_syllabus_subtopics` may be selected as Topic/Subtopic scope.
- Direct anon/authenticated writes to new scope data are revoked; Admin operations go through protected server logic.
- New exam creation requires at least one complete canonical scope row. A legacy exam with no structured scope may still be edited without forcing a guessed scope.
- Do not build the manual/offline exam backend in this plan; create only the Manual Exams destination/shell.

---

## File Map

**Create**
- `EXAM_SCOPE_MIGRATION.sql` — normalized scope table, constraints, indexes, RLS/revokes, atomic replacement RPC.
- `exam-scope-schema.test.mjs` — migration/security contract tests.
- `supabase/functions/admin-exams/exam-scope-logic.mjs` — pure scope normalization/summary helpers.
- `exam-scope-logic.test.mjs` — pure scope behavior tests.
- `exam-scope-ui-utils.js` — browser-pure cascading selector and duplicate helpers.
- `exam-scope-ui-utils.test.mjs` — UI helper tests.
- `admin-examinations-nav.js` — common five-section Examinations sub-navigation.
- `admin-examinations-nav.test.mjs` — navigation contract tests.
- `admin-manual-exams.html` — Manual Exams next-phase shell.

**Modify**
- `supabase/functions/admin-exams/index.ts` — scope tree/get/create/update integration.
- `admin-exams.html` — canonical scope editor UI and common Examinations sub-navigation host.
- `admin-exams.js` — scope tree load, create/edit scope payloads, legacy handling.
- `supabase/functions/admin-exam-mapping/index.ts` — return exam scope with mapping tree.
- `admin-exam-questions.html` — exam-scope context control above range mapping.
- `admin-exam-mapping-ui.js` — default mapping selectors from exam scope and scope switcher.
- `admin-question-bank.html` — common Examinations sub-navigation host and active EXAMINATIONS sidebar state.
- `admin-results.html` — common Examinations sub-navigation host and Results-only title/navigation.
- `admin-performance.html` — common Examinations sub-navigation host and active EXAMINATIONS sidebar state.
- `admin-dashboard.css` — shared Examinations subnav styles and hide separate exam-related sidebar links.

---

### Task 1: Add normalized exam scope schema and atomic replacement RPC

**Files:**
- Create: `EXAM_SCOPE_MIGRATION.sql`
- Create: `exam-scope-schema.test.mjs`

**Interfaces:**
- Produces table `exam_scope_items(id, exam_id, unit_id, chapter_id, subtopic_id, sort_order, created_at, updated_at)`.
- Produces RPC `replace_exam_scope_items(p_exam_id uuid, p_items jsonb) returns integer`.
- RPC accepts items shaped `{unitId:number, chapterId:number, subtopicId:number|null, sortOrder:number}`.

- [ ] **Step 1: Write the failing schema contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('EXAM_SCOPE_MIGRATION.sql', 'utf8');

test('exam scope schema is normalized and service controlled', () => {
  assert.match(sql, /create table if not exists public\.exam_scope_items/i);
  assert.match(sql, /exam_id uuid not null references public\.exams\(id\) on delete cascade/i);
  assert.match(sql, /unit_id bigint not null references public\.neet_syllabus_units\(id\)/i);
  assert.match(sql, /chapter_id bigint not null references public\.neet_syllabus_topics\(id\)/i);
  assert.match(sql, /subtopic_id bigint references public\.neet_syllabus_subtopics\(id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke select, insert, update, delete on public\.exam_scope_items from anon, authenticated/i);
});

test('scope replacement is atomic and service-role only', () => {
  assert.match(sql, /create or replace function public\.replace_exam_scope_items/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /delete from public\.exam_scope_items where exam_id = p_exam_id/i);
  assert.match(sql, /grant execute on function public\.replace_exam_scope_items\(uuid,jsonb\) to service_role/i);
  assert.match(sql, /revoke all on function public\.replace_exam_scope_items\(uuid,jsonb\) from public, anon, authenticated/i);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test exam-scope-schema.test.mjs`

Expected: FAIL because `EXAM_SCOPE_MIGRATION.sql` does not exist.

- [ ] **Step 3: Implement the migration**

The migration must:

```sql
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
```

Add unique exact-scope protection using a normalized expression index:

```sql
create unique index if not exists exam_scope_items_exact_unique
on public.exam_scope_items(exam_id, unit_id, chapter_id, coalesce(subtopic_id, 0));
```

Implement `replace_exam_scope_items(uuid,jsonb)` as `security definer set search_path=public`. For every item, validate:
- Unit exists.
- Chapter belongs to Unit.
- When `subtopicId` is non-null, it belongs to Chapter and has `status='approved'`.
- No duplicate normalized tuple exists in the JSON payload.

Only after all items validate, delete old rows for the exam and insert the replacement rows in `sortOrder` order. Empty items are allowed by the RPC so legacy exams can remain unstructured; the Edge Function decides whether empty is allowed for the specific create/update flow.

Enable RLS and revoke direct anon/authenticated CRUD; grant service-role CRUD and RPC execute only.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test exam-scope-schema.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add EXAM_SCOPE_MIGRATION.sql exam-scope-schema.test.mjs
git commit -m "feat: add canonical exam scope schema"
```

---

### Task 2: Add deterministic scope normalization and legacy summary helpers

**Files:**
- Create: `supabase/functions/admin-exams/exam-scope-logic.mjs`
- Create: `exam-scope-logic.test.mjs`

**Interfaces:**

```js
normaliseExamScopeItems(items)
// -> { ok, items:[{unitId,chapterId,subtopicId,sortOrder}], error? }

buildExamScopeSummary(items, lookup)
// -> human-readable string such as "Motion in a Plane • Vectors; Human Reproduction • Gametogenesis"

canSaveExamScope({action, hadStructuredScope, items})
// -> {ok,error?}
```

- [ ] **Step 1: Write failing behavior tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseExamScopeItems, buildExamScopeSummary, canSaveExamScope } from './supabase/functions/admin-exams/exam-scope-logic.mjs';

test('normalises valid scope rows and rejects exact duplicates', () => {
  const ok = normaliseExamScopeItems([{unitId:'1', chapterId:'10', subtopicId:'100'}, {unitId:2, chapterId:20, subtopicId:null}]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.items[0], {unitId:1, chapterId:10, subtopicId:100, sortOrder:0});
  assert.equal(normaliseExamScopeItems([{unitId:1,chapterId:10,subtopicId:100},{unitId:1,chapterId:10,subtopicId:100}]).ok, false);
});

test('new exams require structured scope while legacy updates may remain empty', () => {
  assert.equal(canSaveExamScope({action:'create',hadStructuredScope:false,items:[]}).ok, false);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:false,items:[]}).ok, true);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:true,items:[]}).ok, false);
});

test('builds a stable legacy syllabus summary from canonical scope', () => {
  const lookup = {chapters:new Map([[10,{topic_title:'Motion in a Plane'}]]), subtopics:new Map([[100,{subtopic_title:'Vectors'}]])};
  assert.equal(buildExamScopeSummary([{chapterId:10,subtopicId:100}], lookup), 'Motion in a Plane • Vectors');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test exam-scope-logic.test.mjs`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement minimal pure helpers**

Rules:
- Parse IDs as positive integers; `subtopicId` may be null.
- Reject incomplete or duplicate rows.
- Preserve row order by emitting `sortOrder` from array position.
- New `create` requires at least one scope row.
- Update of an exam that already has structured scope cannot clear all scope rows.
- Update of a legacy exam with zero structured rows may remain empty.
- Summary de-duplicates labels and joins rows with `; `.

- [ ] **Step 4: Run GREEN**

Run: `node --test exam-scope-logic.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/exam-scope-logic.mjs exam-scope-logic.test.mjs
git commit -m "feat: add exam scope domain logic"
```

---

### Task 3: Extend protected Admin Exams backend for scope tree, reads, create, and update

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Test: `exam-scope-logic.test.mjs`
- Create: `admin-exam-scope-contract.test.mjs`

**Interfaces:**

New actions:

```json
{"action":"scope_tree"}
```
returns:
```json
{"ok":true,"syllabus":[{"id":1,"subject":"Physics","unit_no":1,"unit_title":"...","chapters":[{"id":10,"topic_title":"...","subtopics":[{"id":100,"subtopic_title":"...","status":"approved"}]}]}]}
```

```json
{"action":"get_scope","examId":"uuid"}
```
returns `scopeItems` plus `legacySyllabus`.

Create/update requests gain:

```json
"scopeItems":[{"unitId":1,"chapterId":10,"subtopicId":100,"sortOrder":0}]
```

- [ ] **Step 1: Write failing source-contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8');

test('admin exams exposes protected scope tree and get_scope actions', () => {
  assert.match(src, /action === 'scope_tree'/);
  assert.match(src, /action === 'get_scope'/);
  assert.match(src, /neet_syllabus_units/);
  assert.match(src, /neet_syllabus_subtopics/);
});

test('create and update accept canonical scope items and call atomic replacement RPC', () => {
  assert.match(src, /scopeItems/);
  assert.match(src, /replace_exam_scope_items/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test admin-exam-scope-contract.test.mjs exam-scope-logic.test.mjs`

Expected: contract tests FAIL because actions are absent.

- [ ] **Step 3: Implement `scope_tree`**

Use the existing active-Admin JWT guard. Query:
- `neet_syllabus_units` ordered by `subject,sort_order,unit_no`.
- `neet_syllabus_topics` ordered by `unit_id,sort_order`.
- `neet_syllabus_subtopics` where `status='approved'`, ordered by `chapter_id,sort_order,id`.

Assemble Unit → Chapter → approved Subtopic JSON server-side.

- [ ] **Step 4: Implement `get_scope`**

Validate exam exists. Return ordered rows from `exam_scope_items` and current `exams.syllabus` as `legacySyllabus`.

- [ ] **Step 5: Integrate create/update**

Before writing:
1. Run `normaliseExamScopeItems(body.scopeItems || [])`.
2. For update, query whether existing `exam_scope_items` count is > 0 and apply `canSaveExamScope`.
3. Build a canonical legacy summary from server-fetched syllabus lookup when structured scope exists; otherwise preserve supplied legacy value only for old exams.
4. Call `replace_exam_scope_items` after the exam exists.
5. On create, if access or scope save fails, delete the just-created exam so cascade restores a clean state.
6. Do not change publish/audience/reset/re-exam branches.

- [ ] **Step 6: Run GREEN plus existing backend regressions**

Run:
```bash
node --test admin-exam-scope-contract.test.mjs exam-scope-logic.test.mjs exam-publish-validation.test.mjs exam-audience-policy.test.mjs exam-attempt-policy.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/admin-exams/index.ts admin-exam-scope-contract.test.mjs
git commit -m "feat: add protected exam scope API"
```

---

### Task 4: Build Create/Edit Exam cascading scope editor

**Files:**
- Create: `exam-scope-ui-utils.js`
- Create: `exam-scope-ui-utils.test.mjs`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`

**Interfaces:**

Browser helper exports `window.ExamScopeUIUtils` and CommonJS-compatible pure functions:

```js
unitsForSubject(tree, subject)
chaptersForUnit(tree, unitId)
approvedSubtopicsForChapter(tree, chapterId)
normaliseScopeDraft(rows)
isDuplicateScopeRow(rows, candidate, ignoreIndex=-1)
scopeRowLabel(row, lookup)
```

- [ ] **Step 1: Write failing UI-helper tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { unitsForSubject, chaptersForUnit, approvedSubtopicsForChapter, isDuplicateScopeRow } from './exam-scope-ui-utils.js';

const tree=[{id:1,subject:'Physics',chapters:[{id:10,subtopics:[{id:100,status:'approved'},{id:101,status:'suggested'}]}]},{id:2,subject:'Biology',chapters:[]}];

test('cascades subject to units, chapters and approved subtopics only',()=>{
  assert.deepEqual(unitsForSubject(tree,'Physics').map(x=>x.id),[1]);
  assert.deepEqual(chaptersForUnit(tree,1).map(x=>x.id),[10]);
  assert.deepEqual(approvedSubtopicsForChapter(tree,10).map(x=>x.id),[100]);
});

test('blocks exact duplicate scope rows',()=>{
  const rows=[{unitId:1,chapterId:10,subtopicId:100}];
  assert.equal(isDuplicateScopeRow(rows,{unitId:1,chapterId:10,subtopicId:100}),true);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test exam-scope-ui-utils.test.mjs`

Expected: FAIL because helper file is missing.

- [ ] **Step 3: Implement helpers and run GREEN**

Run: `node --test exam-scope-ui-utils.test.mjs`

Expected: PASS.

- [ ] **Step 4: Replace free-text primary scope UI in `admin-exams.html`**

Keep the Exam Subject selector as exam type. Replace the visible free-text `Syllabus / Chapters` input with:
- `#scopeRows` repeatable rows.
- Each row: `.scope-subject`, `.scope-unit`, `.scope-chapter`, `.scope-subtopic`, REMOVE.
- `#addScopeRow` button.
- `#legacyScopeNote` shown only when editing an old exam that has legacy text but no structured rows.

Load `exam-scope-ui-utils.js` before `admin-exams.js` and bump the cache version.

- [ ] **Step 5: Wire `admin-exams.js`**

At page load call `{action:'scope_tree'}` once. For each scope row:
- Physics/Chemistry/Biology exam type defaults the row subject to that value.
- NEET/Mixed leaves row subject selectable among Physics/Chemistry/Biology.
- Subject change resets Unit/Chapter/Subtopic.
- Unit change resets Chapter/Subtopic.
- Chapter change resets Subtopic.
- Duplicate exact row cannot be added/saved.

On create send `scopeItems` from all complete rows.

On Edit:
1. Call `{action:'get_scope',examId}`.
2. If rows exist, render them.
3. If zero rows and `legacySyllabus` exists, show the legacy note and permit basic edits without fabricated scope.

- [ ] **Step 6: Add source-level regression test for the form contract**

Create `admin-exam-scope-ui-contract.test.mjs` asserting:
- free-text `id="syllabus"` is no longer the primary visible field,
- `scopeRows` and `addScopeRow` exist,
- `admin-exams.js` calls `scope_tree` and `get_scope`,
- create/update payload includes `scopeItems`.

Run:
```bash
node --test exam-scope-ui-utils.test.mjs admin-exam-scope-ui-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add exam-scope-ui-utils.js exam-scope-ui-utils.test.mjs admin-exam-scope-ui-contract.test.mjs admin-exams.html admin-exams.js
git commit -m "feat: add canonical scope editor to exams"
```

---

### Task 5: Use exam scope as the default Question Mapping context

**Files:**
- Modify: `supabase/functions/admin-exam-mapping/index.ts`
- Modify: `admin-exam-questions.html`
- Modify: `admin-exam-mapping-ui.js`
- Modify: `exam-mapping-ui-utils.js`
- Modify/Test: `exam-mapping-ui-utils.test.mjs`

**Interfaces:**
- Mapping `tree` response gains `examScope` ordered rows with resolved Subject/Unit/Chapter/Subtopic labels.
- UI helper gains:

```js
preferredMappingSelectionFromScope(scopeItem)
// -> {subject,unitId,chapterId,subtopicId}
```

- [ ] **Step 1: Add failing helper test**

```js
test('exam scope converts to mapping selector defaults',()=>{
  assert.deepEqual(
    preferredMappingSelectionFromScope({subject:'Physics',unit_id:1,chapter_id:10,subtopic_id:100}),
    {subject:'Physics',unitId:1,chapterId:10,subtopicId:100}
  );
});
```

Run: `node --test exam-mapping-ui-utils.test.mjs`

Expected: FAIL because helper is missing.

- [ ] **Step 2: Implement helper and GREEN**

Run: `node --test exam-mapping-ui-utils.test.mjs`

Expected: PASS.

- [ ] **Step 3: Extend mapping Edge Function tree response**

Use the already-protected Admin service context. Query `exam_scope_items` for the current exam and resolve unit/chapter/subtopic labels from the syllabus tree already loaded by the function. Return `examScope` without changing existing `questions`, `groups`, `mappings`, `validation`, or `syllabus` fields.

- [ ] **Step 4: Add mapping context UI**

Above the range editor add `#examScopeContext`:
- If one structured scope row exists, display it and auto-select its Subject/Unit/Chapter/Subtopic on first load.
- If multiple rows exist, show a `#mapScopePreset` select labeled `Exam Scope`; choosing a preset repopulates the cascading selectors.
- If legacy exam has no structured scope, show `No structured exam scope — choose syllabus manually.` and preserve current full-tree behavior.

Do not auto-create question mappings; Admin still chooses the question range and FULL/PARTIAL coverage.

- [ ] **Step 5: Run mapping regressions**

Run:
```bash
node --test exam-mapping-ui-utils.test.mjs exam-mapping-logic.test.mjs exam-subtopic-suggestions.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-exam-mapping/index.ts admin-exam-questions.html admin-exam-mapping-ui.js exam-mapping-ui-utils.js exam-mapping-ui-utils.test.mjs
git commit -m "feat: make question mapping exam-scope aware"
```

---

### Task 6: Consolidate Admin navigation under one EXAMINATIONS area

**Files:**
- Create: `admin-examinations-nav.js`
- Create: `admin-examinations-nav.test.mjs`
- Create: `admin-manual-exams.html`
- Modify: `admin-dashboard.css`
- Modify: `admin-exams.html`
- Modify: `admin-question-bank.html`
- Modify: `admin-results.html`
- Modify: `admin-performance.html`

**Interfaces:**

`admin-examinations-nav.js` renders exactly:

```js
[
  ['admin-exams.html','Exams'],
  ['admin-question-bank.html','Question Bank'],
  ['admin-results.html','Results'],
  ['admin-performance.html','Exam Performance'],
  ['admin-manual-exams.html','Manual Exams']
]
```

into `#examSectionNav`, marking the current pathname active and forcing the sidebar `admin-exams.html` link active.

- [ ] **Step 1: Write failing navigation tests**

Tests must assert:
- the five section destinations and labels,
- `admin-dashboard.css` hides only `aside nav a[href="admin-question-bank.html"]` and `aside nav a[href="admin-results.html"]`, not arbitrary internal links,
- all four existing section pages contain `id="examSectionNav"` and load `admin-examinations-nav.js`,
- Manual Exams page exists and loads the same navigation.

Run: `node --test admin-examinations-nav.test.mjs`

Expected: FAIL before implementation.

- [ ] **Step 2: Implement shared navigation helper and styles**

Add `.exam-section-nav` styles to `admin-dashboard.css` matching the existing blue/white Admin brand. Add targeted sidebar selectors:

```css
aside nav a[href="admin-question-bank.html"],
aside nav a[href="admin-results.html"]{display:none}
```

The helper removes `.active` from any hidden legacy exam link and marks `admin-exams.html` active.

- [ ] **Step 3: Add subnav hosts to existing pages**

Place `<div id="examSectionNav"></div>` near the top of the content area in:
- `admin-exams.html`
- `admin-question-bank.html`
- `admin-results.html`
- `admin-performance.html`

Load `admin-examinations-nav.js` on each page.

Rename visible headings where needed:
- Results page heading → `Results`
- Performance page remains `Performance Analytics` but is reached as `Exam Performance`.

Remove the Results page's redundant `PERFORMANCE ANALYTICS` top button because the shared subnav provides that route.

- [ ] **Step 4: Add Manual Exams shell**

`admin-manual-exams.html` must use the same Admin shell, active EXAMINATIONS sidebar, shared subnav, and display:

`Manual Exams — This section will be enabled in the next phase for offline/manual exam entry and approval.`

No forms, fake records, or database calls beyond existing Admin session/role verification.

- [ ] **Step 5: Run GREEN**

Run: `node --test admin-examinations-nav.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin-examinations-nav.js admin-examinations-nav.test.mjs admin-manual-exams.html admin-dashboard.css admin-exams.html admin-question-bank.html admin-results.html admin-performance.html
git commit -m "feat: unify admin examinations navigation"
```

---

### Task 7: Full regression, production migration/deploy, and integration

**Files:**
- All files from Tasks 1–6.

**Interfaces:**
- No new behavior beyond the approved spec; this task proves compatibility and deploys in safe order.

- [ ] **Step 1: Run all new scope/navigation tests**

Run:
```bash
node --test \
  exam-scope-schema.test.mjs \
  exam-scope-logic.test.mjs \
  admin-exam-scope-contract.test.mjs \
  exam-scope-ui-utils.test.mjs \
  admin-exam-scope-ui-contract.test.mjs \
  exam-mapping-ui-utils.test.mjs \
  admin-examinations-nav.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run existing exam regressions**

Run the repository's current exam tests, including at minimum:

```bash
node --test \
  exam-attempt-sync-utils.test.mjs \
  exam-submit-sync-regression.test.mjs \
  exam-attempt-policy.test.mjs \
  exam-audience-policy.test.mjs \
  exam-student-audience.test.mjs \
  exam-mapping-logic.test.mjs \
  exam-subtopic-suggestions.test.mjs \
  exam-publish-validation.test.mjs \
  exam-grading-performance.test.mjs \
  exam-performance-visibility.test.mjs \
  exam-performance-ui-utils.test.mjs
```

If a filename differs in the current repo, use the existing equivalent test already present; do not silently skip the behavior.

Expected: all PASS.

- [ ] **Step 3: Static/syntax sanity**

Run:
```bash
node --check admin-exams.js
node --check admin-exam-mapping-ui.js
node --check admin-examinations-nav.js
node --check exam-scope-ui-utils.js
```

Expected: no syntax errors.

- [ ] **Step 4: Production preflight**

Before DB/function changes, record counts for:
- `exams`
- `exam_questions`
- `exam_attempts`
- `exam_responses`
- `exam_results`
- `exam_scope_performance`
- `exam_attempts where status='in_progress'`

Do not deploy any student attempt/grading function in this plan; none is required.

- [ ] **Step 5: Apply database migration**

Apply `EXAM_SCOPE_MIGRATION.sql` to production. Verify:
- `exam_scope_items` exists,
- current old exams have zero scope rows unless explicitly created later,
- no existing exam/result/attempt counts changed.

- [ ] **Step 6: Deploy protected functions**

Deploy in this order:
1. `admin-exams`
2. `admin-exam-mapping`

No student-facing grading function deployment is needed.

- [ ] **Step 7: Controlled production verification**

Use a draft exam or create a temporary draft only if needed. Verify server behavior:
- `scope_tree` returns canonical syllabus.
- New draft create with one scope row persists scope.
- Edit returns the same scope.
- Mixed/multi-row scope persists in order.
- Duplicate/invalid hierarchy is rejected.
- Legacy old exam still loads with its old `syllabus` text and zero structured scope.
- Mapping tree returns `examScope` for structured exams.

Delete only the temporary draft created for verification; never alter the historical production test/results used for regression safety.

- [ ] **Step 8: Postflight counts and security check**

Re-run the preflight counts and confirm historical counts are unchanged except any explicitly created/deleted temporary draft. Check Supabase security advisors; `exam_scope_items` having RLS with no client policies is intentional because direct anon/authenticated access is revoked.

- [ ] **Step 9: Final fresh regression run**

Re-run Steps 1–3 after all source changes are final.

- [ ] **Step 10: Commit/PR handoff**

Prepare a PR from the feature branch to `main` summarizing:
- one EXAMINATIONS Admin area,
- canonical Create/Edit exam scope,
- scope-aware range mapping defaults,
- no scoring/publish/attempt regressions,
- migration/deploy verification.

Do not merge until the final verification is green.
