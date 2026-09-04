# Sathyagrahi Academy — Unified Examinations Shell & Exam Scope Design

Date: 2026-09-04
Status: Approved direction from conversation; awaiting written-spec review before implementation

## 1. Goal

Complete the remaining Examinations architecture without disturbing the stable exam engine already in production. The Admin should see one EXAMINATIONS area and should capture official syllabus scope while creating/editing an exam instead of typing a free-text syllabus description.

## 2. Unified EXAMINATIONS Area

The Admin sidebar must contain only one exam-related primary item:

- EXAMINATIONS

Remove separate sidebar items for:

- Question Bank
- Results & Performance

Inside EXAMINATIONS, show a consistent five-section sub-navigation:

1. Exams
2. Question Bank
3. Results
4. Exam Performance
5. Manual Exams

Use the existing stable pages as section pages rather than rebuilding them into one large SPA:

- Exams → `admin-exams.html`
- Question Bank → `admin-question-bank.html`
- Results → `admin-results.html`
- Exam Performance → `admin-performance.html`
- Manual Exams → `admin-manual-exams.html`

Every exam-related page shows the same sub-navigation and keeps EXAMINATIONS active in the sidebar.

`Student Performance` stays separate because it covers broader preparation/learning performance. Exam-specific E-history belongs inside EXAMINATIONS → Exam Performance.

## 3. Manual Exams Section

Create the Manual Exams destination now so the Examinations information architecture is complete.

The current change does not build the manual/offline backend. Until that later phase, `admin-manual-exams.html` shows a clear “next phase” state and does not fabricate data or incomplete functionality.

## 4. Create/Edit Exam — Canonical Syllabus Scope

The current free-text `Syllabus / Chapters` field is no longer the primary scope input.

Keep the existing exam fields:

- Exam Title
- Subject / exam type
- Duration
- Total Marks
- Exam Code
- Exam Password
- Instructions
- Negative Marking

Add a repeatable canonical syllabus-scope editor.

Each scope row contains:

- Subject
- Unit
- Chapter
- Topic/Subtopic

Cascading behavior:

1. Subject loads only matching Units.
2. Unit loads only Chapters in that Unit.
3. Chapter loads only approved Topic/Subtopic records in that Chapter.
4. Admin may add multiple scope rows.
5. Duplicate exact scope rows are rejected.
6. Physics/Chemistry/Biology exams default new rows to the selected exam Subject.
7. NEET/Mixed exams allow each scope row to select Physics, Chemistry, or Biology independently.

This supports multi-chapter and mixed-subject exams without manual syllabus text.

## 5. Exam Scope Persistence

Add a normalized service-controlled table:

`exam_scope_items`

Fields:

- `id uuid primary key`
- `exam_id uuid not null references exams(id) on delete cascade`
- `unit_id bigint not null references neet_syllabus_units(id)`
- `chapter_id bigint not null references neet_syllabus_topics(id)`
- `subtopic_id bigint null references neet_syllabus_subtopics(id)`
- `sort_order integer not null default 0`
- timestamps

Subject is derived from Unit.

Validation rules:

- Chapter must belong to Unit.
- Subtopic, when selected, must belong to Chapter.
- Subtopic must be approved.
- Duplicate exact scope rows are not allowed.

Direct anon/authenticated writes are revoked. Scope reads/writes for Admin go through the protected `admin-exams` function.

## 6. Backward Compatibility

Existing exams remain safe.

- Existing `exams.syllabus` text stays readable.
- Old exams are not auto-guessed into structured scope.
- Admin may explicitly add canonical scope when editing an old exam.
- A generated human-readable syllabus summary may continue to populate the legacy text field for compatibility, but `exam_scope_items` is the authoritative exam-level scope metadata.

## 7. Relationship to Question Mapping

Exam-level scope and question-level mapping have different roles:

- Exam scope = intended coverage selected while creating/editing the exam.
- Question mapping = exact scoring truth for each question.

The existing Phase-3 question mapping remains authoritative for performance calculations and publish validation.

When Manage Questions / Syllabus Range Mapping opens, exam scope is used as the default syllabus filter/suggestion context so the Admin does not search the entire NEET syllabus again.

Publish still remains blocked until every question is validly mapped.

## 8. Exam Performance Placement

The existing syllabus E-history already implemented in `admin-performance.html` becomes EXAMINATIONS → Exam Performance.

Keep the existing filters and data:

- Student
- Subject
- Unit
- Chapter
- Topic
- Exam
- FULL / PARTIAL
- E1/E2/E3...
- Questions
- Earned / Max Marks
- Percentage
- Coverage
- Exam
- Date

No duplicate exam-performance navigation remains outside the EXAMINATIONS module.

## 9. Results Placement

The existing `admin-results.html` becomes EXAMINATIONS → Results.

Current result publication, attempt numbering, reset/re-exam semantics, answer review, and score behavior remain unchanged.

## 10. Data Flow

Admin opens Create/Edit → enters exam basics → adds canonical scope rows → protected Admin Edge Function validates hierarchy → exam + scope persist → Manage Questions opens with scope-aware defaults → question Range Mapping → publish validation → audience → publish.

## 11. Error Handling

- Invalid Unit/Chapter hierarchy blocks save.
- Invalid/unapproved Subtopic blocks save.
- Duplicate scope row blocks save.
- Failure to save scope must not partially publish an exam.
- Old exams without structured scope must continue loading and editing.

## 12. Testing

Add regression coverage for:

1. Admin sidebar contains one EXAMINATIONS exam entry and no separate Question Bank / Results & Performance entries.
2. All five exam section pages show the common Examinations sub-navigation.
3. Subject → Unit → Chapter → approved Topic/Subtopic cascading filters.
4. Multi-row mixed-subject scope.
5. Duplicate prevention and hierarchy validation.
6. Scope persistence through protected Admin backend.
7. Old exams without structured scope.
8. Manage Questions receives scope-aware defaults without altering question scoring mappings.
9. Existing answer-save, audience, reset/re-exam, publish validation, grading, and performance regression suites remain green.

## 13. Success Criteria

The change is complete when:

- Admin sees one EXAMINATIONS primary tab for all exam functions.
- Exams, Question Bank, Results, Exam Performance, and Manual Exams are clear internal sections.
- Create/Edit Exam captures Subject → Unit → Chapter → Topic/Subtopic from the canonical syllabus.
- Multi-chapter and mixed-subject exams can store multiple scope rows.
- Manage Questions uses exam scope as its default mapping context.
- Existing question-level mapping remains the scoring source of truth.
- Existing exams and production exam behavior remain safe.
