# Examinations UX Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the five approved Examinations UX changes as one safe batch: six-digit numeric Exam Passwords, a stable Create Exam Wizard shell, lazy folder-style Question Bank navigation, Pending/Published Results organization, and compact syllabus-first Performance with E-series dialogs.

**Architecture:** Preserve existing exam, grading, attempt, result, syllabus-mapping, question-snapshot, and communications semantics. Use focused browser utilities for pure presentation/grouping logic, add minimal protected Edge Function reads for scalable Question Bank browsing and Performance metadata, and keep all write paths on existing audited RPC/actions. No physical folder tables or existing-data rewrites are introduced.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js 22 test runner, Supabase/PostgreSQL, Supabase Edge Functions (Deno + `@supabase/supabase-js@2`), GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-10-examinations-ux-consolidation-design.md`

## Global Constraints

- Exam Password is exactly six numeric digits matching `^\d{6}$`; leading zeros are valid.
- Plaintext Exam Password stays only in the current Admin setup session; persisted access continues to use the existing hash path.
- Student Portal exam notifications and result communications must never include the Exam Password.
- Create Exam remains six steps: Basic Details; Coverage / Syllabus; Questions; Blueprint & Validation; Students / Audience; Publish / Result Release.
- Question Bank browser navigation is `Subject -> Chapter -> Topic -> Questions`; canonical backend mapping remains `Subject -> Unit -> Chapter -> Topic`.
- Question Bank initial load must not return question text or thousands of full question rows.
- Existing `add_bank_questions_to_exam` immutable snapshot behavior is preserved.
- Results Pending contains unpublished result rows only.
- Published Results grouping is derived from Exam Date month and exam type `DT / WT / MT / GT`; no physical folder records are created.
- Partially published exams may appear in both Pending and Published Archive at different student-row level.
- Performance E-numbering remains exact-scope-wise; Unit, Chapter, and Topic histories are independent and never guessed.
- No change to student exam timer/start/submit behavior, grading formulas, raw answer data, result publication meaning, Manual Exams, or communications routing.
- No production migration, Edge deployment, PR merge, or live activation before exact-head tests are green and the user explicitly approves the merge/rollout.
- Current production index audit already found `question_bank_syllabus_idx (subject, unit_id, chapter_id, subtopic_id, is_active)` and `question_bank_created_idx (created_at DESC)`; this batch does not add a database index migration.

---

## File Structure

### New focused files

- `exam-password-utils.js` — browser-safe six-digit password generation and validation.
- `supabase/functions/admin-exam-wizard/password-policy.mjs` — server-side exact six-digit password validator.
- `exam-wizard-password.test.mjs` — client/server password contract.
- `exam-wizard-shell.test.mjs` — stable Wizard geometry/scroll contract.
- `supabase/functions/admin-question-bank/folder-policy.mjs` — allowed folder request/sort/pagination normalization and folder-summary builder.
- `question-bank-folder-api.test.mjs` — protected lazy Question Bank API contract.
- `question-bank-folder-ui.test.mjs` — subject/chapter/topic/questions UI contract.
- `admin-results-archive-utils.js` — pure Pending partition and Published month/type/exam grouping.
- `admin-results-archive.test.mjs` — Results grouping and UI contract.
- `admin-performance-hierarchy.test.mjs` — compact hierarchy, E-chip, dialog contract.

### Existing files modified

- `admin-exam-wizard.js` — use numeric password utility and stable fixed shell.
- `admin-exam-wizard-release.js` — keep Step 5/6 content within the shared scroll host; no outer-size overrides.
- `supabase/functions/admin-exam-wizard/index.ts` — use exact server password policy for create/update.
- `admin-question-bank.html` — replace flat initial table/filter experience with folder browser + topic question panel.
- `admin-question-bank.js` — folder-state controller and lazy API calls; preserve Add to Exam flow.
- `supabase/functions/admin-question-bank/index.ts` — add `folder_summary` and `topic_questions`; keep legacy/write actions intact.
- `admin-results.html` — Pending work queue + Published Results archive containers.
- `admin-results.js` — partition/group current result rows and render archive drilldown while preserving actions.
- `admin-performance.html` — compact hierarchy layout and E-detail dialog shell.
- `admin-performance.js` — subject selector, hierarchy rendering, E-chip dialog, existing rebuild flow.
- `exam-performance-ui-utils.js` — compact E-chip/dialog model helpers while preserving hierarchy helpers.
- `supabase/functions/exam-performance/admin-student-performance.mjs` — carry exam metadata into subject history.
- `supabase/functions/exam-performance/index.ts` — enrich scope rows with Exam Date and Exam Code from existing records.
- `.github/workflows/examination-intelligence.yml` — include new focused contracts and parse changed Question Bank Edge Function.

---

### Task 1: Six-Digit Exam Password Contract

**Files:**
- Create: `exam-password-utils.js`
- Create: `supabase/functions/admin-exam-wizard/password-policy.mjs`
- Create: `exam-wizard-password.test.mjs`
- Modify: `admin-exam-wizard.js`
- Modify: `supabase/functions/admin-exam-wizard/index.ts`
- Verify unchanged behavior: `admin-exam-wizard-ui.test.mjs`, `admin-exam-wizard-basic-contract.test.mjs`, `student-exam-notice-integration.test.mjs`

**Interfaces:**
- Consumes: browser `crypto.getRandomValues()`, existing `hashPassword()` in `admin-exam-wizard/index.ts`.
- Produces browser API `window.ExamPasswordUtils` and CommonJS export with:
  - `isValidSixDigitPassword(value: unknown): boolean`
  - `generateSixDigitPassword(cryptoLike = globalThis.crypto): string`
- Produces server API:
  - `validateExamPassword(value: unknown): {ok:true,password:string}|{ok:false,error:string}`

- [ ] **Step 1: Write the failing password contract**

Create `exam-wizard-password.test.mjs` with focused assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { validateExamPassword } from './supabase/functions/admin-exam-wizard/password-policy.mjs';

const require=createRequire(import.meta.url);
const client=require('./exam-password-utils.js');

test('six digit password validation is exact and permits leading zero',()=>{
  for(const value of ['000001','482731','999999']){
    assert.equal(client.isValidSixDigitPassword(value),true);
    assert.deepEqual(validateExamPassword(value),{ok:true,password:value});
  }
  for(const value of ['12345','1234567','12A456','123-56','']){
    assert.equal(client.isValidSixDigitPassword(value),false);
    assert.equal(validateExamPassword(value).ok,false);
  }
});

test('generator returns exactly six numeric characters',()=>{
  const fake={getRandomValues(bytes){bytes.set([0,1,2,3,4,5]);return bytes;}};
  assert.match(client.generateSixDigitPassword(fake),/^\d{6}$/);
});

test('wizard and server both use the shared six digit policies',()=>{
  const wizard=fs.readFileSync('admin-exam-wizard.js','utf8');
  const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
  assert.match(wizard,/ExamPasswordUtils/);
  assert.match(wizard,/isValidSixDigitPassword/);
  assert.match(edge,/validateExamPassword/);
  assert.doesNotMatch(edge,/4 to 64 characters/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test exam-wizard-password.test.mjs
```

Expected: FAIL because `exam-password-utils.js` and `password-policy.mjs` do not exist yet.

- [ ] **Step 3: Implement the minimal client utility**

Create `exam-password-utils.js` as a small UMD module:

```js
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ExamPasswordUtils=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const exact=/^\d{6}$/;
  function isValidSixDigitPassword(value){return exact.test(String(value??''));}
  function generateSixDigitPassword(cryptoLike=globalThis.crypto){
    if(!cryptoLike?.getRandomValues)throw new Error('Secure random generator unavailable');
    const bytes=new Uint32Array(1);
    cryptoLike.getRandomValues(bytes);
    return String(bytes[0]%1000000).padStart(6,'0');
  }
  return{isValidSixDigitPassword,generateSixDigitPassword};
});
```

- [ ] **Step 4: Implement the server policy**

Create `supabase/functions/admin-exam-wizard/password-policy.mjs`:

```js
export function validateExamPassword(value){
  const password=String(value??'');
  if(!/^\d{6}$/.test(password))return{ok:false,error:'Exam Password must be exactly 6 digits'};
  return{ok:true,password};
}
```

- [ ] **Step 5: Wire the Wizard to the client utility**

In `admin-exam-wizard.js`:

```js
const passwordUtils=window.ExamPasswordUtils;
const randomPassword=()=>passwordUtils.generateSixDigitPassword();
```

Before create/update submission, reject invalid manual values inline:

```js
const examPassword=String(document.getElementById('mwPassword')?.value||'');
if(!passwordUtils.isValidSixDigitPassword(examPassword)){
  setMessage('Exam Password must be exactly 6 digits.');
  return;
}
```

Ensure `exam-password-utils.js` is loaded before `admin-exam-wizard.js` from the master-enabled navigation loader.

- [ ] **Step 6: Wire the Edge Function to the server policy**

In `supabase/functions/admin-exam-wizard/index.ts` import:

```ts
import { validateExamPassword } from './password-policy.mjs'
```

For `create_master_exam`:

```ts
const passwordCheck=validateExamPassword(body.examPassword)
if(!passwordCheck.ok)return json({error:passwordCheck.error},400)
const passwordHash=await hashPassword(passwordCheck.password)
```

For password replacement in `update_master_basics`, apply the same policy before hashing.

- [ ] **Step 7: Run password + existing Wizard/notification contracts**

```bash
node --test exam-wizard-password.test.mjs admin-exam-wizard-ui.test.mjs admin-exam-wizard-basic-contract.test.mjs student-exam-notice-integration.test.mjs
```

Expected: PASS, with notification tests still proving password is absent.

- [ ] **Step 8: Commit Task 1**

```bash
git add exam-password-utils.js exam-wizard-password.test.mjs admin-exam-wizard.js supabase/functions/admin-exam-wizard/password-policy.mjs supabase/functions/admin-exam-wizard/index.ts admin-examinations-nav.js
git commit -m "fix: require six digit exam passwords"
```

---

### Task 2: Stable Create Exam Wizard Shell

**Files:**
- Create: `exam-wizard-shell.test.mjs`
- Modify: `admin-exam-wizard.js`
- Modify: `admin-exam-wizard-release.js`

**Interfaces:**
- Consumes: existing `#masterExamWizardModal`, `.master-wizard-card`, `#mwSteps`, `#mwStepHost`, `#mwMsg`, `#mwBack`, `#mwNext`.
- Produces stable shell classes:
  - `.master-wizard-card` = fixed viewport-based outer shell
  - `.mw-head` and `.mw-steps` = non-scrolling
  - `.mw-body` = flex column with `min-height:0`
  - `.mw-step-scroll` = only vertical scrolling region containing `#mwStepHost` and message content
  - `.mw-actions` = non-scrolling footer

- [ ] **Step 1: Write the failing shell contract**

Create `exam-wizard-shell.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('admin-exam-wizard.js','utf8');
const release=fs.readFileSync('admin-exam-wizard-release.js','utf8');

test('wizard outer shell is stable and only step content scrolls',()=>{
  assert.match(js,/\.master-wizard-card\{[^}]*height:min\(760px,94vh\)/s);
  assert.match(js,/\.master-wizard-card\{[^}]*overflow:hidden/s);
  assert.match(js,/\.mw-body\{[^}]*display:flex[^}]*flex-direction:column[^}]*min-height:0/s);
  assert.match(js,/mw-step-scroll/);
  assert.match(js,/\.mw-step-scroll\{[^}]*overflow-y:auto/s);
  assert.match(js,/id="mwStepHost"/);
});

test('release steps do not override outer wizard height',()=>{
  assert.doesNotMatch(release,/master-wizard-card[^\n]*(height|max-height|overflow)/);
});
```

- [ ] **Step 2: Run the shell contract and confirm RED**

```bash
node --test exam-wizard-shell.test.mjs
```

Expected: FAIL because current `.master-wizard-card` uses `max-height:94vh;overflow:auto` and no `.mw-step-scroll` exists.

- [ ] **Step 3: Implement stable desktop shell CSS**

In `admin-exam-wizard.js` replace the outer scrolling rule with:

```css
#masterExamWizardModal{z-index:90}
.master-wizard-card{
  width:min(1120px,97vw);
  height:min(760px,94vh);
  max-height:94vh;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  background:#fff;
  border-radius:14px;
  box-shadow:0 24px 70px #04152f55;
}
.mw-head,.mw-steps{flex:0 0 auto}
.mw-body{padding:0;display:flex;flex:1 1 auto;min-height:0;flex-direction:column}
.mw-step-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 22px 0}
.mw-actions{flex:0 0 auto;margin:0;padding:14px 22px 18px;border-top:1px solid #e8edf4;background:#fff}
```

For compact/mobile viewport:

```css
@media(max-height:720px),(max-width:700px){
  .master-wizard-card{height:94vh}
  .mw-step-scroll{padding:16px 14px 0}
  .mw-actions{padding:12px 14px 14px}
}
```

- [ ] **Step 4: Change the modal DOM so only the step region scrolls**

Render:

```html
<div class="mw-body">
  <div class="mw-step-scroll">
    <div id="mwStepHost"></div>
    <div class="mw-msg" id="mwMsg"></div>
  </div>
  <div class="mw-actions">...</div>
</div>
```

Do not move IDs or footer button semantics used by `admin-exam-wizard-release.js`.

- [ ] **Step 5: Keep Step 5/6 internals bounded**

In `admin-exam-wizard-release.js`, retain `.mw-audience-list{max-height:330px;overflow-y:auto}` and remove/no-op any outer-shell sizing rule. Step 5/6 render only inside `#mwStepHost`.

- [ ] **Step 6: Run focused and full Wizard contracts**

```bash
node --test exam-wizard-shell.test.mjs admin-exam-wizard-ui.test.mjs exam-wizard-coverage.test.mjs exam-wizard-questions-integration.test.mjs exam-blueprint-approval.test.mjs exam-wizard-audience.test.mjs exam-master-publish-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add exam-wizard-shell.test.mjs admin-exam-wizard.js admin-exam-wizard-release.js
git commit -m "fix: stabilize create exam wizard shell"
```

---

### Task 3: Protected Lazy Question Bank Folder API

**Files:**
- Create: `supabase/functions/admin-question-bank/folder-policy.mjs`
- Create: `question-bank-folder-api.test.mjs`
- Modify: `supabase/functions/admin-question-bank/index.ts`
- Preserve: `QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql`, existing RPC write paths

**Interfaces:**
- Consumes: canonical syllabus tables and active `question_bank_questions` rows; existing Admin auth guard.
- Produces action `folder_summary` request `{action:'folder_summary'}` and response:

```ts
{
  ok:true,
  total:number,
  subjects:Array<{
    subject:'Physics'|'Chemistry'|'Biology',
    count:number,
    chapters:Array<{
      id:string|number,
      title:string,
      unitId:string|number,
      unitTitle:string,
      unitNo:number|null,
      count:number,
      topics:Array<{id:string|number,title:string,count:number}>
    }>
  }>
}
```

- Produces action `topic_questions` request:

```ts
{
  action:'topic_questions',
  subject:string,
  unitId:string|number,
  chapterId:string|number,
  subtopicId:string|number,
  sort:'newest'|'oldest'|'difficulty'|'question_type'|'source'|'source_year',
  search:string,
  limit:number,
  offset:number
}
```

- Produces response `{ok:true,questions:Array<QuestionBankQuestion>,total:number,hasMore:boolean}` where each question includes `created_at`.
- Legacy actions `list`, `bulk_import`, `add_to_exam`, `sync_exam` remain available for compatibility; new UI must use `folder_summary` + `topic_questions`.

- [ ] **Step 1: Write the failing API contract**

Create `question-bank-folder-api.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTopicQuestionRequest, buildFolderSummary } from './supabase/functions/admin-question-bank/folder-policy.mjs';

test('topic question request accepts only approved sort and bounded paging',()=>{
  assert.deepEqual(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'newest',limit:50,offset:0}),{
    ok:true,value:{subject:'Physics',unitId:'1',chapterId:'2',subtopicId:'3',sort:'newest',search:'',limit:50,offset:0}
  });
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'sql_injection'}).ok,false);
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,limit:1000}).ok,false);
});

test('folder summary carries counts but never question text',()=>{
  const tree={units:[{id:1,subject:'Physics',unit_no:1,unit_title:'Physics and Measurement',sort_order:1}],chapters:[{id:11,unit_id:1,topic_title:'Units and Measurements',sort_order:1}],subtopics:[{id:101,chapter_id:11,subtopic_title:'SI Units',status:'approved',sort_order:1}]};
  const rows=[{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101},{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101}];
  const summary=buildFolderSummary(tree,rows);
  assert.equal(summary.subjects[0].count,2);
  assert.equal(summary.subjects[0].chapters[0].topics[0].count,2);
  assert.equal(JSON.stringify(summary).includes('question_text'),false);
});

test('edge exposes folder summary and topic question reads while preserving write actions',()=>{
  const edge=fs.readFileSync('supabase/functions/admin-question-bank/index.ts','utf8');
  for(const action of ['folder_summary','topic_questions','list','bulk_import','add_to_exam','sync_exam'])assert.match(edge,new RegExp(`action===['"]${action}['"]`));
  assert.match(edge,/add_bank_questions_to_exam/);
});
```

- [ ] **Step 2: Run the API contract and confirm RED**

```bash
node --test question-bank-folder-api.test.mjs
```

Expected: FAIL because `folder-policy.mjs` and the two new actions do not exist.

- [ ] **Step 3: Implement request normalization and summary builder**

Create `supabase/functions/admin-question-bank/folder-policy.mjs` with:

```js
const SUBJECTS=['Physics','Chemistry','Biology'];
const SORTS=new Set(['newest','oldest','difficulty','question_type','source','source_year']);
const text=v=>String(v??'').trim();

export function normalizeTopicQuestionRequest(input={}){
  const subject=text(input.subject),unitId=text(input.unitId),chapterId=text(input.chapterId),subtopicId=text(input.subtopicId);
  const sort=text(input.sort||'newest');
  const search=text(input.search).slice(0,160);
  const limit=Number(input.limit??50),offset=Number(input.offset??0);
  if(!SUBJECTS.includes(subject)||!unitId||!chapterId||!subtopicId)return{ok:false,error:'Complete syllabus folder context is required'};
  if(!SORTS.has(sort))return{ok:false,error:'Invalid question sort'};
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0)return{ok:false,error:'Invalid question paging'};
  return{ok:true,value:{subject,unitId,chapterId,subtopicId,sort,search,limit,offset}};
}
```

Implement `buildFolderSummary(tree,rows)` to emit only the approved three subjects, canonical chapter/topic IDs/titles, Unit context, and counts. Exclude inactive/unapproved topics from navigable output.

- [ ] **Step 4: Add `folder_summary` to the protected Edge Function**

In `admin-question-bank/index.ts`, after Admin auth:

```ts
if(action==='folder_summary'){
  const tree=await loadTree(admin)
  const pageSize=1000
  let from=0, meta:any[]=[]
  for(;;){
    const r=await admin.from('question_bank_questions')
      .select('subject,unit_id,chapter_id,subtopic_id')
      .eq('is_active',true)
      .range(from,from+pageSize-1)
    if(r.error)return json({error:r.error.message},400)
    meta.push(...(r.data||[]))
    if((r.data||[]).length<pageSize)break
    from+=pageSize
  }
  return json({ok:true,...buildFolderSummary(tree,meta)})
}
```

This keeps full question text out of initial load.

- [ ] **Step 5: Add `topic_questions` with full canonical context verification**

Validate that requested topic belongs to requested chapter/unit/subject using the canonical tree before querying. Query only active questions matching all four indexed hierarchy columns:

```ts
let query=admin.from('question_bank_questions')
  .select('id,subject,unit_id,chapter_id,subtopic_id,question_text,default_marks,default_negative_marks,difficulty,question_type,source_label,source_year,created_at',{count:'exact'})
  .eq('is_active',true)
  .eq('subject',v.subject)
  .eq('unit_id',v.unitId)
  .eq('chapter_id',v.chapterId)
  .eq('subtopic_id',v.subtopicId)
```

Apply safe search with `.ilike('question_text',`%${v.search.replaceAll('%','\\%').replaceAll('_','\\_')}%`)` when search is non-empty.

For `newest`/`oldest`, use `created_at`; for `source_year`, `source_label`, `question_type`, and `difficulty`, use the named safe column with deterministic `created_at DESC` tie-breaker. Page with `.range(v.offset,v.offset+v.limit-1)` and return `total` and `hasMore`.

- [ ] **Step 6: Confirm existing database indexes are sufficient; do not add migration**

The production read-only audit already returned:

```text
question_bank_syllabus_idx (subject, unit_id, chapter_id, subtopic_id, is_active)
question_bank_created_idx (created_at DESC)
```

Keep the query constrained by the full canonical path so the existing syllabus index remains usable. No SQL file is added in this task.

- [ ] **Step 7: Run focused and existing Question Bank contracts**

```bash
node --test question-bank-folder-api.test.mjs question-bank-blueprint-contract.test.mjs question-bank-import-policy.test.mjs question-bank-import-ui.test.mjs
```

Expected: PASS; existing snapshot/import/write safety remains green.

- [ ] **Step 8: Commit Task 3**

```bash
git add supabase/functions/admin-question-bank/folder-policy.mjs supabase/functions/admin-question-bank/index.ts question-bank-folder-api.test.mjs
git commit -m "feat: add lazy question bank folder API"
```

---

### Task 4: Question Bank Folder Browser UI

**Files:**
- Create: `question-bank-folder-ui.test.mjs`
- Modify: `admin-question-bank.html`
- Modify: `admin-question-bank.js`
- Verify: `question-bank-blueprint-contract.test.mjs`, `question-bank-import-ui.test.mjs`

**Interfaces:**
- Consumes Task 3 `folder_summary` and `topic_questions` responses.
- Keeps `?exam=<id>` target-exam preselection behavior.
- Keeps `add_to_exam` request `{action:'add_to_exam',examId,bankIds}` unchanged.
- Produces browser state `{level:'subjects'|'chapters'|'topics'|'questions',subject,chapter,topic,questions,sort,search,offset,total}`.

- [ ] **Step 1: Write the failing UI contract**

Create `question-bank-folder-ui.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('admin-question-bank.html','utf8');
const js=fs.readFileSync('admin-question-bank.js','utf8');

test('question bank opens to three subject folders with no initial question table',()=>{
  for(const id of ['qbFolderHost','qbBreadcrumb','qbQuestionHost','qbSort','qbSearch'])assert.match(html,new RegExp(id));
  assert.doesNotMatch(html,/id=["']rows["']/);
  assert.match(js,/folder_summary/);
  assert.doesNotMatch(js,/action:['"]list['"]/);
});

test('folder flow is subject chapter topic then questions',()=>{
  for(const label of ['Physics','Chemistry','Biology'])assert.match(html,new RegExp(label));
  for(const token of ['renderSubjects','renderChapters','renderTopics','loadTopicQuestions'])assert.match(js,new RegExp(token));
  assert.match(js,/topic_questions/);
});

test('question view exposes added date time sort and add-to-exam selection',()=>{
  assert.match(html,/Newest First/);
  assert.match(html,/Oldest First/);
  assert.match(html,/Difficulty/);
  assert.match(html,/Question Type/);
  assert.match(html,/Source Year/);
  assert.match(js,/created_at/);
  assert.match(js,/toLocaleDateString/);
  assert.match(js,/toLocaleTimeString/);
  assert.match(js,/add_to_exam/);
});
```

- [ ] **Step 2: Run the UI contract and confirm RED**

```bash
node --test question-bank-folder-ui.test.mjs
```

Expected: FAIL because current page is filter/table-first and calls `list`.

- [ ] **Step 3: Replace flat table shell with folder hosts**

In `admin-question-bank.html`, keep the Examination shell, format guide, target exam modal, and summary counts. Replace the large filter/table panel with:

```html
<section class="panel qb-browser">
  <div class="qb-browser-head">
    <div id="qbBreadcrumb" class="qb-breadcrumb">Question Bank</div>
    <button class="btn" id="qbBack" type="button" hidden>BACK</button>
  </div>
  <div id="qbFolderHost" class="qb-folder-grid">
    <button class="qb-subject-folder" data-subject="Physics">...</button>
    <button class="qb-subject-folder" data-subject="Chemistry">...</button>
    <button class="qb-subject-folder" data-subject="Biology">...</button>
  </div>
  <div id="qbQuestionHost" hidden>
    <div class="qb-question-toolbar">
      <input id="qbSearch" placeholder="Search inside this topic">
      <select id="qbSort">
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="difficulty">Difficulty</option>
        <option value="question_type">Question Type</option>
        <option value="source">Source</option>
        <option value="source_year">Source Year</option>
      </select>
    </div>
    <div id="qbQuestionList"></div>
    <div class="actions"><button id="copySelected" class="btn primary">ADD SELECTED TO EXAM</button><span id="selectedCount"></span></div>
  </div>
</section>
```

Use compact folder cards; show Unit title as subtitle on Chapter cards only.

- [ ] **Step 4: Rewrite controller around folder state, not global question arrays**

In `admin-question-bank.js`, initial load does:

```js
const [summary,er]=await Promise.all([
  invoke({action:'folder_summary'}),
  c.from('exams').select('id,title,subject,is_published,status').order('created_at',{ascending:false})
]);
folderSummary=summary;
renderSubjects();
```

Do not keep `questions=bank.questions||[]` or call `list` from page startup.

- [ ] **Step 5: Implement folder drilldown**

Create explicit functions:

```js
function renderSubjects(){...}
function renderChapters(subject){...}
function renderTopics(chapter){...}
async function loadTopicQuestions(topic,{reset=true}={}){...}
```

`renderChapters` derives chapters only from selected subject. `renderTopics` derives topics only from selected chapter. Breadcrumb shows `Question Bank / Physics / Chapter / Topic`.

- [ ] **Step 6: Render topic questions with Added Date/Time**

For each question:

```js
const created=q.created_at?new Date(q.created_at):null;
const date=created&&!Number.isNaN(created.getTime())?created.toLocaleDateString('en-IN'):'—';
const time=created&&!Number.isNaN(created.getTime())?created.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—';
```

Render checkbox, question, difficulty/type/source/year, and `Added ${date} • ${time}`. Selection is scoped to currently loaded questions and remains intact while sorting/searching the same topic.

- [ ] **Step 7: Wire sort/search to lazy reload**

On sort change, call `loadTopicQuestions(currentTopic,{reset:true})`. Debounce search at approximately 250 ms and reload current topic only. Never fetch questions before a topic is selected.

- [ ] **Step 8: Preserve Add to Exam and requested-exam preselection**

Reuse current copy modal and final call exactly:

```js
await invoke({action:'add_to_exam',examId,bankIds:[...selected]});
```

On success continue redirecting to:

```js
location.href='admin-exam-questions.html?exam='+encodeURIComponent(examId);
```

- [ ] **Step 9: Run Question Bank UI + regression contracts**

```bash
node --test question-bank-folder-ui.test.mjs question-bank-folder-api.test.mjs question-bank-blueprint-contract.test.mjs question-bank-import-ui.test.mjs exam-wizard-questions-integration.test.mjs
node --check admin-question-bank.js
```

Expected: PASS. If an old contract asserts obsolete flat-filter element IDs, update only that structural assertion while retaining protected API, source/year, import, and immutable-snapshot safety assertions.

- [ ] **Step 10: Commit Task 4**

```bash
git add admin-question-bank.html admin-question-bank.js question-bank-folder-ui.test.mjs question-bank-blueprint-contract.test.mjs
git commit -m "feat: browse question bank by syllabus folders"
```

---

### Task 5: Results Pending Queue and Published Archive

**Files:**
- Create: `admin-results-archive-utils.js`
- Create: `admin-results-archive.test.mjs`
- Modify: `admin-results.html`
- Modify: `admin-results.js`

**Interfaces:**
- Consumes existing `exam_results` rows enriched with nested exam fields `id,title,subject,total_marks,result_published,exam_type,exam_date`.
- Produces utility API `window.AdminResultsArchiveUtils` and CommonJS export:
  - `examTypeCode(type): 'DT'|'WT'|'MT'|'GT'|'OTHER'`
  - `examMonthKey(examDate): {key:string,label:string}`
  - `partitionResultRows(rows): {pending:any[],published:any[]}`
  - `groupPublishedResults(rows): Array<{key,label,types:Array<{code,exams:Array<{examId,title,rows}>}>}>`

- [ ] **Step 1: Write the failing archive contract**

Create `admin-results-archive.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./admin-results-archive-utils.js');

test('pending contains unpublished rows only and archive uses exam date month',()=>{
  const rows=[
    {attempt_id:'a1',is_published:false,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a2',is_published:true,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a3',is_published:true,exam_attempts:{exam_id:'e2',exams:{id:'e2',title:'GT 1',exam_type:'grand',exam_date:'2026-10-02'}}}
  ];
  const p=u.partitionResultRows(rows);
  assert.deepEqual(p.pending.map(x=>x.attempt_id),['a1']);
  const archive=u.groupPublishedResults(p.published);
  assert.equal(archive[0].key,'2026-10');
  assert.equal(archive[1].key,'2026-09');
  assert.equal(archive[1].types[0].code,'WT');
});

test('all approved exam types map to archive sections',()=>{
  assert.equal(u.examTypeCode('daily'),'DT');
  assert.equal(u.examTypeCode('weekly'),'WT');
  assert.equal(u.examTypeCode('monthly'),'MT');
  assert.equal(u.examTypeCode('grand'),'GT');
});

test('results page has Pending and Published Results drilldown hosts',()=>{
  const html=fs.readFileSync('admin-results.html','utf8');
  const js=fs.readFileSync('admin-results.js','utf8');
  for(const id of ['pendingRows','publishedMonths','archiveExamRows'])assert.match(html,new RegExp(id));
  assert.match(js,/partitionResultRows/);
  assert.match(js,/groupPublishedResults/);
});
```

- [ ] **Step 2: Run the contract and confirm RED**

```bash
node --test admin-results-archive.test.mjs
```

Expected: FAIL because helper and new archive hosts do not exist.

- [ ] **Step 3: Implement pure archive utility**

Create UMD `admin-results-archive-utils.js`. Use Exam Date string directly for month key to avoid publication/submission timestamp ambiguity:

```js
function examMonthKey(examDate){
  const raw=String(examDate||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return{key:'unknown',label:'Unknown Date'};
  const [year,month]=raw.split('-');
  const d=new Date(`${year}-${month}-01T00:00:00+05:30`);
  return{key:`${year}-${month}`,label:new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(d)};
}
```

Group only rows with `is_published===true`; sort months newest first and type order `DT,WT,MT,GT`.

- [ ] **Step 4: Change Results data query to include archive keys**

In `admin-results.js`, extend nested exam select to include:

```text
exams!inner(id,title,subject,total_marks,result_published,exam_type,exam_date)
```

Keep all existing student/attempt/result fields.

- [ ] **Step 5: Replace flat all/published filter with two purposeful regions**

In `admin-results.html` render:

```html
<section class="panel results-pending">
  <div class="head"><div><h3>TO BE PUBLISHED</h3><p class="muted">Only results that still need Admin publication.</p></div></div>
  <input id="pendingSearch" ...>
  <table>...<tbody id="pendingRows"></tbody></table>
</section>
<section class="panel results-archive">
  <div class="head"><div><h3>PUBLISHED RESULTS</h3><p class="muted">Month → DT / WT / MT / GT → Exam → Students</p></div></div>
  <div id="publishedMonths"></div>
  <div id="archiveExamRows"></div>
</section>
```

Remove the old `all/published/unpublished` selector because it contradicts the approved work-queue/archive model.

- [ ] **Step 6: Render Pending with Publish action only there**

`renderPending()` uses `partitionResultRows(data).pending`. Preserve `VIEW`, `ANALYTICS`, `RE-EXAM`, `RESET`, and `PUBLISH`; after successful publish call `await load()` so the row moves automatically to archive.

- [ ] **Step 7: Render archive drilldown**

Render month cards/rows first. Month click reveals four type sections only when that type has published rows. Type click reveals exams. Exam click renders published student rows with `VIEW`, `ANALYTICS`, `RE-EXAM`, `RESET`; do not render `PUBLISH` in archive.

Partially published exams naturally have unpublished rows in Pending and published rows in archive because grouping occurs per result row.

- [ ] **Step 8: Keep question detail panel/action handlers working from both contexts**

Use one event delegation handler on a shared Results container or both pending/archive hosts, mapping the same `data-view`, `data-analytics`, `data-reexam`, and `data-reset` attributes to existing functions.

- [ ] **Step 9: Run Results contract and regression suite subset**

```bash
node --test admin-results-archive.test.mjs exam-grading-performance.test.mjs exam-master-publish-contract.test.mjs student-answer-review-intelligence.test.mjs
node --check admin-results.js
```

Expected: PASS; publishing semantics and grading remain untouched.

- [ ] **Step 10: Commit Task 5**

```bash
git add admin-results-archive-utils.js admin-results-archive.test.mjs admin-results.html admin-results.js
git commit -m "feat: organize pending and published exam results"
```

---

### Task 6: Enrich Performance Data for E-Series Dialogs

**Files:**
- Modify: `supabase/functions/exam-performance/admin-student-performance.mjs`
- Modify: `supabase/functions/exam-performance/index.ts`
- Modify: `exam-admin-student-performance.test.mjs`
- Modify: `exam-performance-contract.test.mjs` only if contract needs the newly exposed safe fields

**Interfaces:**
- Consumes existing `exam_access.exam_code`, `exams.exam_date`, existing subject-attempt grading summary, existing `exam_scope_performance_sequenced` rows.
- Produces each subject-history row with safe metadata:
  - `exam_code:string`
  - `exam_date:string|null`
- Produces each enriched scope row with:
  - `exam_code:string|null`
  - `exam_date:string|null`
- No password hash or answer-key data is exposed.

- [ ] **Step 1: Extend the failing performance model test**

In `exam-admin-student-performance.test.mjs`, change the fixture exam to include safe metadata and assert it survives `buildSubjectAttempt`:

```js
const exam={id:'e1',title:'Mixed 01',subject:'Mixed',negative_marking:true,exam_code:'SGA-DT-010809',exam_date:'2026-09-08'};
...
assert.equal(p.exam_code,'SGA-DT-010809');
assert.equal(p.exam_date,'2026-09-08');
```

Add a source contract asserting `exam-performance/index.ts` queries `exam_access` for `exam_code` and `exams` for `exam_date`, while never selecting `password_hash`.

- [ ] **Step 2: Run the focused model test and confirm RED**

```bash
node --test exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs
```

Expected: FAIL because the safe metadata is not currently carried through.

- [ ] **Step 3: Carry Exam Date and Code into subject attempts**

In `buildSubjectAttempt()` return:

```js
exam_id:text(exam.id),
exam_title:exam.title||'',
exam_code:exam.exam_code||'',
exam_date:exam.exam_date||null,
subject:String(subject),
```

- [ ] **Step 4: Load safe exam metadata in `loadEligibleExams`**

Extend the `exams` select with `exam_date`. Load access codes separately by eligible exam IDs:

```ts
const access=await admin.from('exam_access').select('exam_id,exam_code').in('exam_id',examIds)
```

Join `exam_code` into `eligibleWithSubjects`. Never select `password_hash`.

- [ ] **Step 5: Enrich scope rows with the same safe metadata**

In `enrichRows()`:

```ts
examIds.length ? admin.from('exams').select('id,title,subject,total_marks,exam_date').in('id',examIds) : ...
examIds.length ? admin.from('exam_access').select('exam_id,exam_code').in('exam_id',examIds) : ...
```

Return `exam_date` and `exam_code` on each scope row. Match access records by `exam_id`.

- [ ] **Step 6: Run performance model/intelligence contracts**

```bash
node --test exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs performance-intelligence-policy.test.mjs performance-intelligence-integration.test.mjs exam-performance-visibility.test.mjs
```

Expected: PASS; score calculations remain unchanged.

- [ ] **Step 7: Commit Task 6**

```bash
git add supabase/functions/exam-performance/admin-student-performance.mjs supabase/functions/exam-performance/index.ts exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs
git commit -m "feat: expose safe performance exam metadata"
```

---

### Task 7: Compact Performance Hierarchy and E-Chip Dialog

**Files:**
- Create: `admin-performance-hierarchy.test.mjs`
- Modify: `exam-performance-ui-utils.js`
- Modify: `exam-performance-ui-utils.test.mjs`
- Modify: `admin-exam-performance-ui-contract.test.mjs`
- Modify: `admin-performance.html`
- Modify: `admin-performance.js`

**Interfaces:**
- Consumes Task 6 subject-history and scope-row metadata.
- Extends `ExamPerformanceUIUtils` with:
  - `eChipLabel(row): string` returning only `E1`, `E2`, ...
  - `findAttemptForScope(scopeRow, subjectHistory): object|null` matching `exam_id` and nearest/appropriate attempt history row
  - `performanceDialogModel(scopeRow, attemptRow): object`
- `performanceDialogModel` output:

```js
{
  examId,examTitle,examCode,examDate,attemptLabel,
  questionCount,score,maxMarks,percentage,
  correctCount,wrongCount,unattemptedCount,
  resultStatus,
  scopeLabel,
  scopeLevel,
  canOpenFullResult,
  canRebuild
}
```

- [ ] **Step 1: Write failing helper/UI contracts**

Create `admin-performance-hierarchy.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./exam-performance-ui-utils.js');

test('E chip is compact and dialog model contains approved details',()=>{
  const scope={exam_id:'e1',exam_sequence:2,exam_title:'DT 02',exam_code:'SGA-DT-010909',exam_date:'2026-09-09',scope_level:'topic',subtopic_title:'Significant Figures',question_count:5,earned_marks:16,max_marks:20,percentage:80,resultPublished:true};
  const attempt={exam_id:'e1',attempt_id:'a1',attempt_no:1,question_count:12,total_score:38,max_marks:48,percentage:79.17,correct_count:10,wrong_count:2,unattempted_count:0,resultPublished:true};
  assert.equal(u.eChipLabel(scope),'E2');
  const model=u.performanceDialogModel(scope,attempt);
  assert.equal(model.examCode,'SGA-DT-010909');
  assert.equal(model.examDate,'2026-09-09');
  assert.equal(model.scopeLabel,'Significant Figures');
  assert.equal(model.correctCount,10);
});

test('admin performance page is hierarchy first and includes one dialog shell',()=>{
  const html=fs.readFileSync('admin-performance.html','utf8');
  const js=fs.readFileSync('admin-performance.js','utf8');
  for(const id of ['performanceSubjectTabs','performanceHierarchy','performanceDialog','performanceDialogBody'])assert.match(html,new RegExp(id));
  assert.doesNotMatch(js,/function subjectCards\(/);
  assert.doesNotMatch(js,/function renderAttempts\(/);
  assert.match(js,/eChipLabel/);
  assert.match(js,/performanceDialogModel/);
});
```

- [ ] **Step 2: Run the contract and confirm RED**

```bash
node --test admin-performance-hierarchy.test.mjs exam-performance-ui-utils.test.mjs admin-exam-performance-ui-contract.test.mjs
```

Expected: FAIL because compact-chip/dialog helpers and new shell do not exist.

- [ ] **Step 3: Add pure compact-chip/dialog helpers**

In `exam-performance-ui-utils.js`:

```js
function eChipLabel(row={}){return `E${num(row.exam_sequence)||1}`;}
function findAttemptForScope(scopeRow={},history=[]){
  const candidates=(history||[]).filter(x=>id(x.exam_id)===id(scopeRow.exam_id));
  if(!candidates.length)return null;
  return candidates.slice().sort((a,b)=>new Date(b.submitted_at||0)-new Date(a.submitted_at||0)||num(b.attempt_no)-num(a.attempt_no))[0];
}
function performanceDialogModel(scopeRow={},attemptRow={}){
  const scopeLabel=scopeRow.scope_level==='unit'?(scopeRow.unit_title||'Unit'):
    scopeRow.scope_level==='chapter'?(scopeRow.chapter_title||'Chapter'):(scopeRow.subtopic_title||'Topic');
  return{
    examId:id(scopeRow.exam_id),examTitle:scopeRow.exam_title||attemptRow.exam_title||'Exam',examCode:scopeRow.exam_code||attemptRow.exam_code||'',examDate:scopeRow.exam_date||attemptRow.exam_date||null,
    attemptLabel:`Attempt ${num(attemptRow.attempt_no)||1}`,
    questionCount:num(attemptRow.question_count||scopeRow.question_count),score:num(attemptRow.total_score),maxMarks:num(attemptRow.max_marks),percentage:Number(attemptRow.percentage||0),
    correctCount:num(attemptRow.correct_count),wrongCount:num(attemptRow.wrong_count),unattemptedCount:num(attemptRow.unattempted_count),
    resultStatus:attemptRow.resultPublished?'PUBLISHED':'ADMIN ONLY',scopeLabel,scopeLevel:scopeRow.scope_level||'',
    canOpenFullResult:Boolean(attemptRow.attempt_id),canRebuild:Boolean(scopeRow.exam_id),attemptId:id(attemptRow.attempt_id)
  };
}
```

Export all three while preserving current hierarchy functions.

- [ ] **Step 4: Simplify Performance HTML to Learning-Progress-style structure**

Keep left Student list. In right detail area render subject tabs and hierarchy host rather than large metric cards/table. Add one modal outside the detail host:

```html
<div class="performance-dialog" id="performanceDialog" aria-hidden="true">
  <div class="performance-dialog-card">
    <div class="dialog-head"><h3 id="performanceDialogTitle">Exam Details</h3><button id="closePerformanceDialog">×</button></div>
    <div id="performanceDialogBody"></div>
    <div id="performanceDialogActions"></div>
  </div>
</div>
```

Use compact Unit cards with expandable Chapters and Topics, matching Learning Progress visual density rather than the old summary dashboard.

- [ ] **Step 5: Replace large subject cards/table controller paths**

In `admin-performance.js`, keep student loading and `admin_student_detail`. Replace `subjectCards()`/`renderAttempts()` with:

```js
function renderSubjectTabs(){...}
function renderHierarchy(){...}
function chip(scopeRow){return `<button class="e-chip" data-scope-exam="${esc(scopeRow.exam_id)}" data-scope-seq="${Number(scopeRow.exam_sequence||1)}">${esc(u.eChipLabel(scopeRow))}</button>`;}
function openPerformanceDialog(scopeRow){...}
```

`renderHierarchy()` uses `u.subjectScopeHierarchy(detail.scopeRows,selectedSubject)` and shows chips next to Unit/Chapter/Topic rows only where history exists.

- [ ] **Step 6: Build the dialog from scope row + matching subject history**

On E-chip click identify the exact scope row by `exam_id + exam_sequence + scope key`, find the matching attempt via `u.findAttemptForScope(scopeRow,detail.subjectHistory[selectedSubject])`, then render `u.performanceDialogModel()`.

Display exactly: exam name/code/date, attempt, questions, score/max, percentage, correct/wrong/unattempted, result status, exact scope. Keep values inside the dialog rather than repeated across the hierarchy.

- [ ] **Step 7: Preserve Full Result and Rebuild actions**

If `model.canOpenFullResult`, render a button that routes to the existing result/detail destination using `attemptId` without changing result data. Keep `REBUILD PERFORMANCE` bound to current protected `rebuild_exam` action and refresh `admin_student_detail` after success.

Legacy/unmapped exams remain in a compact notice; do not synthesize E chips.

- [ ] **Step 8: Update existing performance UI contract without weakening protected-data assertions**

`admin-exam-performance-ui-contract.test.mjs` must continue to assert:
- student-first left/right hosts exist
- protected actions `admin_students`, `admin_student_detail`, `rebuild_exam` are used
- direct `exam_results` browser reads are absent

Replace old expectations for always-visible `subjectHistory` table formatting with the new `performanceSubjectTabs`, `performanceHierarchy`, `eChipLabel`, and `performanceDialogModel` paths.

- [ ] **Step 9: Run complete Performance contracts**

```bash
node --test admin-performance-hierarchy.test.mjs admin-exam-performance-ui-contract.test.mjs exam-performance-ui-utils.test.mjs exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs performance-intelligence-policy.test.mjs performance-intelligence-integration.test.mjs
node --check admin-performance.js
node --check exam-performance-ui-utils.js
```

Expected: PASS.

- [ ] **Step 10: Commit Task 7**

```bash
git add admin-performance-hierarchy.test.mjs admin-exam-performance-ui-contract.test.mjs exam-performance-ui-utils.js exam-performance-ui-utils.test.mjs admin-performance.html admin-performance.js
git commit -m "feat: simplify exam performance hierarchy"
```

---

### Task 8: CI Integration, Full Regression, and PR Readiness

**Files:**
- Modify: `.github/workflows/examination-intelligence.yml`
- Create: `examinations-ux-consolidation-integration.test.mjs`
- Verify all files changed by Tasks 1–7

**Interfaces:**
- Consumes all focused contracts from Tasks 1–7.
- Produces exact-head CI evidence before any merge request.

- [ ] **Step 1: Write the integration contract before workflow edits**

Create `examinations-ux-consolidation-integration.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8');

test('CI explicitly covers all Examinations UX consolidation contracts',()=>{
  for(const file of [
    'exam-wizard-password.test.mjs','exam-wizard-shell.test.mjs','question-bank-folder-api.test.mjs','question-bank-folder-ui.test.mjs','admin-results-archive.test.mjs','admin-performance-hierarchy.test.mjs'
  ])assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(workflow,/supabase\/functions\/admin-question-bank\/index\.ts/);
});
```

- [ ] **Step 2: Run integration contract and confirm RED**

```bash
node --test examinations-ux-consolidation-integration.test.mjs
```

Expected: FAIL because workflow does not list the new tests or parse `admin-question-bank/index.ts`.

- [ ] **Step 3: Add focused contracts to Examination Intelligence workflow**

Append the six new contracts to the explicit `Run intelligence contracts` command:

```text
exam-wizard-password.test.mjs
exam-wizard-shell.test.mjs
question-bank-folder-api.test.mjs
question-bank-folder-ui.test.mjs
admin-results-archive.test.mjs
admin-performance-hierarchy.test.mjs
examinations-ux-consolidation-integration.test.mjs
```

- [ ] **Step 4: Parse the changed Question Bank Edge Function in CI**

Add:

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-question-bank/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-question-bank.js --external:*
```

Keep existing Edge parse lines, including `admin-exam-wizard` and `exam-performance`.

- [ ] **Step 5: Run focused integration test locally**

```bash
node --test examinations-ux-consolidation-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full root regression suite**

```bash
node --test *.test.js *.test.mjs *.test.cjs
```

Expected: 0 failures. Investigate any failure by root cause; do not weaken unrelated safety contracts to force green.

- [ ] **Step 7: Run all root browser JavaScript syntax checks**

```bash
find . -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: exit 0.

- [ ] **Step 8: Parse all changed Edge Functions**

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-exam-wizard/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-wizard.js --external:*
npx -y esbuild@0.25.9 supabase/functions/admin-question-bank/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-question-bank.js --external:*
npx -y esbuild@0.25.9 supabase/functions/exam-performance/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/exam-performance.js --external:*
```

Expected: all exit 0.

- [ ] **Step 9: Verify scope against `main`**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected changed implementation scope is limited to approved Examinations UX files, focused tests, the design/plan docs, and the Examination Intelligence workflow. No `student-exam-attempt` grading/timer files or communications implementation files should be modified.

- [ ] **Step 10: Commit CI integration**

```bash
git add .github/workflows/examination-intelligence.yml examinations-ux-consolidation-integration.test.mjs
git commit -m "test: verify examinations UX consolidation"
```

- [ ] **Step 11: Open a Draft PR and wait for exact-head workflows**

Create a Draft PR from the implementation branch to `main` with a body stating:
- five approved changes
- no grading/attempt/result semantic changes
- no DB migration
- changed Edge Functions only: `admin-exam-wizard`, `admin-question-bank`, `exam-performance`
- no production deployment yet

Wait for:
- Examination Intelligence Verification = success
- Academy Communications = success
- any repository workflow triggered by the changed Student/Question Bank scope = success

Do not merge here.

- [ ] **Step 12: Final review gate**

Use `superpowers:requesting-code-review`, inspect the PR diff, and confirm:
- six-digit password never leaks to notifications
- Question Bank initial browser payload contains no question text
- Add to Exam still calls existing immutable snapshot RPC
- Results Pending excludes published rows
- archive month uses `exam_date`
- Performance E chips use exact scope sequence
- no grading/attempt code changed

Mark PR Ready for Review only after these checks and exact-head CI are green. Stop and ask the user for merge/production-rollout approval.

---

## Post-Merge Production Rollout Gate

This section is intentionally not executed until the user separately approves the reviewed PR merge.

1. Verify merged `main` SHA.
2. Deploy only changed Edge Functions in this order:
   - `admin-exam-wizard`
   - `admin-question-bank`
   - `exam-performance`
3. Do not apply a DB migration; existing Question Bank indexes were already verified sufficient for the full canonical-path query.
4. Wait for GitHub Pages deployment of the merged SHA.
5. Run logged-in Admin smoke checks:
   - Create Exam auto password is six digits, Manual Change rejects non-six-digit input, regenerate stays six digits.
   - Steps 1–6 keep the same outer modal size; only the middle content scrolls.
   - Question Bank opens to Physics/Chemistry/Biology only; Subject → Chapter → Topic → Questions works; Added Date/Time and every approved sort work; Add to Exam succeeds for a Draft exam.
   - Results main work queue contains only unpublished rows; a published row moves to Exam Date Month → DT/WT/MT/GT → Exam; partially published exam behavior is correct.
   - Performance is Student → Subject → Unit → Chapter → Topic; E1/E2/E3 opens the detail dialog with correct metadata.
6. Re-check an existing published exam/result to prove no score/publication data changed.
7. If a live blocker appears, revert the frontend merge or redeploy the prior Edge version rather than rewriting production data.

---

## Final Acceptance Checklist

- [ ] Password generation/validation is exactly six digits on client and server.
- [ ] Wizard outer modal does not resize between all six desktop steps.
- [ ] Question Bank initial page sends no full question list to the browser.
- [ ] Question Bank folder path is Subject → Chapter → Topic → Questions with canonical Unit mapping retained underneath.
- [ ] Question view shows Added Date/Time and the six approved sort modes.
- [ ] Add to Exam keeps immutable snapshot semantics.
- [ ] Results Pending contains only unpublished rows.
- [ ] Published Results drills Month → DT/WT/MT/GT → Exam → Student rows based on Exam Date.
- [ ] Performance main view is compact syllabus hierarchy with E chips, not the old large metrics/table layout.
- [ ] E-chip dialog contains the approved exam/date/score/count/status/scope details and keeps rebuild/full-result actions where valid.
- [ ] Exact-scope E numbering remains unchanged.
- [ ] Full root regression, root JS syntax, changed Edge parses, Examination Intelligence, and Academy Communications are green on the exact PR head.
- [ ] No production deploy or merge occurs without explicit user approval.
