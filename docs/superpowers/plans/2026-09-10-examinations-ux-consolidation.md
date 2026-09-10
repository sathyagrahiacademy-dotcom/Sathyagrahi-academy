# Examinations UX Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the five approved Examinations UX changes as one safe batch: six-digit numeric Exam Passwords, a stable Create Exam Wizard shell, lazy folder-style Question Bank navigation, Pending/Published Results organization, and compact syllabus-first Performance with E-series dialogs.

**Architecture:** Preserve existing exam, grading, attempt, result, syllabus-mapping, question-snapshot, and communications semantics. Use focused browser utilities for pure presentation/grouping logic, minimal protected Edge reads for scalable Question Bank browsing and safe Performance metadata, and existing audited RPC/actions for all writes. No physical folder tables or existing-data rewrites are introduced.

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
- Each Published Results month renders all four type folders `DT`, `WT`, `MT`, `GT`; an empty type folder shows an empty state.
- Partially published exams may appear in both Pending and Published Archive at different student-row level.
- Performance E-numbering remains exact-scope-wise; Unit, Chapter, and Topic histories are independent and never guessed.
- E-chip dialog scores/counts come from the exact scope-performance row; attempt number/status comes from the exact matching `attempt_id`.
- No change to student exam timer/start/submit behavior, grading formulas, raw answer data, result publication meaning, Manual Exams, or communications routing.
- No production migration, Edge deployment, PR merge, or live activation before exact-head tests are green and the user explicitly approves the merge/rollout.
- Production index audit already found `question_bank_syllabus_idx (subject, unit_id, chapter_id, subtopic_id, is_active)` and `question_bank_created_idx (created_at DESC)`; this batch adds no database index migration.

---

## File Structure

### New focused files

- `exam-password-utils.js` — browser six-digit password generation/validation.
- `supabase/functions/admin-exam-wizard/password-policy.mjs` — server six-digit password validation.
- `exam-wizard-password.test.mjs` — password contract.
- `exam-wizard-shell.test.mjs` — stable Wizard geometry/scroll contract.
- `supabase/functions/admin-question-bank/folder-policy.mjs` — folder request/sort/paging normalization and summary builder.
- `question-bank-folder-api.test.mjs` — protected lazy Question Bank API contract.
- `question-bank-folder-ui.test.mjs` — folder browser UI contract.
- `admin-results-archive-utils.js` — Pending partition + Published month/type/exam grouping.
- `admin-results-archive.test.mjs` — Results archive/UI contract.
- `admin-performance-hierarchy.test.mjs` — hierarchy/E-chip/dialog contract.
- `examinations-ux-consolidation-integration.test.mjs` — CI/scope integration contract.

### Existing files modified

- `admin-examinations-nav.js` — load `exam-password-utils.js` before master Wizard.
- `admin-exam-wizard.js` — numeric password utility + stable shell.
- `admin-exam-wizard-release.js` — keep Steps 5/6 bounded inside shared scroll host.
- `supabase/functions/admin-exam-wizard/index.ts` — exact server password policy.
- `admin-question-bank.html` — folder browser + topic question panel.
- `admin-question-bank.js` — folder-state/lazy API controller; existing Add to Exam write path retained.
- `supabase/functions/admin-question-bank/index.ts` — `folder_summary` + `topic_questions`, existing actions retained.
- `admin-results.html` — Pending work queue + Published Archive drilldown.
- `admin-results.js` — partition/group rows, archive rendering, `?attempt=` result deep link.
- `admin-performance.html` — compact hierarchy + E-detail dialog.
- `admin-performance.js` — hierarchy rendering, E dialog, rebuild/full-result actions.
- `exam-performance-ui-utils.js` — exact-scope chip/dialog helpers.
- `supabase/functions/exam-performance/admin-student-performance.mjs` — safe exam metadata on subject history.
- `supabase/functions/exam-performance/index.ts` — safe Exam Date/Exam Code enrichment.
- `.github/workflows/examination-intelligence.yml` — focused contracts + changed Edge parse.

---

### Task 1: Six-Digit Exam Password Contract

**Files:**
- Create: `exam-password-utils.js`
- Create: `supabase/functions/admin-exam-wizard/password-policy.mjs`
- Create: `exam-wizard-password.test.mjs`
- Modify: `admin-examinations-nav.js`
- Modify: `admin-exam-wizard.js`
- Modify: `supabase/functions/admin-exam-wizard/index.ts`

**Interfaces:**
- Browser API: `isValidSixDigitPassword(value): boolean`, `generateSixDigitPassword(cryptoLike=globalThis.crypto): string`.
- Server API: `validateExamPassword(value): {ok:true,password:string}|{ok:false,error:string}`.
- Existing `hashPassword()` remains the only persistence path.

- [ ] **Step 1: Write the failing password contract**

Create `exam-wizard-password.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { validateExamPassword } from './supabase/functions/admin-exam-wizard/password-policy.mjs';
const require=createRequire(import.meta.url);
const client=require('./exam-password-utils.js');

test('password policy is exactly six digits and permits leading zero',()=>{
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
  const fake={getRandomValues(bytes){bytes[0]=123;return bytes;}};
  assert.match(client.generateSixDigitPassword(fake),/^\d{6}$/);
});

test('wizard and edge both use shared six digit policies',()=>{
  const wizard=fs.readFileSync('admin-exam-wizard.js','utf8');
  const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
  assert.match(wizard,/ExamPasswordUtils/);
  assert.match(edge,/validateExamPassword/);
  assert.doesNotMatch(edge,/4 to 64 characters/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test exam-wizard-password.test.mjs
```

Expected: FAIL because the two policy files do not exist.

- [ ] **Step 3: Implement browser utility**

Create `exam-password-utils.js`:

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

- [ ] **Step 4: Implement server policy**

Create `supabase/functions/admin-exam-wizard/password-policy.mjs`:

```js
export function validateExamPassword(value){
  const password=String(value??'');
  if(!/^\d{6}$/.test(password))return{ok:false,error:'Exam Password must be exactly 6 digits'};
  return{ok:true,password};
}
```

- [ ] **Step 5: Load utility before Wizard and use it for generate/manual validation**

In `admin-examinations-nav.js`, in the existing master-enabled loader sequence, load `exam-password-utils.js` immediately before `admin-exam-wizard.js`.

In `admin-exam-wizard.js`:

```js
const passwordUtils=window.ExamPasswordUtils;
const randomPassword=()=>passwordUtils.generateSixDigitPassword();
```

Before create/update submission:

```js
const examPassword=String(document.getElementById('mwPassword')?.value||'');
if(!passwordUtils.isValidSixDigitPassword(examPassword)){
  const msg=document.getElementById('mwMsg');
  if(msg){msg.classList.remove('ok');msg.textContent='Exam Password must be exactly 6 digits.';}
  return;
}
```

- [ ] **Step 6: Use server policy before hashing**

In `supabase/functions/admin-exam-wizard/index.ts`:

```ts
import { validateExamPassword } from './password-policy.mjs'
```

For `create_master_exam`:

```ts
const passwordCheck=validateExamPassword(body.examPassword)
if(!passwordCheck.ok)return json({error:passwordCheck.error},400)
const passwordHash=await hashPassword(passwordCheck.password)
```

For password replacement in `update_master_basics`, run the same validator before `hashPassword()`.

- [ ] **Step 7: Run password/Wizard/notification contracts**

```bash
node --test exam-wizard-password.test.mjs admin-exam-wizard-ui.test.mjs admin-exam-wizard-basic-contract.test.mjs student-exam-notice-integration.test.mjs exam-master-publish-contract.test.mjs
```

Expected: PASS; notification contracts still prove password is not sent.

- [ ] **Step 8: Commit**

```bash
git add exam-password-utils.js exam-wizard-password.test.mjs admin-examinations-nav.js admin-exam-wizard.js supabase/functions/admin-exam-wizard/password-policy.mjs supabase/functions/admin-exam-wizard/index.ts
git commit -m "fix: require six digit exam passwords"
```

---

### Task 2: Stable Create Exam Wizard Shell

**Files:**
- Create: `exam-wizard-shell.test.mjs`
- Modify: `admin-exam-wizard.js`
- Modify: `admin-exam-wizard-release.js`

**Interfaces:** Existing IDs `#masterExamWizardModal`, `#mwSteps`, `#mwStepHost`, `#mwMsg`, `#mwBack`, `#mwNext` remain unchanged. New `.mw-step-scroll` is the only outer vertical-scroll region.

- [ ] **Step 1: Write failing shell contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('admin-exam-wizard.js','utf8');
const release=fs.readFileSync('admin-exam-wizard-release.js','utf8');

test('outer Wizard has stable height and only step region scrolls',()=>{
  assert.match(js,/\.master-wizard-card\{[^}]*height:min\(760px,94vh\)/s);
  assert.match(js,/\.master-wizard-card\{[^}]*overflow:hidden/s);
  assert.match(js,/\.mw-body\{[^}]*display:flex[^}]*min-height:0/s);
  assert.match(js,/\.mw-step-scroll\{[^}]*overflow-y:auto/s);
  assert.match(js,/class="mw-step-scroll"/);
});

test('release module does not resize the outer card',()=>{
  assert.doesNotMatch(release,/master-wizard-card[^\n]*(height|max-height|overflow)/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test exam-wizard-shell.test.mjs
```

Expected: FAIL because current outer card itself scrolls.

- [ ] **Step 3: Implement stable shell CSS**

```css
.master-wizard-card{
  width:min(1120px,97vw);height:min(760px,94vh);max-height:94vh;
  overflow:hidden;display:flex;flex-direction:column;
  background:#fff;border-radius:14px;box-shadow:0 24px 70px #04152f55;
}
.mw-head,.mw-steps{flex:0 0 auto}
.mw-body{padding:0;display:flex;flex:1 1 auto;min-height:0;flex-direction:column}
.mw-step-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 22px 0}
.mw-actions{flex:0 0 auto;margin:0;padding:14px 22px 18px;border-top:1px solid #e8edf4;background:#fff}
@media(max-height:720px),(max-width:700px){
  .master-wizard-card{height:94vh}
  .mw-step-scroll{padding:16px 14px 0}
  .mw-actions{padding:12px 14px 14px}
}
```

- [ ] **Step 4: Move only step host/message into scroll region**

```html
<div class="mw-body">
  <div class="mw-step-scroll">
    <div id="mwStepHost"></div>
    <div class="mw-msg" id="mwMsg"></div>
  </div>
  <div class="mw-actions">...</div>
</div>
```

Keep footer IDs/actions unchanged for `admin-exam-wizard-release.js`.

- [ ] **Step 5: Keep Step 5/6 internals bounded**

Retain `.mw-audience-list{max-height:330px;overflow-y:auto}` and ensure release CSS never targets `.master-wizard-card` sizing.

- [ ] **Step 6: Run all Wizard contracts**

```bash
node --test exam-wizard-shell.test.mjs admin-exam-wizard-ui.test.mjs exam-wizard-coverage.test.mjs exam-wizard-questions-integration.test.mjs exam-blueprint-approval.test.mjs exam-wizard-audience.test.mjs exam-master-publish-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

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

**Interfaces:**
- `folder_summary` request `{action:'folder_summary'}` returns `{ok:true,total,subjects}` with no question text.
- Each subject contains canonical Chapter folders with Unit context and Topic folders/counts.
- `topic_questions` request `{action:'topic_questions',subject,unitId,chapterId,subtopicId,sort,search,limit,offset}`.
- Allowed sort values: `newest`, `oldest`, `difficulty`, `question_type`, `source`, `source_year`.
- Response `{ok:true,questions,total,hasMore}`; each question includes `created_at`.
- Existing `list`, `bulk_import`, `add_to_exam`, `sync_exam` remain intact.

- [ ] **Step 1: Write failing API contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTopicQuestionRequest,buildFolderSummary } from './supabase/functions/admin-question-bank/folder-policy.mjs';

test('topic reads accept only canonical context, approved sort and bounded paging',()=>{
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'newest',limit:50,offset:0}).ok,true);
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'sql'}).ok,false);
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,limit:101}).ok,false);
});

test('folder summary counts questions without exposing question text',()=>{
  const tree={units:[{id:1,subject:'Physics',unit_no:1,unit_title:'Physics and Measurement',sort_order:1}],chapters:[{id:11,unit_id:1,topic_title:'Units',sort_order:1}],subtopics:[{id:101,chapter_id:11,subtopic_title:'SI Units',status:'approved',sort_order:1}]};
  const summary=buildFolderSummary(tree,[{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101},{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101}]);
  assert.equal(summary.subjects[0].count,2);
  assert.equal(summary.subjects[0].chapters[0].topics[0].count,2);
  assert.equal(JSON.stringify(summary).includes('question_text'),false);
});

test('edge keeps legacy/write actions and adds lazy reads',()=>{
  const edge=fs.readFileSync('supabase/functions/admin-question-bank/index.ts','utf8');
  for(const action of ['folder_summary','topic_questions','list','bulk_import','add_to_exam','sync_exam'])assert.match(edge,new RegExp(`action===['"]${action}['"]`));
  assert.match(edge,/add_bank_questions_to_exam/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test question-bank-folder-api.test.mjs
```

Expected: FAIL because policy/new actions are absent.

- [ ] **Step 3: Implement request policy**

```js
const SUBJECTS=['Physics','Chemistry','Biology'];
const SORTS=new Set(['newest','oldest','difficulty','question_type','source','source_year']);
const text=v=>String(v??'').trim();
export function normalizeTopicQuestionRequest(input={}){
  const subject=text(input.subject),unitId=text(input.unitId),chapterId=text(input.chapterId),subtopicId=text(input.subtopicId);
  const sort=text(input.sort||'newest'),search=text(input.search).slice(0,160);
  const limit=Number(input.limit??50),offset=Number(input.offset??0);
  if(!SUBJECTS.includes(subject)||!unitId||!chapterId||!subtopicId)return{ok:false,error:'Complete syllabus folder context is required'};
  if(!SORTS.has(sort))return{ok:false,error:'Invalid question sort'};
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0)return{ok:false,error:'Invalid question paging'};
  return{ok:true,value:{subject,unitId,chapterId,subtopicId,sort,search,limit,offset}};
}
```

Implement `buildFolderSummary(tree,rows)` for the three approved subjects only, using canonical Unit/Chapter/Topic relationships; omit non-approved topics from navigable output.

- [ ] **Step 4: Add metadata-only `folder_summary`**

Internally page active metadata in batches of 1000:

```ts
admin.from('question_bank_questions')
  .select('subject,unit_id,chapter_id,subtopic_id')
  .eq('is_active',true)
  .range(from,from+999)
```

Pass metadata to `buildFolderSummary()` and return no `question_text`.

- [ ] **Step 5: Add canonical-context `topic_questions`**

Verify from the canonical tree that `subtopic -> chapter -> unit -> subject` exactly matches request context. Query active rows with all four hierarchy columns:

```ts
let query=admin.from('question_bank_questions')
  .select('id,subject,unit_id,chapter_id,subtopic_id,question_text,default_marks,default_negative_marks,difficulty,question_type,source_label,source_year,created_at',{count:'exact'})
  .eq('is_active',true)
  .eq('subject',v.subject)
  .eq('unit_id',v.unitId)
  .eq('chapter_id',v.chapterId)
  .eq('subtopic_id',v.subtopicId)
```

Map sort keys exactly:

```ts
const sortColumn={newest:'created_at',oldest:'created_at',difficulty:'difficulty',question_type:'question_type',source:'source_label',source_year:'source_year'}[v.sort]
const ascending=v.sort==='oldest'||['difficulty','question_type','source'].includes(v.sort)
query=query.order(sortColumn,{ascending,nullsFirst:false}).order('created_at',{ascending:false})
```

Apply escaped `question_text` search only inside selected topic, page with `.range(v.offset,v.offset+v.limit-1)`, return `hasMore=v.offset+(rows?.length||0)<Number(count||0)`.

- [ ] **Step 6: Keep existing indexes; add no migration**

The read-only production audit already proved the full-path query has `question_bank_syllabus_idx`, and chronological sort has `question_bank_created_idx`. Do not create SQL in this task.

- [ ] **Step 7: Run Question Bank contracts**

```bash
node --test question-bank-folder-api.test.mjs question-bank-blueprint-contract.test.mjs question-bank-import-policy.test.mjs question-bank-import-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

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
- Modify structural assertions in `question-bank-blueprint-contract.test.mjs` only where the old flat filter IDs are obsolete; retain protected API/import/snapshot assertions.

**Interfaces:** Consumes Task 3 actions. Keeps `?exam=<id>` draft preselection and unchanged `add_to_exam` write request. Topic questions load in batches of 50 with `LOAD MORE`, not page-wide pagination.

- [ ] **Step 1: Write failing UI contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('admin-question-bank.html','utf8');
const js=fs.readFileSync('admin-question-bank.js','utf8');

test('opening view is three subject folders and not a question table',()=>{
  for(const id of ['qbFolderHost','qbBreadcrumb','qbQuestionHost','qbSort','qbSearch','qbLoadMore'])assert.match(html,new RegExp(id));
  assert.doesNotMatch(html,/id=["']rows["']/);
  assert.match(js,/folder_summary/);
  assert.doesNotMatch(js,/action:['"]list['"]/);
});

test('flow is subject then chapter then topic then questions',()=>{
  for(const token of ['renderSubjects','renderChapters','renderTopics','loadTopicQuestions'])assert.match(js,new RegExp(token));
  assert.match(js,/topic_questions/);
});

test('question view has added date time and approved sorting',()=>{
  for(const text of ['Newest First','Oldest First','Difficulty','Question Type','Source','Source Year'])assert.match(html,new RegExp(text));
  assert.match(js,/created_at/);
  assert.match(js,/toLocaleDateString/);
  assert.match(js,/toLocaleTimeString/);
  assert.match(js,/add_to_exam/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test question-bank-folder-ui.test.mjs
```

Expected: FAIL against current flat list.

- [ ] **Step 3: Replace flat table with folder browser shell**

Keep Examination shell, summary counts, format guide, and Add-to-Exam modal. Replace filters/table with:

```html
<section class="panel qb-browser">
  <div class="qb-browser-head"><div id="qbBreadcrumb">Question Bank</div><button id="qbBack" class="btn" hidden>BACK</button></div>
  <div id="qbFolderHost" class="qb-folder-grid"></div>
  <div id="qbQuestionHost" hidden>
    <div class="qb-question-toolbar">
      <input id="qbSearch" placeholder="Search inside this topic">
      <select id="qbSort">
        <option value="newest">Newest First</option><option value="oldest">Oldest First</option>
        <option value="difficulty">Difficulty</option><option value="question_type">Question Type</option>
        <option value="source">Source</option><option value="source_year">Source Year</option>
      </select>
    </div>
    <div id="qbQuestionList"></div>
    <button id="qbLoadMore" class="btn" type="button" hidden>LOAD MORE</button>
    <div class="actions"><button class="btn primary" id="copySelected">ADD SELECTED TO EXAM</button><span id="selectedCount">0 selected</span></div>
  </div>
</section>
```

- [ ] **Step 4: Initial load uses summary only**

```js
const [summary,er]=await Promise.all([
  invoke({action:'folder_summary'}),
  c.from('exams').select('id,title,subject,is_published,status').order('created_at',{ascending:false})
]);
folderSummary=summary;
renderSubjects();
```

Do not store/fetch the bank's full question array.

- [ ] **Step 5: Implement drilldown controller**

Create exact paths:

```js
function renderSubjects(){...}
function renderChapters(subject){...}
function renderTopics(chapter){...}
async function loadTopicQuestions(topic,{reset=true}={}){...}
```

Chapter cards show Chapter title plus small Unit title context; Topics show count. Breadcrumb is `Question Bank / Subject / Chapter / Topic`.

- [ ] **Step 6: Load and render only selected-topic questions**

On reset use `limit:50,offset:0`; on `LOAD MORE` use current loaded length as offset and append response. Render:
- checkbox
- question text
- difficulty/type/source/year
- `Added <date> • <time>` derived with `toLocaleDateString('en-IN')` and `toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})`

Set `qbLoadMore.hidden=!response.hasMore`.

- [ ] **Step 7: Wire sort/search without losing folder context**

Sort change resets current-topic fetch. Debounce search ~250 ms and reset current-topic fetch. Selection Set persists for questions already selected in the current topic while sort/search changes.

- [ ] **Step 8: Preserve Add to Exam and requested exam preselection**

Use unchanged write:

```js
await invoke({action:'add_to_exam',examId,bankIds:[...selected]});
location.href='admin-exam-questions.html?exam='+encodeURIComponent(examId);
```

- [ ] **Step 9: Run UI/regression contracts**

```bash
node --test question-bank-folder-ui.test.mjs question-bank-folder-api.test.mjs question-bank-blueprint-contract.test.mjs question-bank-import-ui.test.mjs exam-wizard-questions-integration.test.mjs
node --check admin-question-bank.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

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
- Query nested exam fields `id,title,subject,total_marks,result_published,exam_type,exam_date`.
- Utility API: `examTypeCode`, `examMonthKey`, `partitionResultRows`, `groupPublishedResults`.
- Every month bucket contains exactly four type buckets in order `DT,WT,MT,GT`, including zero-row buckets.
- `admin-results.html?attempt=<attemptId>` opens existing question-wise detail after load; this is the Full Result destination used by Task 7.

- [ ] **Step 1: Write failing Results contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./admin-results-archive-utils.js');

test('pending has unpublished only and archive groups by Exam Date',()=>{
  const rows=[
    {attempt_id:'a1',is_published:false,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a2',is_published:true,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a3',is_published:true,exam_attempts:{exam_id:'e2',exams:{id:'e2',title:'GT 1',exam_type:'grand',exam_date:'2026-10-02'}}}
  ];
  const parts=u.partitionResultRows(rows);
  assert.deepEqual(parts.pending.map(x=>x.attempt_id),['a1']);
  const archive=u.groupPublishedResults(parts.published);
  assert.equal(archive[0].key,'2026-10');
  assert.deepEqual(archive[1].types.map(x=>x.code),['DT','WT','MT','GT']);
  assert.equal(archive[1].types.find(x=>x.code==='WT').exams[0].rows[0].attempt_id,'a2');
});

test('type mapping is DT WT MT GT',()=>{
  assert.equal(u.examTypeCode('daily'),'DT');assert.equal(u.examTypeCode('weekly'),'WT');
  assert.equal(u.examTypeCode('monthly'),'MT');assert.equal(u.examTypeCode('grand'),'GT');
});

test('page has pending/archive hosts and attempt deep link support',()=>{
  const html=fs.readFileSync('admin-results.html','utf8'),js=fs.readFileSync('admin-results.js','utf8');
  for(const id of ['pendingRows','publishedMonths','archiveExamRows'])assert.match(html,new RegExp(id));
  assert.match(js,/URLSearchParams/);assert.match(js,/get\(['"]attempt['"]\)/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test admin-results-archive.test.mjs
```

Expected: FAIL because helper/new hosts do not exist.

- [ ] **Step 3: Implement pure grouping utility**

`examMonthKey()` uses the `YYYY-MM-DD` Exam Date directly, not graded/submitted/published timestamps. `groupPublishedResults()` starts each month with:

```js
const types=['DT','WT','MT','GT'].map(code=>({code,exams:[]}));
```

Then group published rows by type and exam. Sort months newest first, exams by Exam Date then title.

- [ ] **Step 4: Extend Results query safely**

Use nested select:

```text
exams!inner(id,title,subject,total_marks,result_published,exam_type,exam_date)
```

No grading/result mutation changes.

- [ ] **Step 5: Replace flat status filter with two regions**

```html
<section class="panel results-pending">
  <div class="head"><div><h3>TO BE PUBLISHED</h3><p class="muted">Only results still awaiting Admin publication.</p></div></div>
  <input id="pendingSearch" placeholder="Search student, ID or exam">
  <table><tbody id="pendingRows"></tbody></table>
</section>
<section class="panel results-archive">
  <div class="head"><div><h3>PUBLISHED RESULTS</h3><p class="muted">Month → DT / WT / MT / GT → Exam → Students</p></div></div>
  <div id="publishedMonths"></div><div id="archiveExamRows"></div>
</section>
```

- [ ] **Step 6: Render Pending with Publish action only here**

Use `partitionResultRows(data).pending`. Keep `VIEW`, `ANALYTICS`, `RE-EXAM`, `RESET`, `PUBLISH`. After `publish_result` succeeds, call `await load()` so the row automatically leaves Pending.

- [ ] **Step 7: Render archive Month → Type → Exam → Students**

Every selected month shows four type folders with counts. Clicking empty type shows `No published DT/WT/MT/GT results in this month.` Clicking a non-empty type shows exams; clicking exam shows published student rows with `VIEW`, `ANALYTICS`, `RE-EXAM`, `RESET` and no `PUBLISH`.

Partially published exams naturally appear in both regions at different row level.

- [ ] **Step 8: Add exact attempt deep link and preserve shared actions**

At startup:

```js
const requestedAttempt=new URLSearchParams(location.search).get('attempt');
```

After `load()` populates `data`, if `requestedAttempt` matches any row call existing `detail(requestedAttempt)`. Use shared event delegation for both Pending and Archive action buttons.

- [ ] **Step 9: Run Results contracts**

```bash
node --test admin-results-archive.test.mjs exam-grading-performance.test.mjs exam-master-publish-contract.test.mjs student-answer-review-intelligence.test.mjs
node --check admin-results.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

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
- Modify: `exam-performance-contract.test.mjs` only to assert safe metadata exposure/no password hash.

**Interfaces:** Subject history and scope rows gain safe `exam_code` and `exam_date`; no `password_hash` or answer-key data is exposed.

- [ ] **Step 1: Extend failing model/source contract**

In `exam-admin-student-performance.test.mjs` fixture:

```js
const exam={id:'e1',title:'Mixed 01',subject:'Mixed',negative_marking:true,exam_code:'SGA-DT-010809',exam_date:'2026-09-08'};
```

Assert:

```js
assert.equal(p.exam_code,'SGA-DT-010809');
assert.equal(p.exam_date,'2026-09-08');
```

In `exam-performance-contract.test.mjs`, assert `index.ts` selects `exam_date` and `exam_access`/`exam_code`, and does not select `password_hash`.

- [ ] **Step 2: Verify RED**

```bash
node --test exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs
```

Expected: FAIL because metadata is not carried through.

- [ ] **Step 3: Carry metadata in subject attempt**

```js
return{
  exam_id:text(exam.id),exam_title:exam.title||'',exam_code:exam.exam_code||'',exam_date:exam.exam_date||null,subject:String(subject),
  ...
};
```

- [ ] **Step 4: Attach access code to eligible exams**

Add `exam_date` to existing `exams` select in `loadEligibleExams()`. After audience filtering, load:

```ts
const ids=eligible.map((e:any)=>e.id)
const access=ids.length?await admin.from('exam_access').select('exam_id,exam_code').in('exam_id',ids):{data:[],error:null}
```

Map each returned exam to `{...exam,exam_code:codeByExam.get(text(exam.id))||''}`. Never select `password_hash`.

- [ ] **Step 5: Enrich scope rows with the same safe metadata**

In `enrichRows()`, add `exam_date` to `exams` select and load `exam_access(exam_id,exam_code)` as a separate Promise. Add `exam_date` and `exam_code` to returned scope rows.

- [ ] **Step 6: Run complete Performance backend contracts**

```bash
node --test exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs performance-intelligence-policy.test.mjs performance-intelligence-integration.test.mjs exam-performance-visibility.test.mjs
```

Expected: PASS; score calculations are unchanged.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/exam-performance/admin-student-performance.mjs supabase/functions/exam-performance/index.ts exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs
git commit -m "feat: expose safe performance exam metadata"
```

---

### Task 7: Compact Performance Hierarchy and Exact-Scope E Dialog

**Files:**
- Create: `admin-performance-hierarchy.test.mjs`
- Modify: `exam-performance-ui-utils.js`
- Modify: `exam-performance-ui-utils.test.mjs`
- Modify: `admin-exam-performance-ui-contract.test.mjs`
- Modify: `admin-performance.html`
- Modify: `admin-performance.js`

**Interfaces:**
- `eChipLabel(scopeRow) -> 'E1'|'E2'...`.
- `findAttemptForScope(scopeRow,subjectHistory)` first matches exact `attempt_id`; only falls back to same `exam_id` when older legacy scope rows have no `attempt_id`.
- `performanceDialogModel(scopeRow,attemptRow)` uses exact scope row for question count/marks/percentage/correct/wrong/unattempted and exact attempt row for attempt label/result publication/full-result ID.

- [ ] **Step 1: Write failing helper/UI contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./exam-performance-ui-utils.js');

test('E dialog uses exact scope metrics and exact attempt',()=>{
  const scope={attempt_id:'a2',exam_id:'e1',exam_sequence:2,exam_title:'DT 02',exam_code:'SGA-DT-010909',exam_date:'2026-09-09',scope_level:'topic',subtopic_title:'Significant Figures',question_count:5,earned_marks:16,max_marks:20,percentage:80,correct_count:4,wrong_count:1,unattempted_count:0};
  const history=[{attempt_id:'a1',exam_id:'e1',attempt_no:1,resultPublished:true},{attempt_id:'a2',exam_id:'e1',attempt_no:2,resultPublished:true}];
  assert.equal(u.eChipLabel(scope),'E2');
  const attempt=u.findAttemptForScope(scope,history);
  assert.equal(attempt.attempt_id,'a2');
  const model=u.performanceDialogModel(scope,attempt);
  assert.equal(model.questionCount,5);assert.equal(model.score,16);assert.equal(model.maxMarks,20);assert.equal(model.correctCount,4);
  assert.equal(model.examCode,'SGA-DT-010909');assert.equal(model.scopeLabel,'Significant Figures');assert.equal(model.attemptLabel,'Attempt 2');
});

test('performance page is hierarchy first with one E dialog shell',()=>{
  const html=fs.readFileSync('admin-performance.html','utf8'),js=fs.readFileSync('admin-performance.js','utf8');
  for(const id of ['performanceSubjectTabs','performanceHierarchy','performanceDialog','performanceDialogBody'])assert.match(html,new RegExp(id));
  assert.doesNotMatch(js,/function subjectCards\(/);assert.doesNotMatch(js,/function renderAttempts\(/);
  assert.match(js,/eChipLabel/);assert.match(js,/performanceDialogModel/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test admin-performance-hierarchy.test.mjs exam-performance-ui-utils.test.mjs admin-exam-performance-ui-contract.test.mjs
```

Expected: FAIL because helpers/new shell do not exist.

- [ ] **Step 3: Implement exact helper functions**

```js
function eChipLabel(row={}){return `E${num(row.exam_sequence)||1}`;}
function findAttemptForScope(scopeRow={},history=[]){
  const exact=(history||[]).find(x=>id(x.attempt_id)===id(scopeRow.attempt_id));
  if(exact)return exact;
  if(scopeRow.attempt_id)return null;
  const same=(history||[]).filter(x=>id(x.exam_id)===id(scopeRow.exam_id));
  return same.slice().sort((a,b)=>new Date(b.submitted_at||0)-new Date(a.submitted_at||0)||num(b.attempt_no)-num(a.attempt_no))[0]||null;
}
function performanceDialogModel(scopeRow={},attemptRow={}){
  const scopeLabel=scopeRow.scope_level==='unit'?(scopeRow.unit_title||'Unit'):
    scopeRow.scope_level==='chapter'?(scopeRow.chapter_title||'Chapter'):(scopeRow.subtopic_title||'Topic');
  return{
    examId:id(scopeRow.exam_id),examTitle:scopeRow.exam_title||attemptRow.exam_title||'Exam',examCode:scopeRow.exam_code||attemptRow.exam_code||'',examDate:scopeRow.exam_date||attemptRow.exam_date||null,
    attemptLabel:`Attempt ${num(attemptRow.attempt_no)||1}`,
    questionCount:num(scopeRow.question_count),score:num(scopeRow.earned_marks),maxMarks:num(scopeRow.max_marks),percentage:Number(scopeRow.percentage||0),
    correctCount:num(scopeRow.correct_count),wrongCount:num(scopeRow.wrong_count),unattemptedCount:num(scopeRow.unattempted_count),
    resultStatus:attemptRow.resultPublished?'PUBLISHED':'ADMIN ONLY',scopeLabel,scopeLevel:scopeRow.scope_level||'',
    attemptId:id(attemptRow.attempt_id),canOpenFullResult:Boolean(attemptRow.attempt_id),canRebuild:Boolean(scopeRow.exam_id)
  };
}
```

Preserve/export existing hierarchy/filter helpers.

- [ ] **Step 4: Simplify HTML to subject tabs + hierarchy + one dialog**

Keep the left Student list. Right detail becomes compact Subject tabs and hierarchy. Add:

```html
<div class="performance-dialog" id="performanceDialog" aria-hidden="true">
  <div class="performance-dialog-card">
    <div class="dialog-head"><h3 id="performanceDialogTitle">Exam Details</h3><button id="closePerformanceDialog">×</button></div>
    <div id="performanceDialogBody"></div><div id="performanceDialogActions"></div>
  </div>
</div>
```

Use Learning Progress-like dense Unit cards, expandable Chapters, then Topic rows.

- [ ] **Step 5: Replace old large subject cards/table paths**

Create:

```js
function renderSubjectTabs(){...}
function renderHierarchy(){...}
function chip(scopeRow){return `<button class="e-chip" data-attempt="${esc(scopeRow.attempt_id||'')}" data-scope="${esc(u.scopeKey(scopeRow))}" data-seq="${Number(scopeRow.exam_sequence||1)}">${esc(u.eChipLabel(scopeRow))}</button>`;}
function openPerformanceDialog(scopeRow){...}
```

`renderHierarchy()` uses `u.subjectScopeHierarchy(detail.scopeRows,selectedSubject)` and shows E chips only where exact mapped history exists.

- [ ] **Step 6: Open dialog using exact scope row + exact attempt row**

Resolve clicked row by `scopeKey + exam_sequence + attempt_id`. Then:

```js
const attempt=u.findAttemptForScope(scopeRow,detail.subjectHistory?.[selectedSubject]||[]);
const model=u.performanceDialogModel(scopeRow,attempt||{});
```

Render exam name/code/date, attempt, exact-scope questions/score/max/percentage/correct/wrong/unattempted, status, and exact scope label.

- [ ] **Step 7: Preserve Full Result and Rebuild actions**

If `model.canOpenFullResult`, route:

```js
location.href='admin-results.html?attempt='+encodeURIComponent(model.attemptId);
```

If `model.canRebuild`, call existing protected `{action:'rebuild_exam',examId:model.examId}`, reload `admin_student_detail`, and rerender hierarchy. Legacy/unmapped exams remain explicitly labeled with no guessed E chips.

- [ ] **Step 8: Update old UI contract without weakening security assertions**

Keep assertions that page is student-first, uses `admin_students`, `admin_student_detail`, `rebuild_exam`, and does not browser-read `exam_results` directly. Replace old always-visible table/subject-stat expectations with `performanceSubjectTabs`, `performanceHierarchy`, `eChipLabel`, `performanceDialogModel`.

- [ ] **Step 9: Run complete Performance contracts**

```bash
node --test admin-performance-hierarchy.test.mjs admin-exam-performance-ui-contract.test.mjs exam-performance-ui-utils.test.mjs exam-admin-student-performance.test.mjs exam-performance-contract.test.mjs performance-intelligence-policy.test.mjs performance-intelligence-integration.test.mjs
node --check admin-performance.js
node --check exam-performance-ui-utils.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add admin-performance-hierarchy.test.mjs admin-exam-performance-ui-contract.test.mjs exam-performance-ui-utils.js exam-performance-ui-utils.test.mjs admin-performance.html admin-performance.js
git commit -m "feat: simplify exam performance hierarchy"
```

---

### Task 8: CI Integration, Full Regression, and PR Readiness

**Files:**
- Create: `examinations-ux-consolidation-integration.test.mjs`
- Modify: `.github/workflows/examination-intelligence.yml`

**Interfaces:** Explicitly gates all six focused test files plus integration test and parses all three changed Edge Functions.

- [ ] **Step 1: Write failing CI contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8');
test('CI explicitly covers Examinations UX contracts and changed Edge',()=>{
  for(const file of ['exam-wizard-password.test.mjs','exam-wizard-shell.test.mjs','question-bank-folder-api.test.mjs','question-bank-folder-ui.test.mjs','admin-results-archive.test.mjs','admin-performance-hierarchy.test.mjs','examinations-ux-consolidation-integration.test.mjs'])assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(workflow,/supabase\/functions\/admin-question-bank\/index\.ts/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test examinations-ux-consolidation-integration.test.mjs
```

Expected: FAIL because workflow lacks new entries.

- [ ] **Step 3: Add contracts to workflow**

Add all seven files above to `Run intelligence contracts`.

- [ ] **Step 4: Add Question Bank Edge parse**

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-question-bank/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-question-bank.js --external:*
```

Keep existing `admin-exam-wizard` and `exam-performance` parses.

- [ ] **Step 5: Verify integration test GREEN**

```bash
node --test examinations-ux-consolidation-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run full root regression**

```bash
node --test *.test.js *.test.mjs *.test.cjs
```

Expected: 0 failures. Diagnose root cause for any failure; do not weaken unrelated safety contracts merely to obtain green.

- [ ] **Step 7: Run all root JS syntax checks**

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

- [ ] **Step 9: Scope audit against `main`**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected: only approved Examinations UX implementation/tests/docs/workflow files. No `student-exam-attempt` timer/grading implementation files and no communications implementation files changed.

- [ ] **Step 10: Commit CI integration**

```bash
git add .github/workflows/examination-intelligence.yml examinations-ux-consolidation-integration.test.mjs
git commit -m "test: verify examinations UX consolidation"
```

- [ ] **Step 11: Open Draft PR and wait for exact-head CI**

Draft PR body must state:
- five approved UX changes
- no grading/attempt/result-semantic changes
- no DB migration
- changed Edge Functions: `admin-exam-wizard`, `admin-question-bank`, `exam-performance`
- no production deployment yet

Required exact-head workflows: Examination Intelligence Verification and Academy Communications, plus any Question Bank-specific workflow triggered by the changed files. Do not merge.

- [ ] **Step 12: Final review gate**

Use `superpowers:requesting-code-review` and verify:
- password remains absent from notifications
- initial Question Bank browser payload contains no question text
- Add to Exam still calls immutable snapshot RPC
- Results Pending excludes published rows
- archive uses `exam_date`, and month displays all DT/WT/MT/GT folders
- Performance chip resolves exact `attempt_id` and exact scope metrics
- no grading/attempt code changed

Mark PR Ready for Review only after exact-head CI and review are green. Stop and ask the user for merge/production-rollout approval.

---

## Post-Merge Production Rollout Gate

Execute only after separate user approval of the reviewed PR merge.

1. Verify merged `main` SHA.
2. Deploy only changed Edge Functions, in order: `admin-exam-wizard`, `admin-question-bank`, `exam-performance`.
3. Apply no DB migration; existing Question Bank indexes were already verified sufficient for full canonical-path reads.
4. Wait for GitHub Pages deployment of the merged SHA.
5. Logged-in Admin smoke checks:
   - auto/regenerated password is six digits; Manual Change rejects any non-six-digit value
   - all six Wizard steps keep one outer modal size; middle content scrolls
   - Question Bank opens to Physics/Chemistry/Biology only; Subject → Chapter → Topic → Questions works; Added Date/Time, six sort modes, Load More, and Add to Exam work
   - Results main queue shows unpublished only; published row appears under Exam Date Month → DT/WT/MT/GT → Exam; partial-publication behavior is correct
   - Performance shows Student → Subject → Unit → Chapter → Topic; E1/E2/E3 opens exact-scope detail dialog
6. Re-check an existing published exam/result to prove score/publication data did not change.
7. If a live blocker appears, revert frontend merge or redeploy prior Edge version; never rewrite production result/attempt data as rollback.

---

## Final Acceptance Checklist

- [ ] Password generation/validation is exactly six digits on client and server.
- [ ] Wizard outer modal does not resize between all six desktop steps.
- [ ] Question Bank initial page sends no full question list to browser.
- [ ] Question Bank path is Subject → Chapter → Topic → Questions with Unit mapping retained underneath.
- [ ] Topic question view shows Added Date/Time, all six approved sorts, and incremental Load More.
- [ ] Add to Exam retains immutable snapshot semantics.
- [ ] Results Pending contains only unpublished rows.
- [ ] Published Results drills Month → DT/WT/MT/GT → Exam → Student rows based on Exam Date, with all four type folders present per month.
- [ ] `admin-results.html?attempt=` opens the existing full question-wise result detail for Performance dialog deep links.
- [ ] Performance main view is compact syllabus hierarchy with E chips, not old large metrics/table layout.
- [ ] E dialog uses exact scope performance counts/marks/percentage and exact matching attempt status/number.
- [ ] Exact-scope E numbering remains unchanged.
- [ ] Full root regression, root JS syntax, changed Edge parses, Examination Intelligence, and Academy Communications are green on exact PR head.
- [ ] No production deploy or merge occurs without explicit user approval.
