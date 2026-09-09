# Examinations UX Consolidation Design

Date: 2026-09-10
Status: Approved in chat, pending written-spec review
Branch: `feature/examinations-ux-design`

## 1. Goal

Consolidate five admin Examinations UX improvements into one safe batch without changing grading logic, result correctness, student attempt behavior, immutable exam question snapshots, or existing publication rules.

The five approved changes are:

1. Six-digit numeric Exam Password.
2. Stable fixed-size Create Exam Wizard shell with no step-resize blink.
3. Folder-style Question Bank navigation with lazy question loading.
4. Pending-only Results work queue plus Published Results archive grouped by month and exam type.
5. Learning-Progress-style Performance hierarchy with E1/E2/E3 chips and detail dialogs.

## 2. Architecture Choice

Use a hybrid approach:

- Preserve existing canonical syllabus data and exam/result/performance records.
- Redesign browser UI where existing payloads are sufficient.
- Add only minimal server reads where scalability requires them, especially Question Bank folder summaries and selected-topic question loading.
- Add a database index only if implementation-time query inspection proves one is missing.
- Do not introduce new physical folder tables for Results or Question Bank UI folders.

## 3. Exam Password

### Behavior

- Auto-generated password must be exactly six digits: `^\d{6}$`.
- Leading zero is valid, e.g. `004281`.
- Regenerate produces another six-digit value.
- Manual Change accepts only exactly six digits.
- Copy and Hide behavior remain unchanged.

### Security

- Use `crypto.getRandomValues()` for client-side generation.
- Server validates the same exact six-digit rule before hashing.
- Plaintext password remains only in the current Admin setup session.
- Persist only the existing password hash / protected representation.
- Password must not be included in Student Portal notifications or result emails.

## 4. Create Exam Wizard Shell

### Problem

Different steps currently change outer modal height and internal card geometry, causing visible resize/jump/blink when moving between steps.

### Design

- Keep one stable outer modal width and viewport-based height across all six steps.
- Keep header, six-step navigation, and footer actions visually fixed.
- Make only the step content region scrollable.
- Do not let Step 3, Step 4, Step 5, or validation issue lists change outer modal dimensions.
- Preserve responsive behavior on smaller screens with a safe max-height fallback.
- Standardize card spacing, section gaps, and action placement across all steps.

## 5. Question Bank Folder Model

### Entry View

The Question Bank opening screen must not list questions.

Show exactly three top-level subject folders:

- Physics
- Chemistry
- Biology

### Navigation

Admin navigation is visually:

`Subject -> Chapter -> Topic -> Questions`

The backend canonical hierarchy remains intact:

`Subject -> Unit -> Chapter -> Topic`

The UI may show the Unit as small context/subtitle where needed, but it must not destroy or rewrite canonical mappings.

### Lazy Data Loading

The browser must not fetch thousands of question rows on initial load.

Use two read patterns:

1. Folder summary endpoint/action:
   - subject counts
   - chapter counts
   - topic counts
   - canonical IDs required to drill down
2. Topic question endpoint/action:
   - fetch questions only for the selected topic
   - support server-side sorting

### Question View

For questions in the selected topic show:

- Question text
- Difficulty
- Question Type
- Source
- Source Year
- Added Date
- Added Time
- Selection checkbox / Add to Exam action

### Sorting

Support:

- Newest First
- Oldest First
- Difficulty
- Question Type
- Source
- Source Year

Search should operate within the current folder context unless the Admin explicitly navigates back/up.

### Add to Exam Safety

Preserve the existing immutable snapshot flow through `add_bank_questions_to_exam` or its current equivalent. Selecting bank questions must never make later edits to the permanent bank alter an already attached exam snapshot.

## 6. Results Work Queue and Archive

### Main Results View

The main Results work area shows only result rows that still need publication.

Published results do not remain in the working queue.

### Published Results Archive

Published rows are derived into a virtual folder hierarchy:

`Published Results -> Month -> DT / WT / MT / GT -> Exam -> Student Results`

Example:

`September 2026 -> WT -> SGA WEEKLY TEST ... -> Student rows`

### Grouping Rules

- Month is based on Exam Date, not publication timestamp.
- Exam type maps to DT / WT / MT / GT.
- No physical month-folder records are created in the database.
- Archive structure is derived from existing exam and result records.

### Partially Published Exams

If one exam has some students published and others still unpublished:

- unpublished students remain in the Pending work queue
- published students appear in the archive under that same exam

When all publishable rows are published, the exam no longer contributes rows to Pending.

### Existing Actions

Inside the archive exam/student view preserve authorized actions such as:

- View
- Analytics
- Re-Exam
- Reset

Publication action exists only in Pending.

## 7. Performance Redesign

### Main Layout

Remove the large always-visible subject statistic cards and separate attempt table from the primary presentation.

After selecting a student, show a compact syllabus-first hierarchy matching the visual language of Learning Progress:

`Physics | Chemistry | Biology`

then:

`Unit -> Chapter -> Topic`

### E-Series Chips

Where exact mapped performance history exists, show compact exam chips:

`E1` `E2` `E3`

E-numbering remains exact-scope-wise. Unit, Chapter, and Topic histories are independent scope series and must not be guessed or merged.

### E-Chip Dialog

Clicking an E chip opens a dialog with:

- Exam name
- Exam code
- Exam date
- Attempt label/number
- Question count
- Score
- Maximum marks
- Percentage
- Correct count
- Wrong count
- Unattempted count
- Published/Admin-only result status
- Exact Unit / Chapter / Topic scope
- Full Result action when available
- Rebuild Performance action when applicable

The main hierarchy stays compact; detailed metrics live inside the dialog.

### Data Integrity

Reuse existing performance/result records. Extend `exam-performance` output only for fields that the dialog needs and the current payload does not already provide. Do not recalculate or overwrite raw grading data.

## 8. Data and Migration Policy

- No rewrite of existing exam/result/performance data.
- No new physical archive-folder tables.
- No change to student attempt timer/start/submit behavior.
- No change to grading formulas.
- No change to immutable exam question snapshot guarantees.
- No change to result publication meaning.
- Additive index migration is permitted only if query-plan inspection shows it is required for new lazy Question Bank reads.

## 9. Error Handling

### Password

Reject invalid manual password with an inline error; never silently coerce letters or a wrong-length value.

### Question Bank

- Empty subject/chapter/topic: show an empty-folder state, not an error table.
- Failed folder/question fetch: keep current navigation context and show retryable error text.
- Add to Exam failure: preserve selection and show the server error.

### Results

- Failed publication keeps row in Pending.
- Failed archive load does not alter publication state.

### Performance

- Missing mapping shows no E chip for that scope.
- Legacy/unmapped exams remain explicitly labeled rather than guessed into a syllabus location.

## 10. Testing Strategy

Use TDD with RED contracts first.

Required contracts:

1. Password contract
   - six digits only
   - leading zero valid
   - client generation and server validation agree
2. Wizard shell contract
   - stable outer shell classes/geometry
   - scrollable step host
   - fixed header/stepper/footer behavior
3. Question Bank folder contract
   - no initial question list
   - subject/chapter/topic hierarchy
   - lazy selected-topic fetch
   - added date/time and sorting
   - existing add-to-exam snapshot path preserved
4. Results archive contract
   - Pending contains unpublished only
   - archive groups by exam-date month and DT/WT/MT/GT
   - partially published exam can appear in both contexts at row level
5. Performance hierarchy contract
   - subject/unit/chapter/topic presentation
   - E1/E2/E3 chips
   - chip dialog required fields
   - exact-scope numbering preserved

Then run:

- full root regression suite
- browser JavaScript syntax checks
- all root JavaScript syntax checks
- Edge Function TypeScript parse
- Examination Intelligence workflow
- Academy Communications workflow
- any Student/Question Bank-specific workflow touched by the implementation

## 11. Rollout

Implementation must occur on an isolated feature branch and PR.

Rollout order:

1. Merge only after exact-head CI is green.
2. Apply any proven-required additive DB index migration first, if one exists.
3. Deploy only changed Edge Functions.
4. Deploy frontend via normal GitHub Pages flow.
5. Run live Admin smoke tests:
   - six-digit password
   - all six Wizard steps without resize blink
   - Question Bank subject -> chapter -> topic -> questions
   - Pending Results and Published archive
   - Performance E-chip dialog
6. Verify existing published exam/results remain unchanged.

## 12. Out of Scope

This batch does not redesign:

- student exam-taking UI
- grading rules
- score calculation
- Student Portal result review
- communications routing
- manual exam subsystem
- lifecycle semantics beyond the approved Results presentation grouping

## 13. Acceptance Criteria

The batch is accepted only when all of the following are true:

- Exam Password is exactly six numeric digits everywhere in the master create/update flow.
- Create Exam modal does not visibly resize between steps under normal desktop use.
- Question Bank opens to three subject folders and loads questions only after topic selection.
- Question rows show Added Date and Time and can be sorted by the approved keys.
- Pending Results shows only unpublished rows.
- Published Results are navigable Month -> DT/WT/MT/GT -> Exam -> Student Results.
- Performance is compact and syllabus-first with E chips, and clicking a chip opens the approved detail dialog.
- Existing exam snapshots, grading, attempts, publication state, and communications continue to pass regression tests.
