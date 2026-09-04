# Sathyagrahi Academy — Examinations Shell, Exam Scope, and Admin Login Design

Date: 2026-09-04
Status: Approved direction from conversation; written design awaiting review before implementation

## 1. Purpose

Finish the remaining Examinations architecture so the Admin sees one clear EXAMINATIONS area, captures the official syllabus scope while creating/editing an exam, and uses a simplified Admin login ID of `1901` without exposing the admin email in the UI.

This design preserves the current stable exam backend, answer reliability, audience/re-exam/reset controls, mapping/performance engine, and existing production data.

## 2. Scope Decomposition

### Subproject A — Unified EXAMINATIONS area

This is the architectural change. It restructures navigation and connects the existing exam pages as one area.

### Subproject B — Exam syllabus scope at Create/Edit

This extends the existing Create/Edit Exam flow so the official scope is captured from the canonical syllabus instead of a free-text syllabus field.

### Subproject C — Admin login simplification

This is a bounded UI/auth adapter change. The underlying Supabase admin account and existing password remain unchanged.

## 3. Unified EXAMINATIONS Navigation

The Admin sidebar must contain only one exam-related primary link:

- EXAMINATIONS

Remove these as separate sidebar items:

- Question Bank
- Results & Performance

Inside the EXAMINATIONS area, provide a consistent sub-navigation on every exam-related page:

1. Exams
2. Question Bank
3. Results
4. Exam Performance
5. Manual Exams

### 3.1 Implementation approach

Use the existing stable pages as section pages instead of rebuilding them into a large single-page application.

- Exams → `admin-exams.html`
- Question Bank → `admin-question-bank.html`
- Results → `admin-results.html`
- Exam Performance → `admin-performance.html`
- Manual Exams → new `admin-manual-exams.html` shell/placeholder until the manual-exam backend is built

Each page will show the same EXAMINATIONS sub-navigation and the EXAMINATIONS sidebar item will remain active. This gives one coherent Examinations module while minimizing regression risk.

### 3.2 Sidebar consistency

Update Admin pages that currently show separate Question Bank / Results & Performance links so the sidebar presents only EXAMINATIONS for exam-related navigation.

The existing `Student Performance` sidebar item remains separate because it is broader preparation/learning performance. Exam E-history and exam-specific analytics belong under EXAMINATIONS → Exam Performance.

## 4. Create/Edit Exam — Canonical Syllabus Scope

Replace the free-text `Syllabus / Chapters` input as the primary scope entry mechanism.

The Create/Edit Exam modal keeps:

- Exam Title
- Subject / exam type
- Duration
- Total Marks
- Exam Code
- Exam Password
- Instructions
- Negative Marking

Add a syllabus-scope editor driven by canonical syllabus data.

### 4.1 Scope row

Each scope row contains cascading selectors:

- Subject
- Unit
- Chapter
- Topic/Subtopic

Selection behavior:

1. Subject selection loads only Units for that Subject.
2. Unit selection loads only Chapters in that Unit.
3. Chapter selection loads approved Topic/Subtopic records for that Chapter.
4. Admin can add multiple scope rows for a multi-chapter or mixed-subject exam.
5. Duplicate exact scope rows are blocked.
6. Only approved subtopics are selectable.

### 4.2 Single-subject and mixed exams

For Physics/Chemistry/Biology exams, a new scope row defaults to the selected exam Subject.

For NEET/Mixed exams, each scope row can choose Physics, Chemistry, or Biology independently.

This supports multiple chapters and multiple subjects in one exam without manual syllabus text.

### 4.3 Persistence

Add a normalized exam-scope table rather than storing comma-separated text.

Recommended table: `exam_scope_items`

Fields:

- `id uuid primary key`
- `exam_id uuid not null references exams(id) on delete cascade`
- `unit_id bigint not null references neet_syllabus_units(id)`
- `chapter_id bigint not null references neet_syllabus_topics(id)`
- `subtopic_id bigint null references neet_syllabus_subtopics(id)`
- `sort_order integer not null default 0`
- timestamps

Subject is derived from the selected Unit. Chapter must belong to Unit. Subtopic, when present, must belong to Chapter.

The table is service-controlled. Direct anon/authenticated writes are revoked; Admin changes go through the protected `admin-exams` function.

### 4.4 Backward compatibility

Existing exams with legacy `exams.syllabus` text remain unchanged and readable.

Editing an old exam does not guess structured scope from the text. Admin can add canonical scope rows explicitly.

The old `syllabus` text column may continue to store a generated human-readable summary for compatibility, but normalized scope rows become authoritative exam-level scope metadata.

### 4.5 Connection to Question Mapping

Exam-level scope does not replace question-level scoring mapping.

- Exam scope = intended exam coverage.
- Question mapping = exact scoring truth for each question.

When Manage Questions / Syllabus Range Mapping opens, the exam scope should be used as the default syllabus filter and suggestion context so the Admin does not search the full NEET syllabus again.

Publish validation still requires every question to be mapped correctly before publish.

## 5. Exam Performance Placement

The existing syllabus E-history in `admin-performance.html` becomes the official EXAMINATIONS → Exam Performance section.

It retains filters for Student, Subject, Unit, Chapter, Topic, Exam, FULL/PARTIAL and displays E-history, Questions, Earned/Max Marks, Percentage, Coverage, Exam, and Date.

No duplicate exam-performance navigation should remain outside the EXAMINATIONS module.

## 6. Results Placement

The existing `admin-results.html` becomes EXAMINATIONS → Results.

Current result publication, attempt numbering, reset/re-exam semantics, answer review, and score data remain intact.

## 7. Manual Exams Section

Create the Manual Exams sub-navigation destination now so the information architecture is complete.

Until the already-designed manual/offline workflow is implemented, the page should clearly state that Manual Exams will be enabled in the next phase. Do not fabricate manual-exam data or add incomplete backend behavior in this change.

## 8. Admin Login Simplification

The Admin login UI must no longer ask for or display the admin email.

Visible login fields:

- Admin ID: `1901`
- Password: existing password

### 8.1 Authentication adapter

The existing Supabase admin auth account remains unchanged.

The browser maps Admin ID `1901` internally to the already-authorized admin email and calls the existing Supabase `signInWithPassword` flow. The email is not shown in the login form.

This avoids migrating the auth account or changing the password.

### 8.2 Security

- Reject any Admin ID other than `1901`.
- After Supabase sign-in, keep the existing `profiles.role === 'admin'` and `is_active` check.
- Do not expose the authorized email in visible page content or validation messages.
- Existing password stays unchanged.

### 8.3 Forgot password

Because Supabase password reset is email-based, the visible Admin login should not require typing the email. If Forgot Password remains, it may internally send the reset to the authorized account while showing only a generic success message.

The normal production login surface should not show first-time account-creation controls once the Admin account is established.

## 9. Data Flow

### Create/Edit Exam

Admin opens Create/Edit → enters exam basics → adds one or more canonical syllabus scope rows → save → protected Admin Edge Function validates hierarchy → exam + scope rows persist → Manage Questions opens with scope-aware defaults → question Range Mapping remains scoring source of truth → publish validation → audience → publish.

### Admin Login

Admin enters `1901` + existing password → UI internally resolves authorized auth email → Supabase password sign-in → profile role/active verification → Admin Dashboard.

## 10. Error Handling

- Scope cannot be saved if Unit/Chapter hierarchy is inconsistent.
- Subtopic must be approved and belong to selected Chapter.
- Duplicate exact scope rows are rejected with a clear message.
- Old exams without structured scope remain editable.
- Failure to save scope must not partially publish an exam.
- Admin login errors must not reveal the hidden email.

## 11. Testing

Add focused regression tests for:

1. Sidebar has one EXAMINATIONS item and no separate Question Bank / Results & Performance exam links.
2. All exam section pages include the common five-section sub-navigation.
3. Scope selector filtering: Subject → Unit → Chapter → approved Topic/Subtopic.
4. Multi-row mixed-subject scope and duplicate prevention.
5. Scope hierarchy validation and persistence.
6. Existing old exams continue loading without structured scope.
7. Question mapping page receives scope-aware default filtering without changing scoring mappings.
8. Admin login accepts `1901`, rejects other IDs, hides email, and preserves role/active checks.
9. Existing exam answer-save, audience, reset/re-exam, publish validation, grading, and performance regression suites stay green.

## 12. Success Criteria

The change is complete when:

- Admin sidebar shows one EXAMINATIONS primary tab for all exam functions.
- Exams, Question Bank, Results, Exam Performance, and Manual Exams are clearly available as sections inside it.
- Create/Edit Exam captures canonical Subject → Unit → Chapter → Topic/Subtopic scope without manual syllabus typing.
- Multi-chapter and mixed-subject exams can capture multiple scope rows.
- Manage Questions uses that scope as its default mapping context.
- Existing question-level mapping remains the scoring source of truth.
- Existing exams remain safe and readable.
- Admin login shows `1901` + Password, not email.
- Existing admin password and Supabase account remain unchanged.
- No regression occurs in the current production exam system.
