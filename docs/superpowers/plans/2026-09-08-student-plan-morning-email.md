# Student Plan + Morning Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved Sep 08 production fixes: persistent Admin Communications navigation, source-locked student syllabus/day-wise plan presentation, and a verified 07:00 Asia/Kolkata Morning Study Plan email dispatch path.

**Architecture:** Preserve the existing static student/admin portal and Supabase data model. Reuse `student-learning-progress.html/js` for student syllabus + day-wise plan, keep existing learning-progress RPCs intact, and reuse `academy-communications` for email delivery. Use the repository's existing GitHub Actions communications workflow as the scheduler if its current contract supports a morning dispatch; otherwise make the smallest scheduler-compatible change. Database syllabus content remains the canonical runtime source, but is reconciled against the three user-approved SGA NEET 2026 syllabus PDFs before publishing.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Postgres + Edge Functions, GitHub Actions, Resend.

**Spec:** Approved in-chat requirements from 2026-09-08 SGA discussion.

## Global Constraints

- Student study/revision entries are not hard-locked at 20:00.
- Daily examination duration is fixed at 45 minutes from each student's own start time; exam timing changes are out of scope for this patch.
- Morning email sender remains `info@sathyagrahiacademy.com`.
- Morning email timezone is `Asia/Kolkata` and configured send time is 07:00.
- WhatsApp remains disabled.
- Do not change existing Study/Revision update logic while adding syllabus/day-wise plan presentation.
- Use only Academy blue/white/orange visual language for newly added student plan UI.
- Do not silently invent syllabus or schedule data; runtime content must come from approved syllabus/schedule data already stored or explicitly seeded from approved source.

---

### Task 1: Admin Communications navigation consistency

**Files:**
- Modify all admin HTML pages whose sidebar contains Notifications/Help & Feedback but lacks Communications.
- Test: add/update a static navigation contract test.

**Interfaces:**
- Produces: a consistent `admin-communications.html` sidebar link on every admin page.

- [ ] Add a failing contract test that scans admin pages and asserts a Communications link exists between Notifications and Help & Feedback.
- [ ] Run the test and confirm it fails on pages such as `admin-notifications.html`.
- [ ] Add only the missing sidebar link; preserve spacing, classes, and active state behavior.
- [ ] Run the navigation contract test and existing admin navigation tests.

### Task 2: Source-locked student syllabus presentation

**Files:**
- Modify: `student-learning-progress.html`
- Modify: `student-learning-progress.js`
- Test: add/update a Learning Progress contract test.
- Data verification: `neet_syllabus_units`, `neet_syllabus_topics`.

**Interfaces:**
- Consumes: existing `student_learning_progress` view and topic IDs.
- Produces: subject-specific hierarchy: Biology `Unit → Chapter → Official Topics`; Chemistry `Branch → Chapter → Official Topics`; Physics `Chapter → Official Topics` while preserving existing progress/update actions.

- [ ] Add a failing UI/data contract test for the new two-tab section and subject-specific hierarchy labels.
- [ ] Reconcile runtime syllabus rows against the approved SGA Biology/Chemistry/Physics 2026 files; do not alter student progress IDs unnecessarily.
- [ ] Add `NEET Syllabus` and `Day-wise Study Plan` tabs in Learning Progress.
- [ ] Render source-locked hierarchy without changing existing Study/Revision update RPC behavior.
- [ ] Run Learning Progress tests and inspect key subject/chapter counts.

### Task 3: Day-wise Study Plan in student login

**Files:**
- Modify: `student-learning-progress.html`
- Modify: `student-learning-progress.js`
- Possibly add a read-only Supabase view/RPC only if current preparation data cannot safely serve the UI.
- Test: add/update day-wise plan contract test.

**Interfaces:**
- Consumes: the same master schedule/preparation data used by Morning Study Plan email.
- Produces: read-only Today / Upcoming / Previous plan cards with Date, Subject, Chapter, Study Day, Revision, Planned Time.

- [ ] Verify current schedule/preparation tables and Sep 08 rows for active students.
- [ ] Add a failing contract test proving the UI uses schedule data, not hard-coded example text.
- [ ] Implement read-only Day-wise Study Plan rendering with Today, Upcoming, Previous filters/sections.
- [ ] Preserve Study/Revision completion entry in existing Learning Progress controls.
- [ ] Run the contract test and manually inspect Sep 08 plan output data.

### Task 4: 07:00 Morning Study Plan dispatch

**Files:**
- Inspect/modify: `.github/workflows/academy-communications.yml`
- Inspect/modify: `supabase/functions/academy-communications/index.ts`
- Inspect/modify: `supabase/functions/academy-communications/morning-policy.mjs`
- Inspect/modify: `supabase/functions/academy-communications/message-builders.mjs`
- Test: existing `academy-communications-*` tests plus a scheduler contract test if needed.

**Interfaces:**
- Consumes: `academy_communication_settings` and the same master schedule/preparation source used by the student Day-wise Plan.
- Produces: idempotent daily `morning_dispatch` email to eligible students at 07:00 Asia/Kolkata, with delivery logging.

- [ ] Read the existing Actions schedule and Edge Function dispatch contract.
- [ ] Query Sep 08 active-student schedule data and recipient emails; identify any missing plan/recipient before 07:00.
- [ ] Add a failing test for any missing scheduler/dispatch contract behavior.
- [ ] Make the smallest implementation change required for an automated Sep 08 07:00 dispatch.
- [ ] Verify idempotency prevents duplicate same-day sends.
- [ ] Run all communications tests.
- [ ] Perform a dry-run/test dispatch only through the existing test path; do not send the actual Sep 08 morning email early.
- [ ] Confirm the production scheduler is enabled and points at the production function with required secret/auth configuration.

### Task 5: Production verification and delivery

**Files:**
- No new feature files unless verification exposes a defect.

**Interfaces:**
- Produces: deployable PR and production-ready verification evidence.

- [ ] Run all touched-area tests.
- [ ] Verify database counts/state for active students, Sep 08 plans, communication settings, and no duplicate morning delivery rows.
- [ ] Review diff for unrelated changes.
- [ ] Open PR with exact verification notes.
- [ ] Merge only after verification because the user explicitly requested these fixes live for the 07:00 Sep 08 email.
- [ ] Re-check production workflow/function state after merge and confirm next scheduled 07:00 dispatch.
