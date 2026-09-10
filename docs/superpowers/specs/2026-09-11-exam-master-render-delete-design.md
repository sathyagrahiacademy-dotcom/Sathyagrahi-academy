# Exam Master Single Renderer and Draft Delete Routing Design

## Context

Production UAT shows two remaining Examinations UI defects:

1. Opening or refreshing `admin-exams.html` briefly paints the legacy Exams table before the Master Control Center replaces it.
2. Clicking `DELETE DRAFT EXAM` can be captured by the Master Workspace router and navigate to the workspace instead of reaching the draft-delete confirmation handler.

These are frontend ownership/routing conflicts. The draft-delete backend safety rules already exist and are not part of this change.

## Goal

Make the Examinations page have one visible renderer in Master mode, and make Draft Delete reach its own confirmation/delete flow without workspace interception.

## Scope

### Single visible renderer

- `admin-exams.js` may continue to provide legacy form/auth/support behavior required by the current page, but in Master mode it must not paint the legacy exam list into `#rows`.
- The Examinations content area stays hidden while the Master Control Center is being initialized.
- The Master Control Center becomes visible after its first load attempt finishes, including controlled failure states, so the page cannot remain permanently hidden.
- Non-Master mode must remove the pending-hidden state and keep the legacy flow working.

### Draft delete routing

- The Master Workspace capture router must never intercept destructive delete controls: `[data-delete-draft]`, `.delete-draft`, or legacy `.del`.
- `DELETE DRAFT EXAM` must be handled by the Control Center delete handler, which prompts for the exact Exam Code.
- Canceling the prompt performs no navigation and no deletion.
- Published / conducted / result-published exams continue to have no Draft Delete control in the Master Control Center.

### Navigation integrity

- `CONTINUE SETUP`, `QUESTIONS`, explicit `WORKSPACE`, blueprint/student attention actions, Results, and Performance keep their current intended destinations.
- No broad change to exam creation, publishing, result, performance, attempt, timer, grading, or syllabus-mapping semantics.

## Files

- `admin-exams.html` — initial Master pending visibility and cache versions.
- `admin-exams.js` — suppress legacy list paint in Master mode while preserving support behavior.
- `admin-examinations-nav.js` — load fresh Control Center / Workspace router assets and release hidden state in non-Master mode.
- `admin-exam-control-center.js` — release hidden state after first Control Center load attempt.
- `admin-exam-workspace-route.js` — exclude delete controls from capture routing.
- `admin-exam-master-render-ownership.test.mjs` — regression contract for renderer ownership and delete routing.

## Safety Constraints

- Frontend only.
- No Supabase Edge Function changes.
- No database migrations or writes as part of verification.
- Do not delete the Sep-10 draft exam for testing.
- Do not alter the Sep-08 published exam or its attempts/results.
- Do not touch Result Mail or unrelated modules.

## Acceptance Criteria

1. Examinations navigation/refresh shows no legacy Exams table flash before the Master Control Center.
2. `DELETE DRAFT EXAM` does not navigate to workspace.
3. Clicking Draft Delete opens exact Exam Code confirmation; Cancel leaves the draft intact.
4. Published exam rows do not expose Draft Delete.
5. Existing Examinations routes continue to work.
6. Focused regression test and full repository CI are green before merge.
7. GitHub Pages deploy succeeds at the exact merged `main` SHA before production completion is claimed.
