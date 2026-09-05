# Academy Communications Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-controlled Email + WhatsApp communication layer for Morning Study Plans, Exam Published alerts and Result/Daily Performance reports while preserving the existing Academy exam/result flow.

**Architecture:** Keep Google Workspace as the official Academy mailbox/inbox. Add a dedicated `academy-communications` Supabase Edge Function for Resend email and Meta WhatsApp delivery, service-owned settings/delivery tables for control and idempotency, an Admin Communications page, and best-effort hooks from the existing authoritative exam/result publish path. External provider failures never roll back exam or result publication.

**Tech Stack:** Static HTML/CSS/JavaScript on GitHub Pages, Node 22 built-in test runner, Supabase Postgres 17, Supabase Auth, Supabase Edge Functions (Deno/TypeScript), Resend REST API, Meta WhatsApp Cloud API.

**Spec:** `docs/superpowers/specs/2026-09-06-academy-communications-hub-design.md`

## Global Constraints

- Preserve the existing Exam → Questions → Mapping → Publish → Attempt → Results → Performance flow.
- Google Workspace remains the official mailbox system.
- Sender mapping is locked: Morning Plan=`info@sathyagrahiacademy.com`, Exam=`exams@sathyagrahiacademy.com`, Result/Daily Performance=`results@sathyagrahiacademy.com`.
- `support@` and `admissions@` remain Workspace aliases but are not automated in this phase.
- Resend and Meta credentials are server-side secrets only; no provider secret may appear in browser code or API responses.
- New communication tables are server-owned: RLS enabled, anon/authenticated direct table access revoked, service role granted only what the Edge Function needs.
- `student_study_sessions.session_date` is the authoritative “Today Studied” source.
- `preparation_tasks.target_date` is the authoritative Morning Study Plan source.
- Existing Performance Intelligence is reused; no invented strengths/weaknesses.
- Email/WhatsApp failure never blocks or rolls back Exam Publish or Result Publish.
- Duplicate successful logical deliveries are prevented by `(event_key, student_id, channel)`.
- Morning time semantics use `Asia/Kolkata`.
- All channel/event settings default OFF until provider readiness is confirmed.

---

### Task 1: Lock Communication Policy and Schema Contracts

**Files:**
- Create: `supabase/functions/academy-communications/communication-policy.mjs`
- Create: `academy-communications-policy.test.mjs`
- Create: `ACADEMY_COMMUNICATIONS_MIGRATION.sql`
- Create: `academy-communications-schema.test.mjs`

**Interfaces:**
- `SENDERS` maps `morning_plan`, `exam_published`, `result_published` to the locked Academy aliases.
- `eventKey(type,{examId,attemptId,studentId,date})` returns deterministic idempotency keys.
- `indiaDateKey(dateLike)` returns `YYYY-MM-DD` in Asia/Kolkata semantics.
- `maskRecipient(value,channel)` masks email/phone for Admin logs.
- `normalisePhone(value)` returns a digits-only international phone string or empty string.
- Migration creates `academy_communication_settings` and `academy_communication_deliveries`.

- [ ] **Step 1: Write failing policy tests**

Tests assert exact sender aliases, deterministic event keys, India date conversion, safe recipient masking and phone normalization.

- [ ] **Step 2: Write failing schema contract tests**

Read `ACADEMY_COMMUNICATIONS_MIGRATION.sql` and assert both tables, default-disabled settings, `Asia/Kolkata`, delivery status/channel checks, `attempt_count`, unique `(event_key,student_id,channel)`, indexes, RLS, revoke from anon/authenticated and service-role grants.

- [ ] **Step 3: Run RED**

Run: `node --test academy-communications-policy.test.mjs academy-communications-schema.test.mjs`
Expected: FAIL because policy/migration do not exist yet.

- [ ] **Step 4: Implement minimal pure policy and additive migration**

Migration must not modify existing exam/result/study tables. Insert singleton settings row `id=1` with both channels and all event toggles disabled; default morning time `07:00:00` and timezone `Asia/Kolkata`.

- [ ] **Step 5: Run GREEN**

Run the two new tests and then `node --test *.test.js *.test.mjs *.test.cjs`.

---

### Task 2: Build the Secure Academy Communications Edge Function

**Files:**
- Create: `supabase/functions/academy-communications/index.ts`
- Create: `supabase/functions/academy-communications/message-builders.mjs`
- Create: `academy-communications-message.test.mjs`
- Create: `academy-communications-security.test.mjs`

**Interfaces:**
- Browser Admin actions: `status`, `save_settings`, `test_email`, `test_whatsapp`, `retry_delivery`.
- Trusted internal actions: `exam_published`, `result_published`, `morning_dispatch`.
- Browser Admin authorization validates user JWT + active Admin profile.
- Internal authorization requires `x-sga-internal-key` equal to Edge secret `ACADEMY_COMMUNICATIONS_INTERNAL_KEY`.
- Provider readiness reports booleans/status only, never secret values.

- [ ] **Step 1: Write failing message/security tests**

Assert Morning/Exam/Result email subjects and sender categories, Today Studied summary behavior, mentor-signal fallback behavior, no secret-name/value exposure, and internal actions require a distinct trusted-server path.

- [ ] **Step 2: Run RED**

Run new tests; expected FAIL because Edge Function/builders are absent.

- [ ] **Step 3: Implement safe provider adapters**

Email adapter posts to Resend with Bearer API key, JSON payload and an idempotency key derived from logical delivery. WhatsApp adapter posts a configured utility template to Meta Graph using `META_GRAPH_API_VERSION`, `META_WHATSAPP_PHONE_NUMBER_ID` and `META_WHATSAPP_ACCESS_TOKEN`. API version and template names are environment configuration, not browser settings.

- [ ] **Step 4: Implement data loaders and delivery state machine**

For each logical delivery: check settings/event enabled → validate recipient → create/upsert pending delivery → skip if already sent → call provider → mark sent/failed. Retry reuses the same failed row and increments `attempt_count`.

For result payload load published `exam_results`, owning `exam_attempts`, exam/profile, same-day `student_study_sessions`, and existing `loadStudentIntelligence(admin,studentId)`. Use only available evidence.

- [ ] **Step 5: Implement Admin status/settings/test/retry actions**

`status` returns safe settings, sender mapping, provider readiness, active student display metadata and recent delivery logs. `save_settings` validates booleans and `HH:MM` time. Test-send actions require selected active student with the needed recipient field.

- [ ] **Step 6: Run GREEN + TypeScript parse**

Run Node tests and esbuild parse for `academy-communications/index.ts`.

---

### Task 3: Add Admin Communications Control Page

**Files:**
- Create: `admin-communications.html`
- Create: `admin-communications.js`
- Create: `admin-communications-contract.test.mjs`
- Modify: `admin-dashboard.html`
- Modify: `admin-settings.html`
- Modify: `admin-exams.html`
- Modify: `admin-results.html`

**Interfaces:**
- Page calls only `/functions/v1/academy-communications` with the current Admin JWT.
- Shows Email/WhatsApp readiness, channel/event toggles, Morning time, locked sender aliases, Test Email, Test WhatsApp, recent deliveries and Retry for failed rows.
- No API key/token text input exists.

- [ ] **Step 1: Write failing UI contract tests**

Assert all controls/labels exist, locked sender aliases appear, no secret-input fields exist, and frontend calls the new Edge Function rather than direct communication tables.

- [ ] **Step 2: Run RED**

Expected FAIL because page/scripts are absent.

- [ ] **Step 3: Build Admin page using existing Academy admin visual language**

Keep royal/deep blue + white, compact professional cards, clear green/amber/red provider states and a responsive delivery log table.

- [ ] **Step 4: Add navigation entry**

Add `Communications` to the principal Admin sidebars used by Dashboard, Settings, Examinations and Results without restructuring unrelated pages.

- [ ] **Step 5: Run GREEN + browser JS syntax checks**

Run the UI contract test and `node --check admin-communications.js` plus existing root JS syntax suite.

---

### Task 4: Wire Exam Publish and Secure Result Publish

**Files:**
- Modify: `supabase/functions/admin-exams/index.ts`
- Modify: `admin-results.js`
- Create: `academy-communications-integration.test.mjs`

**Interfaces:**
- Add server helper `bestEffortCommunicate(action,payload)` using `SUPABASE_URL` + `ACADEMY_COMMUNICATIONS_INTERNAL_KEY`.
- Existing `action:'publish'` remains authoritative for exam publication; after DB success it best-effort invokes `exam_published`.
- Add Admin Edge action `publish_result` consuming `attemptId`; it publishes result/exam flags server-side, then best-effort invokes `result_published`.
- `admin-results.js` replaces direct `exam_results`/`exams` updates with `adminCall({action:'publish_result',attemptId})`.

- [ ] **Step 1: Write failing integration/source contracts**

Assert result publishing is no longer a direct browser mutation, exam/result communication calls happen only after authoritative DB publication, and communication errors are caught/returned as non-fatal metadata.

- [ ] **Step 2: Run RED**

Expected FAIL on current direct result update and missing hook.

- [ ] **Step 3: Patch backend surgically**

Do not rewrite unrelated exam management. Keep current validation/audience/re-exam/reset behavior unchanged.

- [ ] **Step 4: Patch result frontend**

Keep current confirmation, loading and refresh behavior; change only the publication transport.

- [ ] **Step 5: Run GREEN + full examination regression**

Run new integration test, all root tests, JS syntax, and esbuild parse for `admin-exams/index.ts`.

---

### Task 5: Add Morning Dispatcher and CI Verification

**Files:**
- Modify: `supabase/functions/academy-communications/index.ts`
- Create: `academy-communications-morning.test.mjs`
- Create: `.github/workflows/academy-communications.yml`

**Interfaces:**
- `morning_dispatch` uses Asia/Kolkata date/time, `preparation_tasks.target_date`, active students and daily idempotency keys.
- Invocation may occur on a fixed cadence; function sends only when enabled and within the accepted configured-time window.
- Repeated invocation cannot create a second successful student/channel/date delivery.

- [ ] **Step 1: Write failing morning-dispatch tests**

Cover disabled event, no tasks, correct target date, configured-time window and duplicate invocation behavior.

- [ ] **Step 2: Run RED then implement dispatcher**

Do not generate study tasks. Send only existing assigned `preparation_tasks` for that India date.

- [ ] **Step 3: Add branch CI workflow**

On `feature/academy-communications-hub`, run communication contracts, full root tests, all root JS syntax and esbuild parse for both `academy-communications` and `admin-exams` Edge Functions.

- [ ] **Step 4: Run GREEN locally/source-level and inspect workflow syntax**

All new and existing tests must pass before any production database/function change.

---

### Task 6: Production Apply, Deploy, Advisors and Readiness Check

**Files/Systems:**
- Apply: `ACADEMY_COMMUNICATIONS_MIGRATION.sql` to Supabase project `lzclqifnylbyftwzpbxy` only after branch tests are green.
- Deploy: `academy-communications` Edge Function.
- Redeploy: `admin-exams` only if its source changed and all tests pass.

**Interfaces:**
- Production tables and Edge Functions match committed source.
- Provider readiness is truthful: `Configured` only when required environment secrets exist.

- [ ] **Step 1: Apply migration and verify schema**

Query columns, unique constraint/indexes, RLS flags and grants. Confirm settings singleton is disabled by default.

- [ ] **Step 2: Deploy Edge Function(s)**

Use `verify_jwt=false` for `academy-communications` only because it implements explicit dual-path custom authorization (Admin JWT or internal secret) in function code. Keep `admin-exams` JWT verification enabled.

- [ ] **Step 3: Verify provider readiness without exposing secrets**

If Resend/Meta secrets are absent, leave related channels OFF and Admin page must show `Needs Setup`. Do not fake a successful external send.

- [ ] **Step 4: Run Supabase security/performance advisors**

Separate pre-existing unrelated advisor warnings from any new communication-specific finding; fix only new feature regressions in this scope.

- [ ] **Step 5: Verify GitHub Actions and branch diff**

Confirm all workflow jobs green and inspect `main...feature/academy-communications-hub` for only intended files.

- [ ] **Step 6: Open PR only after verification**

PR body must distinguish: code/infrastructure active, Google Workspace/Resend/Meta external credentials configured or still pending, and Morning scheduler status.
