# Exam Audience, Reset and Re-Exam Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe All/Selected exam publishing, per-student re-exam eligibility, individual/all technical reset, and complete exam deletion without requiring routine Supabase cleanup.

**Architecture:** Add an explicit `exam_student_assignments` access/quota table plus `exams.audience_mode` and `exam_attempts.attempt_no`. Student exam discovery and verification move behind `student-exam-access`, and attempt creation uses a tested quota policy so valid prior attempts remain while re-exams create E2/E3-style attempt history. Admin mutations stay in the JWT-protected `admin-exams` Edge Function and use database cascades for responses/results cleanup.

**Tech Stack:** Static HTML/JavaScript, Supabase JS v2, Supabase Edge Functions (Deno/TypeScript), PostgreSQL 17, Node assertion tests.

**Spec:** `docs/superpowers/specs/2026-09-04-examinations-management-design.md`

## Global Constraints

- Preserve the stable production exam flow and Phase-1 answer synchronization protection.
- Publish must support `all` active students and `selected` students.
- Selected students must be explicitly assigned; unassigned students must not see, verify, or start that exam.
- Re-Exam preserves prior valid attempts/results and grants exactly one additional attempt each time.
- Technical Reset deletes the targeted attempt/history and does not count it as a valid re-exam.
- Reset All removes all attempts/results for the exam but preserves exam/questions/access/mapping and returns assigned students to one fresh attempt.
- Delete Exam Completely removes the exam and dependent exam data through cascades and requires typed Exam Code confirmation.
- JWT verification remains enabled for all exam management/access Edge Functions.
- Existing submitted attempts/results must remain unchanged during migration.
- Performance derivation, Range Mapping, Manual Exams, and unified Examinations navigation are separate later phases.

---

## File Structure

- Create `EXAM_AUDIENCE_REEXAM_MIGRATION.sql` — additive schema migration, RLS/ACL and safe backfill.
- Create `exam-attempt-policy.test.mjs` — pure Node tests for resume/block/create re-exam policy.
- Create `supabase/functions/student-exam-attempt/attempt-policy.mjs` — pure attempt decision helper.
- Modify `supabase/functions/student-exam-attempt/index.ts` — audience enforcement and multi-attempt start logic while preserving Phase-1 save/submit code.
- Create `supabase/functions/admin-exams/index.ts` — version-controlled admin exam function with audience, reset, re-exam and destructive delete actions.
- Create `supabase/functions/student-exam-access/index.ts` — version-controlled student list/verify endpoint with assignment enforcement.
- Modify `admin-exams.html` — audience and maintenance modals.
- Modify `admin-exams.js` — publish All/Selected, manage audience, re-exam/reset all or selected, typed delete confirmation.
- Modify `student-examinations.js` — load only exams visible to the logged-in student through the Edge Function.
- Modify `admin-results.js` — per-attempt Re-Exam and Reset controls.

### Task 1: Add assignment and multi-attempt schema safely

**Files:**
- Create: `EXAM_AUDIENCE_REEXAM_MIGRATION.sql`

**Interfaces:**
- Produces: `exams.audience_mode text NOT NULL DEFAULT 'all' CHECK (audience_mode IN ('all','selected'))`
- Produces: `exam_attempts.attempt_no integer NOT NULL DEFAULT 1 CHECK (attempt_no > 0)`
- Replaces: unique `(exam_id,student_id)` with unique `(exam_id,student_id,attempt_no)`
- Produces table: `exam_student_assignments(exam_id,student_id,is_assigned,max_attempts,created_at,updated_at)` with PK `(exam_id,student_id)`

- [ ] **Step 1: Run production preflight read-only checks**

Verify:

```sql
select to_regclass('public.exam_student_assignments');
select count(*) from public.exam_attempts where status='in_progress';
select exam_id,student_id,count(*) from public.exam_attempts group by 1,2 having count(*)>1;
```

Expected now: assignment table absent, zero in-progress attempts, no duplicate exam/student attempt rows.

- [ ] **Step 2: Write migration SQL**

Migration must:

```sql
alter table public.exams add column if not exists audience_mode text not null default 'all';
alter table public.exams drop constraint if exists exams_audience_mode_check;
alter table public.exams add constraint exams_audience_mode_check check (audience_mode in ('all','selected'));

alter table public.exam_attempts add column if not exists attempt_no integer not null default 1;
alter table public.exam_attempts drop constraint if exists exam_attempts_attempt_no_check;
alter table public.exam_attempts add constraint exam_attempts_attempt_no_check check (attempt_no > 0);
alter table public.exam_attempts drop constraint if exists exam_attempts_exam_id_student_id_key;
alter table public.exam_attempts add constraint exam_attempts_exam_student_attempt_key unique (exam_id,student_id,attempt_no);

create table if not exists public.exam_student_assignments (
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  is_assigned boolean not null default true,
  max_attempts integer not null default 1 check (max_attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (exam_id,student_id)
);
```

Enable RLS; revoke all from `anon, authenticated`; grant CRUD only to `service_role`. No authenticated direct-access policy is needed because student/admin access is through Edge Functions.

Backfill each currently published exam for every active student with `is_assigned=true` and `max_attempts = greatest(1, existing attempt count)` without mutating attempts/results.

- [ ] **Step 3: Apply migration through Supabase migration API**

Name: `exam_audience_reexam_support`.

- [ ] **Step 4: Verify schema and backfill**

Check constraints, ACL, assignment count, and verify the original three submitted attempt IDs/results are unchanged and now have `attempt_no=1`.

### Task 2: Test and implement multi-attempt start policy

**Files:**
- Create: `exam-attempt-policy.test.mjs`
- Create: `supabase/functions/student-exam-attempt/attempt-policy.mjs`

**Interfaces:**
- Produces: `decideAttempt(attempts,maxAttempts)` -> `{action:'resume',attempt}` | `{action:'create',attemptNo:number}` | `{action:'block'}`

- [ ] **Step 1: Write failing policy tests**

Tests must prove:

```js
assert.equal(decideAttempt([],1).attemptNo,1);
assert.equal(decideAttempt([{id:'a1',attempt_no:1,status:'in_progress'}],1).action,'resume');
assert.equal(decideAttempt([{id:'a1',attempt_no:1,status:'submitted'}],1).action,'block');
assert.deepEqual(decideAttempt([{id:'a1',attempt_no:1,status:'submitted'}],2),{action:'create',attemptNo:2});
assert.equal(decideAttempt([
  {id:'a1',attempt_no:1,status:'submitted'},
  {id:'a3',attempt_no:3,status:'submitted'}
],3).attemptNo,4);
```

The last case proves numbering remains unique even after an earlier reset creates gaps; quota is based on current attempt count, while `attempt_no` is monotonic from max existing number.

- [ ] **Step 2: Run test and verify RED**

Run `node exam-attempt-policy.test.mjs`; expected import/module failure.

- [ ] **Step 3: Implement minimal helper**

Rules:
- resume the single existing `in_progress` attempt first;
- if current attempt row count >= `maxAttempts`, block;
- otherwise create with `attemptNo=max(attempt_no)+1`, defaulting to 1.

- [ ] **Step 4: Run test and verify GREEN**

Run `node exam-attempt-policy.test.mjs`; expected PASS.

### Task 3: Enforce assignment and re-exam quota in student attempt start

**Files:**
- Modify: `supabase/functions/student-exam-attempt/index.ts`
- Consume: `supabase/functions/student-exam-attempt/attempt-policy.mjs`

**Interfaces:**
- Consumes: `exams.audience_mode`
- Consumes/creates: `exam_student_assignments`
- Consumes: `decideAttempt(attempts,maxAttempts)`
- Preserves Phase-1 `save` and `submit` request/response contracts.

- [ ] **Step 1: Add audience lookup during `start`**

For `audience_mode='selected'`, require an assignment row with `is_assigned=true`; otherwise return 403.

For `audience_mode='all'`, active students are eligible. Ensure a service-role assignment row exists with `max_attempts=1` when absent.

- [ ] **Step 2: Replace `.maybeSingle()` one-attempt lookup**

Load all attempts for `(exam_id,student_id)` ordered by `attempt_no`; call `decideAttempt`.

- [ ] **Step 3: Resume or create according to quota**

- `resume` -> return existing active attempt.
- `block` -> 409 `You have used all allowed attempts for this exam`.
- `create` -> insert `attempt_no` returned by helper.

- [ ] **Step 4: Keep Phase-1 integrity code unchanged**

Do not weaken immediate save validation, final full snapshot, persisted-count verification, or 15-second final-sync grace.

- [ ] **Step 5: Run Node helper tests and JS/static source checks**

### Task 4: Add Admin audience/reset/re-exam APIs

**Files:**
- Create: `supabase/functions/admin-exams/index.ts`

**Interfaces:**
- Preserves: existing `create`, `update`, `publish`, `unpublish`, `complete`, `delete` compatibility where possible.
- Adds: `students` -> active student list + assignment state for exam.
- Extends: `publish` with `audienceMode:'all'|'selected'`, `studentIds:string[]`.
- Adds: `set_audience` with same audience payload for already-published exams.
- Adds: `reexam_student`, `reexam_all`.
- Adds: `reset_attempt`, `reset_student`, `reset_all`.
- Changes: `delete` requires `confirmCode` and no longer blocks because attempts exist.

- [ ] **Step 1: Start from production admin-exams v3 source**

Preserve admin auth and create/update/password behavior.

- [ ] **Step 2: Add student/audience read action**

Return active student fields `id,full_name,student_id` plus `assigned,max_attempts`, and exam `audience_mode`.

- [ ] **Step 3: Implement publish/set-audience transaction-like ordering**

Validate selected IDs are active students. For `selected`, require at least one student. Update exam `audience_mode`, set all existing assignment rows inactive when switching selected list, then upsert selected rows `is_assigned=true` without decreasing existing `max_attempts`. For `all`, set active-student assignment rows active and set exam mode `all`. Only after assignment updates succeed set `is_published=true,status='active'` for publish.

- [ ] **Step 4: Implement Re-Exam without deleting valid history**

`reexam_student`: require eligible/assigned student, upsert assignment and increment `max_attempts` by exactly 1.

`reexam_all`: for all-mode use all active students; for selected-mode use assigned students; increment each current quota by exactly 1.

Return affected student count.

- [ ] **Step 5: Implement targeted technical reset**

`reset_attempt`: verify attempt belongs to exam/student context, delete that attempt only. Cascades remove its responses/result. Keep assignment quota unchanged, which gives one replacement slot because current row count decreased.

`reset_student`: delete all attempts for that student/exam and set assignment `max_attempts=1`.

`reset_all`: delete all attempts for exam and set all assignment `max_attempts=1`.

- [ ] **Step 6: Implement full exam delete**

Load `exam_access.exam_code`; require `confirmCode` exact uppercase match. Delete exam regardless of attempts. Existing FK cascades delete exam access/questions/answer keys/attempts/responses/results/assignments.

### Task 5: Make student exam list assignment-aware

**Files:**
- Create: `supabase/functions/student-exam-access/index.ts`
- Modify: `student-examinations.js`

**Interfaces:**
- `student-exam-access` action `list` -> only eligible published exams.
- Existing verify body without action remains treated as `verify` for compatibility.
- `verify` additionally enforces audience assignment.

- [ ] **Step 1: Extend Edge Function with `list`**

Return safe exam metadata only. All-mode exams are visible to every active student; selected-mode only if assigned.

- [ ] **Step 2: Enforce same audience rule after code/password verification**

Correct code/password must not bypass selected-student assignment.

- [ ] **Step 3: Replace direct `exams` query in `student-examinations.js`**

Invoke `student-exam-access` with `{action:'list'}` and render returned exams. Keep code/password verification and sessionStorage flow.

### Task 6: Add clean Admin controls

**Files:**
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`
- Modify: `admin-results.js`

**Interfaces:**
- Audience modal: All Students / Selected Students checkbox list.
- Maintenance modal: Re-Exam Selected / Re-Exam All / Reset Selected / Reset All.
- Result row: Re-Exam and Reset exact attempt.

- [ ] **Step 1: Add Audience modal**

Publish button opens modal instead of immediate publish. Load active students from `admin-exams` action `students`. Selected mode enables checkboxes; All mode shows active student count.

- [ ] **Step 2: Add/manage audience action on published exams**

Published rows show `AUDIENCE` plus `UNPUBLISH`; saving audience calls `set_audience` without rebuilding exam.

- [ ] **Step 3: Add maintenance modal**

Show student list and clear warning text differentiating:
- Re-Exam = keep old result and grant another attempt.
- Reset = delete technical attempt/result and allow replacement.

- [ ] **Step 4: Add typed full-delete confirmation**

Prompt admin to type the displayed Exam Code, then send `confirmCode` to server. Do not use a generic yes/no alone.

- [ ] **Step 5: Add result-row controls**

`RE-EXAM` calls `reexam_student` and leaves row intact.
`RESET` requires confirmation and calls `reset_attempt`; reload results so deleted row disappears.

### Task 7: Deploy and verify safely

**Files:**
- Migration + three Edge Functions + static-site changes from prior tasks.

- [ ] **Step 1: Run all Node/syntax regression checks**

At minimum:

```bash
node exam-attempt-policy.test.mjs
node exam-attempt-sync-utils.test.js
node exam-submit-sync.test.mjs
node attendance-report-utils.test.js
node --check admin-exams.js
node --check admin-results.js
node --check student-examinations.js
node --check student-exam-attempt.js
```

- [ ] **Step 2: Apply migration only after zero in-progress attempts are confirmed**

- [ ] **Step 3: Deploy `admin-exams`, `student-exam-access`, `student-exam-attempt` with `verify_jwt:true`**

- [ ] **Step 4: Verify production ACL/data preservation**

Confirm original three attempts/results still exist with `attempt_no=1`; no response/result counts changed solely from migration/deploy.

- [ ] **Step 5: Backend authorization probes**

Using read-only SQL plus safe transaction probes where possible, verify selected-mode unassigned access is rejected by function logic and reset/delete cascades are structurally correct. Do not mutate submitted historical rows for testing.

- [ ] **Step 6: Open PR, review changed filenames/diff, merge only after checks pass**

## Self-Review

- Covers approved Phase-2 requirements: publish All/Selected, manage audience, individual/all reset, individual/all re-exam, full exam delete, and student visibility/access enforcement.
- Preserves valid historical attempts for Re-Exam and uses attempt quota instead of cloning exams.
- Technical Reset and Re-Exam are intentionally distinct.
- Existing Phase-1 answer integrity remains server authoritative.
- Deferred: Range Mapping, automatic syllabus performance/E1-E2-E3 display, manual/offline exams, final unified Examinations tabs, bulk result publication, grading negative-marking semantic correction.
