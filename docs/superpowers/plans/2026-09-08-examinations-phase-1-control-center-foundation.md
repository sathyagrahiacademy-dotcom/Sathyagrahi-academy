# Examinations Phase 1 — Domain Foundation & Admin Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the final Exam-domain identity/lifecycle primitives and replace the current raw Admin Exams list/month-folder overlay with the approved operator-focused Exam Control Center, without changing student attempts, grading, result release, performance, or Academy communications yet.

**Architecture:** Introduce a v2 master exam policy beside the deployed legacy policy, prepare the database additively for final batch/result-release/lifecycle metadata, derive lifecycle/readiness on the server, expose a single authenticated `control_center` action from the existing `admin-exams` Edge Function, and render the Control Center from that response. Keep existing create/scope/publish/audience/re-exam/reset behavior usable on this checkpoint; Phase 2 switches creation to the final six-step wizard and v2 code allocator.

**Tech Stack:** Static HTML/CSS/vanilla JS, Node 22 built-in test runner, Supabase Postgres/Auth/Edge Functions, existing SGA Examination Branch shell and jsPDF integration, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-examinations-master-architecture-design.md`

## Global Constraints

- Before Task 1, invoke `superpowers:using-git-worktrees`; implement on one isolated master feature branch/worktree based on latest `main` plus approved spec/plan docs.
- TDD for every behavior change: failing test → verify RED → minimal implementation → verify GREEN → refactor.
- Phase 1 is a checkpoint, **not a production deployment**. No migration, Edge Function, static site, or DB change is deployed until the coordinated master implementation reaches its approved release checkpoint.
- Extend the existing Examination Branch; do not rebuild it from scratch.
- Do not touch Morning Study Plan/07:00 mail behavior, Academy communications, Student NEET Syllabus, student attempts, grading, results, performance, or answer review in this phase.
- Final official types are `daily`, `weekly`, `monthly`, `grand` displayed as DT / WT / MT / GT. Historical `unit` rows remain readable only for compatibility.
- Final code format is exactly `SGA-{TYPE}-{BATCH2}{DDMM}`. No year and no sequence. Batch is Academy Batch Number; valid new range is 1–99.
- Do not invent fixed WT/MT/GT questions/duration/marks. Those values are not locked by the master spec; Phase 2 handles final setup semantics.
- Daily Test timing is flexible-start with a personal non-pausable server-authoritative countdown. Do not add a common fixed start or latest-start rule.
- Final result release modes are `manual` and `scheduled`; do not reintroduce immediate AUTO-per-student result publication.
- Lifecycle is derived from facts; no arbitrary Admin status dropdown.
- Use `Asia/Kolkata` for dashboard “today” and month grouping.
- Historical attempts/responses/results/performance/snapshots/credentials must never be rewritten by this phase.
- Service-role credentials never enter browser code.

---

### Task 1: Lock the Final Master Exam Policy

**Files:**
- Create: `supabase/functions/_shared/exam-master-policy.mjs`
- Create: `exam-master-policy.test.mjs`

**Interfaces:**

```js
MASTER_EXAM_TYPES
normaliseMasterExamType(value)
masterExamTypeLabel(type)
buildMasterExamCode({type,batch,date})
deriveExamLifecycle(input)
nextExamAction(state)
```

- [ ] **Step 1: Write failing tests**

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

test('code is SGA type batch DDMM with no year or sequence',()=>{
  assert.equal(buildMasterExamCode({type:'daily',batch:1,date:'2026-09-08'}),'SGA-DT-010809')
  assert.equal(buildMasterExamCode({type:'weekly',batch:2,date:'2027-05-02'}),'SGA-WT-020205')
  assert.equal(buildMasterExamCode({type:'monthly',batch:12,date:'2026-12-31'}),'SGA-MT-123112')
  assert.equal(buildMasterExamCode({type:'grand',batch:99,date:'2026-01-01'}),'SGA-GT-990101')
})

test('invalid type batch and date are rejected',()=>{
  assert.throws(()=>buildMasterExamCode({type:'unit',batch:1,date:'2026-09-08'}),/type/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:0,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:100,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:1,date:'08-09-2026'}),/date/i)
})

test('published exam is Available until a student is actively attempting',()=>{
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:0,newStartsClosedAt:null,resultPublished:false}).state,'available')
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:1,newStartsClosedAt:null,resultPublished:false}).state,'live')
})

test('unpublished setup is Draft or Ready',()=>{
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:false}).state,'draft')
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:true}).state,'ready')
})

test('closed exam becomes Conducted then Results Ready',()=>{
  const closed='2026-09-08T17:00:00Z'
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:closed,activeCount:0,readyResultCount:0,resultPublished:false}).state,'conducted')
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:closed,activeCount:0,readyResultCount:2,resultPublished:false}).state,'results_ready')
})

test('archive and published result have explicit precedence',()=>{
  assert.equal(deriveExamLifecycle({archivedAt:'2026-09-08T18:00:00Z',isPublished:true,resultPublished:true}).state,'archived')
  assert.equal(deriveExamLifecycle({isPublished:true,resultPublished:true}).state,'result_published')
})

test('next action is deterministic',()=>{
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

```bash
node --test exam-master-policy.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal pure policy**

```js
export const MASTER_EXAM_TYPES=Object.freeze({
  daily:Object.freeze({code:'DT',label:'Daily Test'}),
  weekly:Object.freeze({code:'WT',label:'Weekly Test'}),
  monthly:Object.freeze({code:'MT',label:'Monthly Test'}),
  grand:Object.freeze({code:'GT',label:'Grand Test'})
})
```

`buildMasterExamCode` validates an exact calendar-valid `YYYY-MM-DD`, integer batch 1–99, and returns `SGA-${code}-${batch2}${DD}${MM}`.

Lifecycle precedence is exactly:

1. `archivedAt` → `archived`
2. `resultPublished` → `result_published`
3. not published → `ready` when `setupReady===true`, otherwise `draft`
4. `activeCount>0` → `live`
5. `newStartsClosedAt` or `legacyCompleted===true` → `results_ready` when `readyResultCount>0`, otherwise `conducted`
6. otherwise → `available`

There is no current-clock/start-time branch.

- [ ] **Step 4: Run GREEN + legacy regression**

```bash
node --test exam-master-policy.test.mjs exam-intelligence-policy.test.mjs exam-publish-validation.test.mjs admin-publish-template-contract.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/exam-master-policy.mjs exam-master-policy.test.mjs
git commit -m "feat: lock master exam identity and lifecycle policy"
```

---

### Task 2: Prepare Additive Master Lifecycle Schema

**Files:**
- Create: `EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql`
- Create: `examinations-master-foundation-schema.test.mjs`

**New `public.exams` metadata:**

```text
batch_no smallint nullable for legacy
result_publish_mode text not null default 'manual'
result_publish_at timestamptz nullable
new_starts_closed_at timestamptz nullable
blueprint_approved_at timestamptz nullable
archived_at timestamptz nullable
```

**New server-only allocator:**

```sql
public.allocate_exam_code_v2(p_exam_type text,p_batch_no integer,p_exam_date date)
```

- [ ] **Step 1: Write failing SQL contract test**

Assert the migration:

- uses `ADD COLUMN IF NOT EXISTS` for all six fields;
- replaces `exams_intelligence_type_check` so future `weekly`/`grand` rows are possible while existing `unit` rows remain DB-compatible;
- replaces the old hard-coded metadata check with generic positive metadata validation;
- checks `batch_no is null or batch_no between 1 and 99`;
- checks `result_publish_mode in ('manual','scheduled')`;
- creates `allocate_exam_code_v2(text,integer,date)`;
- maps daily/weekly/monthly/grand → DT/WT/MT/GT;
- uses `lpad(p_batch_no::text,2,'0')` and `to_char(p_exam_date,'DDMM')`;
- rejects a collision already present in `exam_access.exam_code`;
- revokes execution from public/anon/authenticated and grants `service_role`.

- [ ] **Step 2: Run RED**

```bash
node --test examinations-master-foundation-schema.test.mjs
```

- [ ] **Step 3: Implement migration**

Core shape:

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
    check ((expected_questions is null or expected_questions>0) and duration_minutes>0 and total_marks>0);
```

Allocator core:

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
  if p_batch_no is null or p_batch_no<1 or p_batch_no>99 then raise exception 'Batch must be 1 to 99'; end if;
  v_prefix := case v_type
    when 'daily' then 'DT'
    when 'weekly' then 'WT'
    when 'monthly' then 'MT'
    when 'grand' then 'GT'
    else null
  end;
  if v_prefix is null then raise exception 'Invalid exam type'; end if;
  v_code := 'SGA-'||v_prefix||'-'||lpad(p_batch_no::text,2,'0')||to_char(p_exam_date,'DDMM');
  if exists(select 1 from public.exam_access where exam_code=v_code) then
    raise exception 'Exam code already exists: %',v_code;
  end if;
  return v_code;
end;
$$;

revoke all on function public.allocate_exam_code_v2(text,integer,date) from public,anon,authenticated;
grant execute on function public.allocate_exam_code_v2(text,integer,date) to service_role;

commit;
```

Do not remove legacy `exam_code_counters`/`allocate_exam_code`; Phase 2 switches callers only after its tests are green. `unit` in the DB check is historical compatibility, not a final create option.

- [ ] **Step 4: Run GREEN + old migration contracts**

```bash
node --test examinations-master-foundation-schema.test.mjs exam-intelligence-schema.test.mjs admin-publish-template-contract.test.mjs
```

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

Each item returns identity, lifecycle, readiness counts, assignment/attempt/result counts, result mode and deduplicated issues. Required issue shapes:

```js
{code:'QUESTIONS_INCOMPLETE',severity:'high',label:'Questions incomplete',action:'Add Questions',target:'QUESTIONS'}
{code:'MAPPING_INCOMPLETE',severity:'high',label:'Mapping incomplete',action:'Review Mapping',target:'QUESTIONS'}
{code:'ANSWER_KEYS_INCOMPLETE',severity:'high',label:'Answer keys incomplete',action:'Review Questions',target:'QUESTIONS'}
{code:'BLUEPRINT_PENDING',severity:'medium',label:'Blueprint approval pending',action:'Review Blueprint',target:'BLUEPRINT'}
{code:'STUDENTS_MISSING',severity:'medium',label:'No students assigned',action:'Manage Students',target:'STUDENTS'}
```

- [ ] **Step 1: Write failing policy tests**

Cover Draft, Ready, Available, Live, Conducted, Results Ready, Result Published, Archived; issue deduplication; Today count; Results Pending; and the rule that one submitted attempt alone does **not** make an exam Conducted while new starts remain open.

`setupReady` must require:

```text
questionCount > 0
expectedQuestions is null OR questionCount == expectedQuestions
mappedQuestions == questionCount
keyedQuestions == questionCount
blueprintApproved == true
assignedCount > 0
```

- [ ] **Step 2: Run RED**

```bash
node --test exam-control-center-policy.test.mjs
```

- [ ] **Step 3: Implement pure policy**

Import only pure helpers from `../_shared/exam-master-policy.mjs`. No Supabase calls in this module. Published historical exams with no `blueprint_approved_at` must not be retroactively shown as Draft because lifecycle publication precedence applies before unpublished readiness.

Summary shape:

```js
{
  today,
  upcomingAvailable,
  liveNow,
  resultsPending,
  actionRequired
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test exam-control-center-policy.test.mjs exam-master-policy.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/control-center-policy.mjs exam-control-center-policy.test.mjs
git commit -m "feat: derive exam control center summaries"
```

---

### Task 4: Add Authenticated `control_center` Edge Action

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Create: `admin-exam-control-center-contract.test.mjs`

**Request:**

```json
{"action":"control_center"}
```

**Response:**

```js
{
  ok:true,
  today:'YYYY-MM-DD',
  summary:{today:0,upcomingAvailable:0,liveNow:0,resultsPending:0,actionRequired:0},
  exams:[]
}
```

- [ ] **Step 1: Write failing contract tests**

Assert the action:

- runs only after the existing active-Admin authorization guard;
- imports/uses `buildExamControlItem` + `buildControlCenterSummary`;
- reads master lifecycle fields from `exams`;
- reads `exam_access.exam_code` but never password hashes;
- reads `exam_student_assignments` with `is_assigned=true` for assigned counts;
- reads `exam_attempts` for active/submitted counts;
- reads `exam_results` by mapping `attempt_id` back through loaded attempts;
- reuses current publish/mapping validation for question/mapped/key counts;
- returns no question text/options, selected answers, answer keys, passwords, or secrets.

- [ ] **Step 2: Run RED**

```bash
node --test admin-exam-control-center-contract.test.mjs
```

- [ ] **Step 3: Implement authenticated read path**

Bulk-query lightweight tables where practical:

```text
exam_student_assignments: exam_id, student_id, is_assigned
exam_attempts: id, exam_id, status, submitted_at
exam_results: attempt_id, is_published
```

Use existing `loadPublishValidation`/mapping helpers for exact question, mapping and key readiness rather than cloning academic validation rules. Small Academy volume permits bounded per-exam validation calls; keep them inside a controlled `Promise.all` and propagate real errors.

Attempt semantics in Phase 1:

```text
activeCount = status == 'in_progress'
submittedCount = status == 'submitted' and submitted_at exists
```

Do not invent a new technical-status value before Phase 3.

Until Phase 4 migrates final release semantics, existing exam-level `result_published` is compatibility-authoritative for the `result_published` lifecycle state.

Compute server `today` from `Intl.DateTimeFormat(... timeZone:'Asia/Kolkata' ...)` parts; do not use UTC `toISOString().slice(0,10)`.

- [ ] **Step 4: Run GREEN + Edge parse**

```bash
node --test admin-exam-control-center-contract.test.mjs exam-control-center-policy.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exams/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exams.js --external:*
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-exams/index.ts admin-exam-control-center-contract.test.mjs
git commit -m "feat: expose admin exam control center data"
```

---

### Task 5: Build the Admin Exam Control Center UI

**Files:**
- Create: `exam-control-center-ui.js`
- Create: `exam-control-center-ui.test.cjs`
- Create: `admin-exam-control-center-ui.test.mjs`
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`
- Modify: `admin-examinations-nav.js`
- Modify: `exam-scope-month-folders.test.mjs`
- Keep but stop loading: `admin-exams-enhancements.js`

Follow the existing UMD utility pattern from `exam-scope-ui-utils.js` so one implementation is testable in Node and usable in the browser.

**Pure UI exports:**

```js
filterControlCenterExams(exams,{tab,query,type,batch,month})
groupConductedByMonth(exams)
priorityExam(exams)
statusLabel(state)
```

- [ ] **Step 1: Write failing pure UI tests**

Cover combined search/filter behavior and tabs:

```text
ALL
DRAFT       -> draft + ready
UPCOMING / AVAILABLE -> available
LIVE        -> live
CONDUCTED   -> conducted + results_ready + result_published
ARCHIVED    -> archived only
```

Search matches title/code case-insensitively. Type, batch and month filters combine. Conducted grouping uses `examDate` month, not first submission timestamp. Priority order is: action-required today/live → live → today available → ready/draft needing setup → newest relevant exam.

- [ ] **Step 2: Run RED**

```bash
node --test exam-control-center-ui.test.cjs
```

- [ ] **Step 3: Implement pure utility and run GREEN**

```bash
node --test exam-control-center-ui.test.cjs
```

- [ ] **Step 4: Write failing page contract**

Assert `admin-exams.html` has:

```text
#examSummaryCards
#todayExamCard
#needsAttention
#examLifecycleTabs
#examTypeFilter
#examBatchFilter
#examMonthFilter
#rows
```

Assert summary labels:

```text
TODAY'S EXAMS
UPCOMING / AVAILABLE
LIVE NOW
RESULTS PENDING
ACTION REQUIRED
```

Assert table columns:

```text
EXAM NAME | TYPE | BATCH | DATE | CODE | QUESTIONS | STUDENTS | STATUS | NEXT ACTION
```

Assert `admin-exams.js` loads `{action:'control_center'}` and `admin-examinations-nav.js` no longer injects `admin-exams-enhancements.js`.

- [ ] **Step 5: Run RED**

```bash
node --test admin-exam-control-center-ui.test.mjs exam-scope-month-folders.test.mjs
```

- [ ] **Step 6: Implement markup and rendering**

Control Center order:

```text
Examination Branch navigation
Summary cards
Today's/Priority Exam card
Needs Attention
Search + type + batch + month + Create Exam
Lifecycle tabs
View All Exams table
```

Preserve existing Create Exam, Scope, Audience, Re-Exam/Reset modals in this phase. Change only the dashboard/list surface.

`admin-exams.js` load path becomes:

```js
const d=await call({action:'control_center'})
exams=Array.isArray(d.exams)?d.exams:[]
controlSummary=d.summary||{}
renderControlCenter()
```

Keep current create/edit/scope/audience/publish/re-exam/reset/delete/question-navigation handlers functional. Retain a `data-id` action hook in each row so current `admin-exam-blueprint.js` can still inject its Blueprint button until the final Exam Workspace/Files phase replaces that mechanism.

State-driven action navigation:

```text
Continue Setup -> current setup/edit flow
Publish Exam -> current audience/publish flow
Monitor Exam -> current operational/maintenance path for now
Review Results / Publish Results -> admin-results.html?exam=<id>
View Performance -> admin-performance.html?exam=<id>
View Exam -> read-only/open exam path
```

- [ ] **Step 7: Retire the old conducted-folder overlay**

Remove only the `admin-exams-enhancements.js` dynamic loader from `admin-examinations-nav.js`; preserve jsPDF/AutoTable/Blueprint loading. Leave the unused file in repo until final cleanup.

Update `exam-scope-month-folders.test.mjs`: preserve V2 scope helper coverage, remove expectations that first submission defines “conducted,” and instead assert that Control Center owns lifecycle tabs/month filtering.

- [ ] **Step 8: Run GREEN + syntax**

```bash
node --test exam-control-center-ui.test.cjs admin-exam-control-center-ui.test.mjs exam-scope-month-folders.test.mjs examination-branch-shell.test.mjs
node --check exam-control-center-ui.js
node --check admin-exams.js
node --check admin-examinations-nav.js
```

- [ ] **Step 9: Commit**

```bash
git add exam-control-center-ui.js exam-control-center-ui.test.cjs admin-exam-control-center-ui.test.mjs admin-exams.html admin-exams.js admin-examinations-nav.js exam-scope-month-folders.test.mjs
git commit -m "feat: build admin exam control center"
```

---

### Task 6: Make Examination CI Validate the Master PR

**Files:**
- Modify: `.github/workflows/examination-intelligence.yml`
- Create: `examination-master-ci-contract.test.mjs`

- [ ] **Step 1: Write failing CI contract**

Require:

```yaml
on:
  pull_request:
    branches:
      - main
  workflow_dispatch:
```

Keep Node 22, selected contracts, full root regression, JS syntax and Edge esbuild parsing. Add Phase 1 tests to the fast contract list.

- [ ] **Step 2: Run RED**

```bash
node --test examination-master-ci-contract.test.mjs
```

- [ ] **Step 3: Update workflow and run GREEN**

```bash
node --test examination-master-ci-contract.test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/examination-intelligence.yml examination-master-ci-contract.test.mjs
git commit -m "ci: verify examinations master pull requests"
```

---

### Task 7: Phase 1 Verification Checkpoint

- [ ] **Step 1: Run full root regression**

```bash
node --test *.test.js *.test.mjs *.test.cjs
```

- [ ] **Step 2: Check all root browser JS**

```bash
find . -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

- [ ] **Step 3: Parse Examination Edge Functions**

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-exams/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exams.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-exam-access/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-exam-access.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-exam-attempt/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-exam-attempt.js --external:*
npx -y esbuild@0.25.9 supabase/functions/student-result-review/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/student-result-review.js --external:*
npx -y esbuild@0.25.9 supabase/functions/exam-performance/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/exam-performance.js --external:*
```

- [ ] **Step 4: Verify diff scope**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Phase 1 must not modify student-attempt, results/performance, Academy communications/morning cron, or Student Syllabus implementation files.

- [ ] **Step 5: Scan for superseded logic in new Phase 1 code**

```bash
grep -R "SGA-DLY\|SGA-UNT\|SGA-MON" supabase/functions/_shared/exam-master-policy.mjs exam-control-center-ui.js admin-exams.html admin-exams.js || true
grep -R "latest start\|fixed start" supabase/functions/_shared/exam-master-policy.mjs supabase/functions/admin-exams/control-center-policy.mjs admin-exams.js || true
```

Expected: no final master-code or fixed-start implementation uses those legacy rules.

- [ ] **Step 6: Do not deploy Phase 1**

Keep `EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql` reviewed/tested source only until the coordinated Phase 2 switch is ready. This prevents production from sitting between old creation/publish contracts and the final master contracts.

- [ ] **Step 7: Request code review**

Invoke `superpowers:requesting-code-review`. Any accepted defect fix begins with a reproducing failing test.

- [ ] **Step 8: Verification before completion**

Invoke `superpowers:verification-before-completion` and rerun the exact regression/syntax/parse commands before claiming this checkpoint complete.

## Phase 1 Acceptance Criteria

- Final policy recognizes only Daily/Weekly/Monthly/Grand as new official types.
- Final code builder produces `SGA-{DT|WT|MT|GT}-{BATCH2}{DDMM}`.
- Historical `unit` data remains readable without becoming a final create option.
- Master migration is data-preserving and no production migration is applied in this phase.
- No fixed common start/latest-start logic is introduced.
- Lifecycle is server-derived from setup/publication/attempt/release/archive facts.
- Control Center shows approved summary cards, priority exam, Needs Attention, lifecycle tabs, filters and full exam list.
- Conducted is not inferred merely from first submission.
- Existing create/scope/audience/publish/re-exam/reset functionality remains available on the checkpoint branch.
- Student attempt/result/performance/communications code is untouched by this phase.
- Full root regression and Edge parse checks pass.
- Pull requests to `main` run Examination verification CI.

## Next Plan

`Phase 2 — Create Exam Wizard + Final Creation/Code Switch + Coverage + Questions + Blueprint + Audience/Publish`

Phase 2 replaces the current Create Exam modal with the approved six-step wizard, switches new creation from legacy `allocate_exam_code`/template policy to the master allocator/policy, replaces the old hard-coded publish template guard with wizard/blueprint readiness validation, and introduces the setup-side Exam Workspace tabs. It still does not implement the final student countdown/release engine; that belongs to Phase 3/4.
