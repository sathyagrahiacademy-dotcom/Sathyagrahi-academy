# Unified Examinations Shell & Exam Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Admin exam functions under one EXAMINATIONS area and replace free-text exam syllabus entry with canonical Subject → Unit → Chapter → Topic/Subtopic scope rows.

**Architecture:** Preserve the existing exam engine and pages. Add a normalized `exam_scope_items` layer owned by protected Admin server logic, then use that scope to pre-focus the existing question-range mapping UI. Keep question-level mappings as the scoring/performance source of truth.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2, Supabase Edge Functions/Deno, PostgreSQL, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-04-examinations-shell-scope-design.md`

## Global Constraints

- Preserve answer auto-save/final sync, audience enforcement, reset/re-exam semantics, publish validation, grading, and E-history.
- Existing `exams.syllabus` text remains readable for legacy exams; never infer canonical scope from that text.
- `exam_scope_items` is exam-level intended coverage only; `exam_question_syllabus_map` remains scoring truth.
- Only approved `neet_syllabus_subtopics` are selectable.
- Direct anon/authenticated writes to scope data are revoked.
- New exam creation requires at least one canonical scope row.
- A legacy exam with no structured scope may still be edited without fabricated scope.
- Manual Exams is a shell only in this plan; no offline/manual backend is added.

---

### Task 1: Add normalized exam scope schema

**Files:**
- Create: `EXAM_SCOPE_MIGRATION.sql`
- Create: `exam-scope-schema.test.mjs`

**Interfaces:**
- Table: `exam_scope_items(id, exam_id, unit_id, chapter_id, subtopic_id, sort_order, created_at, updated_at)`.
- RPC: `replace_exam_scope_items(p_exam_id uuid, p_items jsonb) returns integer`.
- JSON row shape: `{unitId:number, chapterId:number, subtopicId:number|null, sortOrder:number}`.

- [ ] **Step 1: Write the failing migration contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync('EXAM_SCOPE_MIGRATION.sql','utf8');

test('creates normalized service-only exam scope storage',()=>{
  assert.match(sql,/create table if not exists public\.exam_scope_items/i);
  assert.match(sql,/exam_id uuid not null references public\.exams\(id\) on delete cascade/i);
  assert.match(sql,/unit_id bigint not null references public\.neet_syllabus_units\(id\)/i);
  assert.match(sql,/chapter_id bigint not null references public\.neet_syllabus_topics\(id\)/i);
  assert.match(sql,/subtopic_id bigint references public\.neet_syllabus_subtopics\(id\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke select, insert, update, delete on public\.exam_scope_items from anon, authenticated/i);
});

test('provides atomic service-role scope replacement',()=>{
  assert.match(sql,/create or replace function public\.replace_exam_scope_items/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/delete from public\.exam_scope_items where exam_id = p_exam_id/i);
  assert.match(sql,/grant execute on function public\.replace_exam_scope_items\(uuid,jsonb\) to service_role/i);
  assert.match(sql,/revoke all on function public\.replace_exam_scope_items\(uuid,jsonb\) from public, anon, authenticated/i);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test exam-scope-schema.test.mjs`

Expected: FAIL because migration file is absent.

- [ ] **Step 3: Implement migration**

Use this table contract:

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

create unique index if not exists exam_scope_items_exact_unique
on public.exam_scope_items(exam_id,unit_id,chapter_id,coalesce(subtopic_id,0));
```

`replace_exam_scope_items` must validate the entire JSON payload before deleting old rows. For every item validate Unit exists, Chapter belongs to Unit, and non-null Subtopic belongs to Chapter and has `status='approved'`. Reject duplicate `(unitId,chapterId,subtopicId)` tuples. After validation, replace rows ordered by `sortOrder` in the same transaction. Empty JSON arrays are allowed at RPC level for legacy compatibility; business rules are enforced in the Edge Function.

Enable RLS; revoke direct anon/authenticated CRUD; grant service-role table access and RPC execute only.

- [ ] **Step 4: Verify GREEN**

Run: `node --test exam-scope-schema.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add EXAM_SCOPE_MIGRATION.sql exam-scope-schema.test.mjs
git commit -m "feat: add canonical exam scope schema"
```

---

### Task 2: Add pure scope domain logic

**Files:**
- Create: `supabase/functions/admin-exams/exam-scope-logic.mjs`
- Create: `exam-scope-logic.test.mjs`

**Interfaces:**

```js
normaliseExamScopeItems(items)
// {ok:true,items:[{unitId,chapterId,subtopicId,sortOrder}]} or {ok:false,error}

canSaveExamScope({action,hadStructuredScope,items})
// {ok:true} or {ok:false,error}

buildExamScopeSummary(items,lookup)
// canonical legacy-display string
```

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import scopeLogic from './supabase/functions/admin-exams/exam-scope-logic.mjs';
const {normaliseExamScopeItems,canSaveExamScope,buildExamScopeSummary}=scopeLogic;

test('normalises ids and blocks duplicate exact scope',()=>{
  const good=normaliseExamScopeItems([{unitId:'1',chapterId:'10',subtopicId:'100'}]);
  assert.deepEqual(good.items,[{unitId:1,chapterId:10,subtopicId:100,sortOrder:0}]);
  assert.equal(normaliseExamScopeItems([{unitId:1,chapterId:10,subtopicId:100},{unitId:1,chapterId:10,subtopicId:100}]).ok,false);
});

test('requires scope for new exams but preserves empty legacy updates',()=>{
  assert.equal(canSaveExamScope({action:'create',hadStructuredScope:false,items:[]}).ok,false);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:false,items:[]}).ok,true);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:true,items:[]}).ok,false);
});

test('builds legacy display summary from canonical labels',()=>{
  const lookup={chapters:new Map([[10,{topic_title:'Motion in a Plane'}]]),subtopics:new Map([[100,{subtopic_title:'Vectors'}]])};
  assert.equal(buildExamScopeSummary([{chapterId:10,subtopicId:100}],lookup),'Motion in a Plane • Vectors');
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test exam-scope-logic.test.mjs`

Expected: FAIL because helper module is absent.

- [ ] **Step 3: Implement minimal helpers**

Rules: positive integer IDs only; `subtopicId` nullable; incomplete rows fail; duplicates fail; array order becomes `sortOrder`; new create requires at least one row; structured updates cannot clear all rows; legacy zero-scope updates may stay empty; summary joins distinct labels using `; `.

Export with the same default-object pattern used by existing `.mjs` pure helpers so the test import above works.

- [ ] **Step 4: Verify GREEN**

Run: `node --test exam-scope-logic.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/exam-scope-logic.mjs exam-scope-logic.test.mjs
git commit -m "feat: add exam scope domain logic"
```

---

### Task 3: Extend `admin-exams` protected backend

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Create: `admin-exam-scope-contract.test.mjs`

**Interfaces:**

`{action:'scope_tree'}` returns `syllabus` as Unit → Chapter → approved Subtopic.

`{action:'get_scope',examId}` returns:

```json
{"ok":true,"scopeItems":[],"legacySyllabus":"Motion In A Plane & Reproduction"}
```

Create/update accept `scopeItems`.

- [ ] **Step 1: Write failing source contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8');

test('admin exams exposes scope tree and scope read actions',()=>{
  assert.match(src,/action === 'scope_tree'/);
  assert.match(src,/action === 'get_scope'/);
  assert.match(src,/neet_syllabus_units/);
  assert.match(src,/neet_syllabus_subtopics/);
});

test('create and update persist canonical scope through RPC',()=>{
  assert.match(src,/scopeItems/);
  assert.match(src,/replace_exam_scope_items/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test admin-exam-scope-contract.test.mjs exam-scope-logic.test.mjs`

Expected: contract tests FAIL.

- [ ] **Step 3: Implement `scope_tree`**

Reuse the existing active-Admin JWT guard. Read `neet_syllabus_units`, `neet_syllabus_topics`, and only `neet_syllabus_subtopics.status='approved'`, all in stable sort order, then assemble hierarchy server-side.

- [ ] **Step 4: Implement `get_scope`**

Validate exam exists, return ordered `exam_scope_items`, and return current `exams.syllabus` as `legacySyllabus`.

- [ ] **Step 5: Integrate create/update**

Before writes, call `normaliseExamScopeItems`. On update query whether structured rows already exist and apply `canSaveExamScope`. For canonical scope, build the legacy human-readable summary server-side and store that in `exams.syllabus` for compatibility. For a legacy update with zero scope, preserve its existing legacy `syllabus` value rather than inventing one.

After exam creation/update call `replace_exam_scope_items`. If create-time access or scope persistence fails, delete the newly created exam so cascade returns to a clean state. Do not alter publish, audience, reset, or re-exam branches.

- [ ] **Step 6: Run backend regressions**

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
- Create: `admin-exam-scope-ui-contract.test.mjs`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`

**Interfaces:**

`exam-scope-ui-utils.js` follows the existing UMD pattern used by `exam-mapping-ui-utils.js`, exposing `window.ExamScopeUIUtils` in browser and default object import in Node.

Functions:

```js
unitsForSubject(tree,subject)
chaptersForUnit(tree,unitId)
approvedSubtopicsForChapter(tree,chapterId)
isDuplicateScopeRow(rows,candidate,ignoreIndex)
normaliseScopeDraft(rows)
```

- [ ] **Step 1: Write failing helper tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import uiUtils from './exam-scope-ui-utils.js';
const {unitsForSubject,chaptersForUnit,approvedSubtopicsForChapter,isDuplicateScopeRow}=uiUtils;
const tree=[{id:1,subject:'Physics',chapters:[{id:10,subtopics:[{id:100,status:'approved'},{id:101,status:'suggested'}]}]},{id:2,subject:'Biology',chapters:[]}];

test('cascades canonical syllabus and exposes approved subtopics only',()=>{
  assert.deepEqual(unitsForSubject(tree,'Physics').map(x=>x.id),[1]);
  assert.deepEqual(chaptersForUnit(tree,1).map(x=>x.id),[10]);
  assert.deepEqual(approvedSubtopicsForChapter(tree,10).map(x=>x.id),[100]);
});

test('detects exact duplicate scope row',()=>{
  assert.equal(isDuplicateScopeRow([{unitId:1,chapterId:10,subtopicId:100}],{unitId:1,chapterId:10,subtopicId:100},-1),true);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test exam-scope-ui-utils.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement UMD helper and verify GREEN**

Run: `node --test exam-scope-ui-utils.test.mjs`

Expected: PASS.

- [ ] **Step 4: Replace visible free-text scope field**

In `admin-exams.html`, remove the visible `Syllabus / Chapters` text input as the primary editor. Add `#scopeRows`, `#addScopeRow`, and `#legacyScopeNote`. Each row contains Subject, Unit, Chapter, Topic/Subtopic, and REMOVE. Keep the existing Exam Subject/type field.

Load `exam-scope-ui-utils.js` before `admin-exams.js` and bump the `admin-exams.js` query version.

- [ ] **Step 5: Wire form behavior in `admin-exams.js`**

Load `{action:'scope_tree'}` once. Physics/Chemistry/Biology exam types default new scope rows to that Subject; NEET/Mixed rows can choose Physics/Chemistry/Biology independently. Subject change resets lower selectors; Unit resets Chapter/Subtopic; Chapter resets Subtopic. Block duplicate exact rows.

Create sends complete `scopeItems`. Edit calls `{action:'get_scope',examId}`. Structured rows render exactly. A legacy exam with no scope shows `legacyScopeNote` and remains editable without guessed canonical rows.

- [ ] **Step 6: Write and run source contract**

`admin-exam-scope-ui-contract.test.mjs` asserts `scopeRows`, `addScopeRow`, `legacyScopeNote`, `scope_tree`, `get_scope`, and `scopeItems` are present, and no visible primary input uses `id="syllabus"`.

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

### Task 5: Make Question Mapping scope-aware without auto-mapping

**Files:**
- Modify: `supabase/functions/admin-exam-mapping/index.ts`
- Modify: `exam-mapping-ui-utils.js`
- Modify: `exam-mapping-ui-utils.test.mjs`
- Modify: `admin-exam-questions.html`
- Modify: `admin-exam-mapping-ui.js`

**Interfaces:**
- Mapping `tree` response gains ordered `examScope` rows with resolved labels.
- `ExamMappingUIUtils.preferredMappingSelectionFromScope(scopeItem)` returns `{subject,unitId,chapterId,subtopicId}`.

- [ ] **Step 1: Add failing helper test**

Extend the existing default import/destructure in `exam-mapping-ui-utils.test.mjs` to include `preferredMappingSelectionFromScope`, then assert:

```js
assert.deepEqual(
  preferredMappingSelectionFromScope({subject:'Physics',unit_id:1,chapter_id:10,subtopic_id:100}),
  {subject:'Physics',unitId:1,chapterId:10,subtopicId:100}
);
```

- [ ] **Step 2: Verify RED**

Run: `node --test exam-mapping-ui-utils.test.mjs`

Expected: FAIL because helper is absent.

- [ ] **Step 3: Implement helper and extend protected mapping tree**

Add helper to the existing UMD return object. In `admin-exam-mapping/index.ts`, read `exam_scope_items` for the requested exam and resolve labels using the syllabus data already loaded by the function. Return `examScope` without changing existing `questions`, `groups`, `mappings`, `validation`, or `syllabus` fields.

- [ ] **Step 4: Add scope preset UI**

In `admin-exam-questions.html`, add `#examScopeContext` above the mapping selectors. One structured scope auto-focuses the mapping selectors on first load. Multiple scopes render `#mapScopePreset`; selecting a preset repopulates Subject/Unit/Chapter/Subtopic. No structured scope shows `No structured exam scope — choose syllabus manually.`

Do not create question mappings automatically; Admin still enters the question range and FULL/PARTIAL coverage.

- [ ] **Step 5: Run mapping regressions**

```bash
node --test exam-mapping-ui-utils.test.mjs exam-mapping-logic.test.mjs exam-subtopic-suggestions.test.mjs admin-exam-mapping-source.test.mjs admin-mapping-action.test.mjs exam-mapping-page-script.test.mjs exam-mapping-ui-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-exam-mapping/index.ts exam-mapping-ui-utils.js exam-mapping-ui-utils.test.mjs admin-exam-questions.html admin-exam-mapping-ui.js
git commit -m "feat: make question mapping exam-scope aware"
```

---

### Task 6: Unify Admin exam navigation

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

Shared section order is exactly:

```js
[
  ['admin-exams.html','Exams'],
  ['admin-question-bank.html','Question Bank'],
  ['admin-results.html','Results'],
  ['admin-performance.html','Exam Performance'],
  ['admin-manual-exams.html','Manual Exams']
]
```

- [ ] **Step 1: Write failing navigation contract**

`admin-examinations-nav.test.mjs` reads the helper, CSS, and five page files. Assert all five destinations/labels exist, each page has `id="examSectionNav"` and loads `admin-examinations-nav.js`, and CSS targets only these sidebar links:

```css
aside nav a[href="admin-question-bank.html"],
aside nav a[href="admin-results.html"]
```

Expected behavior: separate Question Bank and Results & Performance items disappear from the sidebar UI, while the EXAMINATIONS sidebar link remains active on all five section pages.

- [ ] **Step 2: Verify RED**

Run: `node --test admin-examinations-nav.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement shared nav and styles**

`admin-examinations-nav.js` inserts the five links into `#examSectionNav`, marks current pathname active, removes `.active` from hidden legacy exam links, and applies `.active` to `aside nav a[href="admin-exams.html"]`.

Add branded `.exam-section-nav` styles to `admin-dashboard.css`. Hide only separate sidebar links using the targeted selectors above.

- [ ] **Step 4: Add hosts to existing pages and Manual Exams shell**

Add `#examSectionNav` and helper script to `admin-exams.html`, `admin-question-bank.html`, `admin-results.html`, `admin-performance.html`, and new `admin-manual-exams.html`.

Change Results heading to `Results`; remove the redundant `PERFORMANCE ANALYTICS` button because Exam Performance is in the shared subnav. Manual Exams displays only: `Manual Exams — This section will be enabled in the next phase for offline/manual exam entry and approval.` It performs normal Admin session/role verification and no manual-exam DB writes.

- [ ] **Step 5: Verify GREEN**

Run: `node --test admin-examinations-nav.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin-examinations-nav.js admin-examinations-nav.test.mjs admin-manual-exams.html admin-dashboard.css admin-exams.html admin-question-bank.html admin-results.html admin-performance.html
git commit -m "feat: unify admin examinations navigation"
```

---

### Task 7: Full regression and safe production rollout

**Files:** all files from Tasks 1–6.

- [ ] **Step 1: Run all new tests**

```bash
node --test exam-scope-schema.test.mjs exam-scope-logic.test.mjs admin-exam-scope-contract.test.mjs exam-scope-ui-utils.test.mjs admin-exam-scope-ui-contract.test.mjs exam-mapping-ui-utils.test.mjs admin-examinations-nav.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run exact existing exam regressions**

```bash
node --test exam-attempt-sync-utils.test.js exam-submit-sync.test.mjs exam-attempt-policy.test.mjs exam-audience-policy.test.mjs exam-student-audience.test.mjs exam-mapping-logic.test.mjs exam-mapping-schema.test.mjs exam-subtopic-admin-schema.test.mjs exam-subtopic-suggestions.test.mjs exam-publish-validation.test.mjs exam-grading-performance.test.mjs exam-performance-contract.test.mjs exam-performance-visibility.test.mjs exam-performance-ui-utils.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Run syntax checks**

```bash
node --check admin-exams.js
node --check admin-exam-mapping-ui.js
node --check admin-examinations-nav.js
node --check exam-scope-ui-utils.js
```

Expected: no syntax errors.

- [ ] **Step 4: Record production preflight counts**

Query and record `exams`, `exam_questions`, `exam_attempts`, `exam_responses`, `exam_results`, `exam_scope_performance`, and `exam_attempts where status='in_progress'`.

- [ ] **Step 5: Apply migration and verify no historical mutation**

Apply `EXAM_SCOPE_MIGRATION.sql`. Confirm `exam_scope_items` exists, all existing exams initially have zero structured scope rows, and historical attempt/response/result counts are unchanged.

- [ ] **Step 6: Deploy protected functions only**

Deploy in order: `admin-exams`, then `admin-exam-mapping`. Do not deploy `student-exam-attempt` because this feature does not change student grading/submit code.

- [ ] **Step 7: Controlled production smoke**

Using a draft exam, verify `scope_tree`, new draft create with one scope row, edit/get_scope, multi-row mixed scope ordering, duplicate rejection, legacy exam loading with old text and zero structured rows, and mapping tree `examScope`. Delete only any temporary draft created for the smoke test; do not alter historical submitted exam data.

- [ ] **Step 8: Postflight and security verification**

Re-run counts. Confirm no historical changes. Confirm direct anon/authenticated scope table writes are unavailable. RLS enabled with no client policies is intentional for this service-only table.

- [ ] **Step 9: Fresh final regression**

Repeat Steps 1–3 after final source state.

- [ ] **Step 10: Prepare integration PR**

Create a PR to `main` summarizing one EXAMINATIONS area, canonical exam scope, scope-aware mapping presets, migration/deploy results, and regression evidence. Merge only after final verification is green.
