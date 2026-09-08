# Examinations Phase 1 — Domain Foundation & Admin Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the final Examination-domain primitives and replace the current raw Admin Exams list/month-folder enhancement with the approved operator-focused Exam Control Center, while preserving all existing create, scope, publish, audience, re-exam/reset, student-attempt, result, performance, and communications behavior until later phases migrate those flows.

**Architecture:** Add a v2 master exam policy alongside the deployed legacy intelligence policy, prepare the database additively for final DT/WT/MT/GT identity and lifecycle fields, derive lifecycle/readiness on the server, expose one authenticated `control_center` action from the existing `admin-exams` Edge Function, and render the Control Center from that server response. Do not activate the new exam-create contract in this phase; Phase 2 will switch creation to the six-step wizard and the v2 code allocator. This phase is a testable checkpoint on the master feature branch and must not be deployed by itself.

**Tech Stack:** Static HTML/CSS/vanilla JS, Node 22 built-in test runner, Supabase Postgres, Supabase Auth, Supabase Edge Functions (Deno/TypeScript), existing SGA Examination Branch shell and jsPDF blueprint integration, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-examinations-master-architecture-design.md`

## Global Constraints

- Before implementation, invoke `superpowers:using-git-worktrees` and create an isolated master feature branch/worktree from the latest `main` plus the approved spec/plan docs.
- Use TDD for every behavior change: failing test first, verify RED for the expected reason, implement the smallest change, verify GREEN, then refactor.
- No direct production edits and no deployment after Phase 1. The final Examinations redesign is merged/deployed only after all approved phases are complete and end-to-end verified.
- Do not rebuild the existing Examination Branch from scratch. Extend existing files and preserve working behavior not explicitly superseded by the master spec.
- Do not touch Morning Study Plan behavior, PR #24 communication behavior, Student NEET Syllabus behavior from PR #25, or personal Gmail.
- Phase 1 does not alter student attempt timing, grading, result publication, result emails, performance calculations, question-bank import, or answer review.
- Final official exam types are `daily`, `weekly`, `monthly`, `grand`, displayed as DT / WT / MT / GT.
- Historical `unit` rows must remain readable. `unit` is legacy-compatible data only and must not be treated as a final official type for new exams.
- Final exam-code format is exactly `SGA-{TYPE}-{BATCH2}{DDMM}`. Examples: `SGA-DT-010809`, `SGA-WT-010809`, `SGA-MT-010809`, `SGA-GT-010809`.
- Batch is Academy batch number, not exam sequence. Valid new batch range is 1–99. Do not add a year or sequence to the final code.
- Do not invent fixed WT/MT/GT question-count, duration, or marks templates. The master design does not lock those values; Phase 2 Wizard will capture/derive them from approved exam setup. Existing legacy template behavior remains untouched until Phase 2.
- Daily Test final timing is flexible start with a personal non-pausable server timer. Do not introduce fixed common start time, latest-start time, or automatic exam-end cutoff in Phase 1.
- Final result release modes are `manual` and `scheduled`; do not reintroduce the earlier immediate AUTO-per-submission model.
- Lifecycle is derived, not a free-form Admin status dropdown.
- `Asia/Kolkata` is the Academy timezone for date/month grouping and dashboard “today” logic.
- Additive migration only: never rewrite historical attempts, responses, results, performance, snapshots, or credentials.
- Do not expose Supabase service-role secrets in browser code.

## Phase Boundary

Phase 1 ends with:

1. final v2 type/code/lifecycle policy available and fully unit-tested;
2. database prepared for batch, result-release, closure, blueprint approval, and archive lifecycle metadata;
3. authenticated server-side Control Center summary available;
4. `admin-exams.html` showing the approved Control Center + lifecycle list;
5. old month-folder overlay retired from the Exams page;
6. existing create/audience/publish/re-exam/reset flows still callable and regression-tested;
7. no production deployment.

The following remain for later plans: Create Exam Wizard, final creation/code switch, flexible student countdown engine, manual/scheduled result-release engine, absence finalization, corrections/regrading, versioned PDFs/files, credentials register, full audit/action-required persistence, communications integration, and Manual Exam redesign.

---

### Task 1: Lock Final Master Exam Identity Policy

**Files:**
- Create: `supabase/functions/_shared/exam-master-policy.mjs`
- Create: `exam-master-policy.test.mjs`

**Interfaces:**

```js
MASTER_EXAM_TYPES
normaliseMasterExamType(value)
masterExamTypeLabel(type)
buildMasterExamCode({ type, batch, date })
deriveExamLifecycle(input)
nextExamAction(state)
```

- [ ] **Step 1: Write failing master-policy tests**

Create `exam-master-policy.test.mjs` with these core cases:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MASTER_EXAM_TYPES,
  normaliseMasterExamType,
  buildMasterExamCode,
  deriveExamLifecycle,
  nextExamAction
} from './supabase/functions/_shared/exam-master-policy.mjs'

test('final official types are Daily Weekly Monthly Grand only',()=>{
  assert.deepEqual(Object.keys(MASTER_EXAM_TYPES).sort(),['daily','grand','monthly','weekly'])
  assert.equal(MASTER_EXAM_TYPES.daily.code,'DT')
  assert.equal(MASTER_EXAM_TYPES.weekly.code,'WT')
  assert.equal(MASTER_EXAM_TYPES.monthly.code,'MT')
  assert.equal(MASTER_EXAM_TYPES.grand.code,'GT')
  assert.equal(normaliseMasterExamType('unit'),null)
})

test('master code uses type batch and DDMM only',()=>{
  assert.equal(buildMasterExamCode({type:'daily',batch:1,date:'2026-09-08'}),'SGA-DT-010809')
  assert.equal(buildMasterExamCode({type:'weekly',batch:2,date:'2027-05-02'}),'SGA-WT-020205')
  assert.equal(buildMasterExamCode({type:'monthly',batch:12,date:'2026-12-31'}),'SGA-MT-123112')
  assert.equal(buildMasterExamCode({type:'grand',batch:99,date:'2026-01-01'}),'SGA-GT-990101')
})

test('master code rejects unsupported type bad batch and non ISO date',()=>{
  assert.throws(()=>buildMasterExamCode({type:'unit',batch:1,date:'2026-09-08'}),/type/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:0,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:100,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:1,date:'08-09-2026'}),/date/i)
})

test('lifecycle has no clock based fixed-start transition',()=>{
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:0,newStartsClosedAt:null,resultPublished:false}).state,'available')
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:1,newStartsClosedAt:null,resultPublished:false}).state,'live')
})

test('archive and result publication win lifecycle precedence',()=>{
  assert.equal(deriveExamLifecycle({archivedAt:'2026-09-08T18:00:00Z',isPublished:true,resultPublished:true}).state,'archived')
  assert.equal(deriveExamLifecycle({isPublished:true,resultPublished:true}).state,'result_published')
})

test('unpublished readiness derives Draft or Ready',()=>{
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:false}).state,'draft')
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:true}).state,'ready')
})

test('closed exam becomes Results Ready only when grading is ready',()=>{
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:'2026-09-08T17:00:00Z',activeCount:0,readyResultCount:0,resultPublished:false}).state,'conducted')
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:'2026-09-08T17:00:00Z',activeCount:0,readyResultCount:2,resultPublished:false}).state,'results_ready')
})

test('next action is deterministic from lifecycle',()=>{
  assert.equal(nextExamAction('draft'),'Continue Setup')
  assert.equal(nextExamAction('ready'),'Publish Exam')
  assert.equal(nextExamAction('available'),'Monitor Exam')
  assert.equal(nextExamAction('live'),'Monitor Exam')
  assert.equal(nextExamAction('conducted'),'Review Results')
  assert.equal(nextExamAction('results_ready'),'Publish Results')
  assert.equal(nextExamAction('result_published'),'View Performance')
  assert.equal(nextExamAction('archived'),'View Exam')
})
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test exam-master-policy.test.mjs
```

Expected: FAIL because `exam-master-policy.mjs` does not exist.

- [ ] **Step 3: Implement the smallest pure policy**

Use this data shape; do not add question-count templates:

```js
export const MASTER_EXAM_TYPES=Object.freeze({
  daily:Object.freeze({code:'DT',label:'Daily Test'}),
  weekly:Object.freeze({code:'WT',label:'Weekly Test'}),
  monthly:Object.freeze({code:'MT',label:'Monthly Test'}),
  grand:Object.freeze({code:'GT',label:'Grand Test'})
})
```

`buildMasterExamCode` must parse an exact `YYYY-MM-DD` string, validate the calendar date, zero-pad batch to two digits, and return `SGA-${code}-${batch2}${DD}${MM}`.

Lifecycle precedence must be exactly:

1. `archivedAt` → `archived`
2. `resultPublished` → `result_published`
3. `!isPublished` → `ready` only when `setupReady === true`, otherwise `draft`
4. `activeCount > 0` → `live`
5. `newStartsClosedAt` or `legacyCompleted === true` → `results_ready` when `readyResultCount > 0`, else `conducted`
6. otherwise → `available`

No current-time/start-time branch is allowed.

- [ ] **Step 4: Run GREEN**

```bash
node --test exam-master-policy.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run legacy policy regression**

```bash
node --test exam-intelligence-policy.test.mjs exam-publish-validation.test.mjs admin-publish-template-contract.test.mjs
```

Expected: PASS unchanged. The v2 master policy is additive in Phase 1.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/exam-master-policy.mjs exam-master-policy.test.mjs
git commit -m "test: lock master exam identity and lifecycle policy"
```

---

### Task 2: Prepare Additive Master Lifecycle Schema

**Files:**
- Create: `EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql`
- Create: `examinations-master-foundation-schema.test.mjs`

**Schema contract:**

Add to `public.exams`:

- `batch_no smallint` — nullable for historical compatibility; final new create path will require 1–99.
- `result_publish_mode text not null default 'manual'`
- `result_publish_at timestamptz`
- `new_starts_closed_at timestamptz`
- `blueprint_approved_at timestamptz`
- `archived_at timestamptz`

Add server-only deterministic allocator:

```sql
public.allocate_exam_code_v2(p_exam_type text, p_batch_no integer, p_exam_date date)
```

It returns the final no-year/no-sequence code and rejects collisions already present in `public.exam_access`.

- [ ] **Step 1: Write failing schema contract**

Create assertions that the migration:

- adds all six lifecycle columns with `IF NOT EXISTS`;
- drops/replaces the old `exams_intelligence_type_check` so `weekly` and `grand` can exist later;
- allows historical `unit` rows at DB level but does not make `unit` a final application type;
- drops/replaces the old metadata check that hard-codes Unit/Monthly templates;
- enforces `result_publish_mode in ('manual','scheduled')`;
- enforces batch null-or-1..99;
- creates `allocate_exam_code_v2(text,integer,date)`;
- maps daily/weekly/monthly/grand to DT/WT/MT/GT;
- formats batch with `lpad(...,2,'0')` and date with `DDMM`;
- checks `exam_access` for code collision;
- revokes function access from public/anon/authenticated and grants execution to service role.

Example test core:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql=fs.readFileSync('EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql','utf8').toLowerCase()

test('master lifecycle fields are additive',()=>{
  for(const column of ['batch_no','result_publish_mode','result_publish_at','new_starts_closed_at','blueprint_approved_at','archived_at']){
    assert.match(sql,new RegExp(`add column if not exists ${column}`))
  }
})

test('master allocator uses final academy code format',()=>{
  assert.match(sql,/allocate_exam_code_v2/)
  assert.match(sql,/when 'daily' then 'dt'/)
  assert.match(sql,/when 'weekly' then 'wt'/)
  assert.match(sql,/when 'monthly' then 'mt'/)
  assert.match(sql,/when 'grand' then 'gt'/)
  assert.match(sql,/to_char\(p_exam_date,'ddmm'\)/)
  assert.match(sql,/lpad\(p_batch_no::text,2,'0'\)/)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test examinations-master-foundation-schema.test.mjs
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Write the migration**

Use this structural order:

```sql
begin;

alter table public.exams
  add column if not exists batch_no smallint,
  add column if not exists result_publish_mode text not null default 'manual',
  add column if not exists result_publish_at timestamp with time zone,
  add column if not exists new_starts_closed_at timestamp with time zone,
  add column if not exists blueprint_approved_at timestamp with time zone,
  add column if not exists archived_at timestamp with time zone;

alter table public.exams drop constraint if exists exams_intelligence_type_check;
alter table public.exams drop constraint if exists exams_intelligence_metadata_check;

alter table public.exams
  add constraint exams_master_type_compat_check
    check (exam_type is null or exam_type in ('daily','weekly','monthly','grand','unit')),
  add constraint exams_master_batch_check
    check (batch_no is null or batch_no between 1 and 99),
  add constraint exams_master_result_mode_check
    check (result_publish_mode in ('manual','scheduled')),
  add constraint exams_master_positive_metadata_check
    check (
      (expected_questions is null or expected_questions > 0)
      and duration_minutes > 0
      and total_marks > 0
    );
```

`unit` exists here only so historical rows remain valid. The final server create path in Phase 2 must reject it.

Allocator logic:

```sql
create or replace function public.allocate_exam_code_v2(
  p_exam_type text,
  p_batch_no integer,
  p_exam_date date
)
returns text
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_type text := lower(btrim(coalesce(p_exam_type,'')));
  v_prefix text;
  v_code text;
begin
  if p_exam_date is null then raise exception 'Exam date is required'; end if;
  if p_batch_no is null or p_batch_no < 1 or p_batch_no > 99 then raise exception 'Batch must be 1 to 99'; end if;
  v_prefix := case v_type
    when 'daily' then 'DT'
    when 'weekly' then 'WT'
    when 'monthly' then 'MT'
    when 'grand' then 'GT'
    else null
  end;
  if v_prefix is null then raise exception 'Invalid exam type'; end if;
  v_code := 'SGA-' || v_prefix || '-' || lpad(p_batch_no::text,2,'0') || to_char(p_exam_date,'DDMM');
  if exists(select 1 from public.exam_access where exam_code=v_code) then
    raise exception 'Exam code already exists: %',v_code;
  end if;
  return v_code;
end;
$$;

revoke all on function public.allocate_exam_code_v2(text,integer,date) from public, anon, authenticated;
grant execute on function public.allocate_exam_code_v2(text,integer,date) to service_role;

commit;
```

Do not delete `exam_code_counters` or old `allocate_exam_code`; Phase 2 switches callers after its tests are green.

- [ ] **Step 4: Run GREEN and old-schema regressions**

```bash
node --test examinations-master-foundation-schema.test.mjs exam-intelligence-schema.test.mjs admin-publish-template-contract.test.mjs
```

Expected: PASS. Historical migration files remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql examinations-master-foundation-schema.test.mjs
git commit -m "feat: prepare master exam lifecycle schema"
```

---

### Task 3: Build Pure Control Center Summary Policy

**Files:**
- Create: `supabase/functions/admin-exams/control-center-policy.mjs`
- Create: `exam-control-center-policy.test.mjs`

**Interfaces:**

```js
buildExamControlItem(input)
buildControlCenterSummary(items,{today})
```

Server policy returns an item shaped as:

```js
{
  id,
  title,
  examType,
  examTypeLabel,
  batchNo,
  examDate,
  examCode,
  durationMinutes,
  totalMarks,
  lifecycle,
  nextAction,
  assignedCount,
  activeCount,
  submittedCount,
  readyResultCount,
  publishedResultCount,
  questionCount,
  expectedQuestions,
  mappedQuestions,
  keyedQuestions,
  blueprintApproved,
  resultPublishMode,
  resultPublishAt,
  actionRequired: []
}
```

- [ ] **Step 1: Write failing policy tests**

Cover:

- Draft when question/mapping/key/blueprint/audience readiness is incomplete.
- Ready when unpublished and all setup gates are green.
- Available when published and no one is currently active.
- Live when one or more active attempts exist.
- Conducted/Results Ready only after `newStartsClosedAt` or historical completed compatibility.
- Result Published when exam-level result publication flag is true.
- Archived precedence.
- Action Required issues are deterministic and deduplicated.
- Today count uses exact Academy date string; no browser local-time guess.
- Results Pending counts `conducted` + `results_ready`, not `available` exams merely because one student already submitted.

Use issue objects:

```js
{code:'QUESTIONS_INCOMPLETE',severity:'high',label:'Questions incomplete',action:'Add Questions',target:'QUESTIONS'}
{code:'MAPPING_INCOMPLETE',severity:'high',label:'Mapping incomplete',action:'Review Mapping',target:'QUESTIONS'}
{code:'ANSWER_KEYS_INCOMPLETE',severity:'high',label:'Answer keys incomplete',action:'Review Questions',target:'QUESTIONS'}
{code:'BLUEPRINT_PENDING',severity:'medium',label:'Blueprint approval pending',action:'Review Blueprint',target:'BLUEPRINT'}
{code:'STUDENTS_MISSING',severity:'medium',label:'No students assigned',action:'Manage Students',target:'STUDENTS'}
```

- [ ] **Step 2: Run RED**

```bash
node --test exam-control-center-policy.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure mapping only**

Import lifecycle/type helpers from `../_shared/exam-master-policy.mjs`. Do not call Supabase in this module. Normalize numbers and arrays defensively.

For `setupReady`, require:

```text
questionCount > 0
expectedQuestions is null OR questionCount == expectedQuestions
mappedQuestions == questionCount
keyedQuestions == questionCount
blueprintApproved == true
assignedCount > 0
```

For historical official rows where `blueprint_approved_at` is null, do not retroactively mark published exams as Draft; lifecycle precedence already keeps published exams Available/Live/Conducted/Published. Blueprint readiness matters only to unpublished setup state.

- [ ] **Step 4: Run GREEN**

```bash
node --test exam-control-center-policy.test.mjs exam-master-policy.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/control-center-policy.mjs exam-control-center-policy.test.mjs
git commit -m "feat: derive exam control center lifecycle summaries"
```

---

### Task 4: Add Authenticated `control_center` Edge Action

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Create: `admin-exam-control-center-contract.test.mjs`

**Contract:**

Request:

```json
{"action":"control_center"}
```

Response:

```js
{
  ok:true,
  today:'YYYY-MM-DD',
  summary:{today:0,upcomingAvailable:0,liveNow:0,resultsPending:0,actionRequired:0},
  exams:[/* buildExamControlItem output */]
}
```

- [ ] **Step 1: Write failing source contract**

Assert `admin-exams/index.ts`:

- imports `buildExamControlItem` and `buildControlCenterSummary`;
- recognizes `action==='control_center'` only after active Admin auth succeeds;
- selects master lifecycle fields from `exams`;
- reads `exam_access.exam_code` without exposing password hash;
- loads assignment, attempt and result counts;
- uses existing mapping validation/readiness data instead of duplicating question correctness rules;
- returns no answer text, selected answers, correct answer keys, passwords, or service secrets.

Also assert the response contains `summary` and `exams`.

- [ ] **Step 2: Run RED**

```bash
node --test admin-exam-control-center-contract.test.mjs
```

Expected: FAIL because action/imports are absent.

- [ ] **Step 3: Implement authenticated read path**

Use the existing Admin auth guard at the top of `admin-exams/index.ts`. Do not add a second unauthenticated endpoint.

Query exams once, then bulk-query lightweight relationships:

```text
exam_assignments: exam_id, student_id
exam_attempts: id, exam_id, status, submitted_at
exam_results: attempt_id, is_published
```

Use existing publish/mapping validation helpers for per-exam question/mapping/key counts. Because Academy volume is currently small, correctness is preferred over premature query optimization; if per-exam validation is used, execute through a bounded `Promise.all` and preserve exact error handling. Do not fetch question text/options/answers for the dashboard.

Map attempts:

- active = status `in_progress`
- submitted = status `submitted` with submitted timestamp
- technical-invalid attempts must be excluded when the current schema has an explicit marker; until Phase 3 adds the final technical state, preserve current attempt semantics and do not invent a new value.

Map results:

- ready result = graded result with `is_published=false`
- published result = `is_published=true`
- exam-level `result_published` remains authoritative for lifecycle compatibility until Phase 4 replaces release semantics.

Get `today` in `Asia/Kolkata` server-side with `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'})` and compose `YYYY-MM-DD` from parts. Do not use UTC `toISOString().slice(0,10)`.

- [ ] **Step 4: Run GREEN + Edge parse**

```bash
node --test admin-exam-control-center-contract.test.mjs exam-control-center-policy.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exams/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exams.js --external:*
```

Expected: PASS and parse succeeds.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/index.ts admin-exam-control-center-contract.test.mjs
git commit -m "feat: expose admin exam control center data"
```

---

### Task 5: Replace Raw Exams List with Exam Control Center UI

**Files:**
- Create: `exam-control-center-ui.js`
- Create: `exam-control-center-ui.test.cjs`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`
- Modify: `admin-examinations-nav.js`
- Modify: `exam-scope-month-folders.test.mjs`
- Create: `admin-exam-control-center-ui.test.mjs`
- Keep but stop loading: `admin-exams-enhancements.js`

**Browser utility pattern:** follow `exam-scope-ui-utils.js` UMD style so Node tests and browser code use the same pure functions.

Export:

```js
filterControlCenterExams(exams,{tab,query,type,batch,month})
groupConductedByMonth(exams)
priorityExam(exams)
statusLabel(state)
```

- [ ] **Step 1: Write failing pure UI tests**

Cover:

- ALL returns all non-hidden items.
- DRAFT includes `draft` and optionally `ready` only according to explicit selected tab policy; implement separate READY badge, but keep READY in DRAFT tab for navigation simplicity.
- UPCOMING/AVAILABLE includes `available`.
- LIVE includes `live`.
- CONDUCTED includes `conducted`, `results_ready`, `result_published` unless archived.
- ARCHIVED includes only archived.
- Search matches exam name and code case-insensitively.
- Type/batch/month filters combine with search and tab.
- Conducted grouping uses `examDate` month in `Asia/Kolkata`-safe date strings, not first submission timestamp.
- Priority exam chooses: action-required today/live first, then live, then today available, then ready/draft needing setup, then newest relevant item.

- [ ] **Step 2: Run RED**

```bash
node --test exam-control-center-ui.test.cjs
```

Expected: FAIL because utility does not exist.

- [ ] **Step 3: Implement utility and run GREEN**

Use the same UMD wrapper pattern already used by `exam-scope-ui-utils.js`.

- [ ] **Step 4: Write failing page contract**

`admin-exam-control-center-ui.test.mjs` must assert `admin-exams.html` contains these stable hooks:

```text
#examSummaryCards
#todayExamCard
#examLifecycleTabs
#examTypeFilter
#examBatchFilter
#examMonthFilter
#needsAttention
#rows
```

Assert visible summary labels:

```text
TODAY'S EXAMS
UPCOMING / AVAILABLE
LIVE NOW
RESULTS PENDING
ACTION REQUIRED
```

Assert lifecycle tabs:

```text
ALL
DRAFT
UPCOMING / AVAILABLE
LIVE
CONDUCTED
ARCHIVED
```

Assert the full table columns are:

```text
EXAM NAME | TYPE | BATCH | DATE | CODE | QUESTIONS | STUDENTS | STATUS | NEXT ACTION
```

Assert `admin-exams.js` calls `{action:'control_center'}` instead of directly querying the Exams list for the dashboard.

Assert `admin-examinations-nav.js` no longer injects `admin-exams-enhancements.js`.

- [ ] **Step 5: Run RED**

```bash
node --test admin-exam-control-center-ui.test.mjs exam-scope-month-folders.test.mjs
```

Expected: FAIL on missing Control Center hooks and old enhancement expectations.

- [ ] **Step 6: Implement Control Center markup**

Keep the existing Create Exam, Audience, and Re-Exam/Reset modals intact in Phase 1. Replace only the top/list area inside the Exams content section.

Layout order:

```text
Examination Branch navigation
Control Center summary cards
Today's / priority exam card
Needs Attention strip
Toolbar: search + type + batch + month + Create Exam
Lifecycle tabs
View All Exams table
```

Do not duplicate the five top-level Examination Branch tabs already provided by `admin-examinations-nav.js`.

- [ ] **Step 7: Implement rendering in `admin-exams.js`**

Change `load()` to:

```js
const d=await call({action:'control_center'})
exams=Array.isArray(d.exams)?d.exams:[]
controlSummary=d.summary||{}
renderControlCenter()
```

Preserve existing functions for:

- create/edit modal;
- scope loading;
- audience assignment/publish;
- re-exam/reset;
- delete handler;
- questions navigation.

Rows must retain `data-id` on a visible action button so existing `admin-exam-blueprint.js` can continue adding Blueprint controls until the workspace/files redesign replaces that integration later.

Status is rendered from server `lifecycle`, never from a free-form dropdown.

Use primary next action from server and map navigation:

- Continue Setup → current exam edit/setup
- Publish Exam → existing audience/publish flow
- Monitor Exam → existing maintenance/live path for now; Phase 3 creates full LIVE workspace
- Review Results / Publish Results → `admin-results.html` with exam query parameter
- View Performance → `admin-performance.html` with exam query parameter
- View Exam → non-destructive read path

- [ ] **Step 8: Retire month-folder overlay**

Remove only the dynamic load block for `admin-exams-enhancements.js` from `admin-examinations-nav.js`. Keep jsPDF/AutoTable/Blueprint script loading unchanged.

Update `exam-scope-month-folders.test.mjs` so it no longer requires the enhancement script or first-submission month grouping. Preserve its V2 scope helper assertions. Add an assertion that the Control Center owns lifecycle tabs/month filters.

Do not delete `admin-exams-enhancements.js` in this phase; leaving the unused file avoids unrelated cleanup risk. It can be removed in the final cleanup phase after full regression.

- [ ] **Step 9: Run GREEN**

```bash
node --test exam-control-center-ui.test.cjs admin-exam-control-center-ui.test.mjs exam-scope-month-folders.test.mjs examination-branch-shell.test.mjs
node --check admin-exams.js
node --check admin-examinations-nav.js
node --check exam-control-center-ui.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add exam-control-center-ui.js exam-control-center-ui.test.cjs admin-exam-control-center-ui.test.mjs admin-exams.html admin-exams.js admin-examinations-nav.js exam-scope-month-folders.test.mjs
git commit -m "feat: build admin exam control center"
```

---

### Task 6: Make Examination CI Run on the Master Feature PR

**Files:**
- Modify: `.github/workflows/examination-intelligence.yml`
- Create: `examination-master-ci-contract.test.mjs`

- [ ] **Step 1: Write failing CI contract**

Assert the workflow runs on pull requests targeting `main` and still supports manual dispatch. Assert the root regression command remains present.

Desired trigger:

```yaml
on:
  pull_request:
    branches:
      - main
  workflow_dispatch:
```

Do not rely only on the obsolete push trigger for `feature/examination-intelligence-foundation`.

- [ ] **Step 2: Run RED**

```bash
node --test examination-master-ci-contract.test.mjs
```

Expected: FAIL because current workflow only pushes on the older feature branch.

- [ ] **Step 3: Update workflow**

Preserve:

- Node 22 setup;
- selected Examination contract tests;
- `node --test *.test.js *.test.mjs *.test.cjs` full root regression;
- root JS syntax checks;
- Edge Function esbuild parse checks.

Add the new Phase 1 tests to the selected Examination contract command for fast failure visibility:

```text
exam-master-policy.test.mjs
examinations-master-foundation-schema.test.mjs
exam-control-center-policy.test.mjs
admin-exam-control-center-contract.test.mjs
exam-control-center-ui.test.cjs
admin-exam-control-center-ui.test.mjs
```

- [ ] **Step 4: Run GREEN**

```bash
node --test examination-master-ci-contract.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/examination-intelligence.yml examination-master-ci-contract.test.mjs
git commit -m "ci: verify examinations master feature pull requests"
```

---

### Task 7: Phase 1 Full Verification Checkpoint

**Files:** no implementation files should be added in this task unless verification exposes a real regression; any fix must begin with a reproducing failing test.

- [ ] **Step 1: Run the complete root regression suite**

```bash
node --test *.test.js *.test.mjs *.test.cjs
```

Expected: all tests PASS.

- [ ] **Step 2: Check all root browser JavaScript syntax**

```bash
find . -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: no syntax failures.

- [ ] **Step 3: Parse all Examination Edge Functions touched by the master program**

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-exams/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exams.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-exam-access/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-exam-access.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-exam-attempt/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-exam-attempt.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-result-review/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-result-review.js --external:*
npx -y esbuild@0.25.9 supabase/functions/exam-performance/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/exam-performance.js --external:*
```

Expected: all parse successfully.

- [ ] **Step 4: Verify Phase 1 diff scope**

Run:

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Confirm no modifications to:

```text
supabase/functions/student-exam-attempt/*
supabase/functions/academy-communications/*
supabase/functions/academy-morning-cron/*
student-results.js
student-performance.js
student-syllabus*
```

except pre-existing docs included by branch ancestry.

- [ ] **Step 5: Verify no old behavior was accidentally declared final**

Search the Phase 1 new code/docs:

```bash
grep -R "SGA-DLY\|SGA-UNT\|SGA-MON" supabase/functions/_shared/exam-master-policy.mjs exam-control-center-ui.js admin-exams.html admin-exams.js || true
grep -R "latest start\|fixed start" supabase/functions/_shared/exam-master-policy.mjs supabase/functions/admin-exams/control-center-policy.mjs admin-exams.js || true
```

Expected: no final master-code or fixed-start logic using those legacy patterns.

- [ ] **Step 6: Do not deploy the migration yet**

The SQL is reviewed/tested source at this checkpoint. Apply it only in the coordinated implementation sequence when Phase 2 is ready to switch creation/publish contracts, so production never enters a partially migrated operator state.

- [ ] **Step 7: Request code review**

Invoke `superpowers:requesting-code-review` against the Phase 1 checkpoint. Fix any accepted issue tests-first.

- [ ] **Step 8: Verification-before-completion**

Invoke `superpowers:verification-before-completion`, rerun the exact full regression/syntax/parse commands, and record actual outputs before claiming Phase 1 complete.

---

## Phase 1 Acceptance Criteria

Phase 1 is complete only when all of the following are true:

- `exam-master-policy.mjs` defines only Daily/Weekly/Monthly/Grand as final official types.
- Final code builder returns `SGA-{DT|WT|MT|GT}-{BATCH2}{DDMM}` and rejects legacy Unit as a new type.
- Master schema migration is additive and historical rows remain valid.
- No fixed common start or latest-start logic exists.
- Lifecycle states are derived server-side from readiness/publication/attempt/release/archive facts.
- Admin Control Center shows the five approved summary cards, priority exam, Needs Attention, lifecycle tabs, filters, and full exam table.
- Conducted grouping is lifecycle-based/month-filtered rather than “first submission means conducted.”
- Existing create/scope/audience/publish/re-exam/reset behavior remains available at this checkpoint.
- Student attempt/result/performance/communications code is untouched by Phase 1.
- Full root regression suite passes.
- Edge Function TypeScript parses successfully.
- GitHub PR CI covers the master feature branch through `pull_request` to `main`.
- No migration, Edge Function, static site, or production database change is deployed from Phase 1 alone.

## Next Plan After This Checkpoint

`Phase 2 — Create Exam Wizard + Final Exam Creation/Code Switch + Coverage + Questions + Blueprint + Audience/Publish`

Phase 2 will replace the current create modal with the approved six-step wizard, switch server creation from the old `allocate_exam_code`/legacy template policy to `allocate_exam_code_v2`/master policy, replace the old publish-template guard with flexible setup validation, and introduce the complete Exam Workspace setup tabs without changing the student countdown engine yet.
