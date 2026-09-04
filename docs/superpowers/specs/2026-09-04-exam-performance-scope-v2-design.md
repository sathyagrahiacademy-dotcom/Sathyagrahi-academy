# Sathyagrahi Academy — Exam Performance & Exam Scope V2 Design

Date: 2026-09-04
Status: Approved in conversation; written spec for user review before implementation

## 1. Goal

Refine the new Examinations architecture in two connected areas:

1. Make `Examinations → Exam Performance` student-first, visually and behaviorally similar to the existing Admin `Student Performance` monitor, but focused only on exams.
2. Make Create/Edit Exam syllabus scope reliable and simple: Subject → Unit → Chapter loads automatically, and choosing a specific Topic opens manual Topic entry that becomes canonical syllabus data.

The stable exam attempt, answer sync, grading, audience, reset/re-exam, publish validation, result publishing, and exact-scope E-history rules must remain unchanged.

## 2. Root Cause / Current-State Findings

Current production data already contains official syllabus hierarchy:

- Physics: 20 Units
- Chemistry: 20 Units
- Biology: 10 Units
- Chapters exist under those Units.

Therefore missing Unit/Chapter choices are not a missing-data problem. The Create Exam UI is a strict cascade: Chapter is empty until Unit has been selected.

The current Topic/Subtopic behavior is the real usability gap. `neet_syllabus_subtopics` contains topic rows, but currently none are `approved`. Because the scope API exposes approved subtopics only, the Create Exam Topic/Subtopic selector effectively offers only `Whole Chapter / No specific topic`.

V2 removes that dependency from Create Exam by using explicit manual Topic entry when the Admin chooses a specific topic.

## 3. Exam Performance — Student-First Layout

`Examinations → Exam Performance` becomes an exam-only monitoring page based on the proven visual pattern of `admin-student-performance.html`.

### Left pane — Students

Show all active students with:

- Student name
- Academy Student ID
- Total published/assigned exams available to that student
- Distinct exams attempted

Clicking a student opens that student’s exam performance on the right.

### Right pane — Student exam summary

Show:

- Student name / ID
- Exams Set
- Exams Attempted
- Results Published
- Overall Average %
- Best %
- Overall Accuracy

Definitions:

- **Exams Set** = distinct published exams the student is eligible to access through ALL or SELECTED audience assignment.
- **Exams Attempted** = distinct eligible exams with at least one valid submitted/graded attempt.
- **Results Published** = distinct eligible exams with at least one result published to the student.
- **Average / Best / Accuracy** use valid graded results available to Admin; Admin does not have to wait for student result publication to see performance.

RESET-invalidated attempts must not contribute. RE-EXAM valid attempts remain historical data.

## 4. Subject Cards

After a student is selected, immediately show three subject cards:

- Physics
- Chemistry
- Biology

Each card shows:

- Exams Set
- Exams Attempted
- Results Published
- Average %
- Best %

Example:

`Physics — Set 5 | Attempted 4 | Published 4 | Avg 68.5% | Best 82%`

### Subject classification

For mapped/structured exams, subject membership is derived from canonical syllabus scope/question mapping, not merely from `exams.subject`.

This matters for `NEET` or `Mixed` exams: one exam may legitimately contribute to Physics, Chemistry, and Biology subject cards when it contains mapped coverage in all three.

A distinct exam is counted at most once inside a given subject card, even if multiple questions/scopes in that exam belong to that subject.

For legacy unmapped exams:

- `Physics`, `Chemistry`, or `Biology` exam types may be shown under that declared single subject.
- Legacy `NEET`/`Mixed` exams are not guessed into subject cards. They remain identifiable as legacy/unmapped rather than fabricating subject distribution.

## 5. Subject Detail — Exam History

Clicking a subject card opens that subject’s exam-only detail.

First show a chronological exam history table/cards with:

- Exam Name
- Scope summary for that subject
- Attempt number (`Attempt 1`, `Attempt 2`, ... when re-exams exist)
- Score / Max Marks
- Percentage
- Correct / Wrong / Unattempted
- Result publication state
- Submitted date/time

Important: this subject-level exam list does **not** invent a global Subject E1/E2/E3 series.

Official `E1 / E2 / E3...` remains exact-scope-wise only, as already approved in Phase 3.

## 6. Subject Detail — Unit / Chapter / Topic E-History

Below the exam timeline, show official syllabus performance in hierarchy:

`Unit → Chapter → Topic`

Use existing protected `exam_scope_performance` / performance API data.

For each exact scope show:

- E1 / E2 / E3...
- Exam name
- FULL / PARTIAL
- Question count
- Earned / Max Marks
- Percentage
- Submitted date

Rules remain unchanged:

- Unit E-series and Chapter E-series are independent.
- Topic E-series is exact-topic-specific.
- RE-EXAM creates the next valid E for the exact scope.
- RESET does not consume a new E and removes invalid performance.
- Negative scores remain negative.
- Chapter/Unit performance remains weighted by actual marks.
- No Subject-level E-series is introduced.

## 7. Create/Edit Exam — Scope Editor V2

Keep the existing exam fields:

- Exam Title
- Exam Subject / Type
- Duration
- Total Marks
- Exam Code
- Exam Password
- Instructions
- Negative Marking

Keep repeatable `+ ADD SCOPE` rows for multi-chapter/mixed exams.

Each scope row becomes:

1. Subject
2. Unit
3. Chapter
4. Scope Type
5. Topic Name — only when `Specific Topic` is selected

### Cascade behavior

- Selecting **Subject** immediately populates only that subject’s Units.
- Selecting **Unit** immediately populates only that Unit’s Chapters.
- Selecting **Chapter** enables Scope Type.
- Scope Type has exactly:
  - `Whole Chapter`
  - `Specific Topic`
- Selecting `Specific Topic` reveals a manual Topic Name input.
- Selecting `Whole Chapter` hides/clears Topic Name.

Chapter is not expected to show values before Unit is selected; the UI should make this dependency visually obvious rather than appearing broken.

## 8. Manual Topic Entry — Canonicalization

Manual Topic entry must not remain free text detached from syllabus IDs.

When Admin saves a scope row with `Specific Topic`, the protected Admin backend resolves the entered name under the selected Chapter.

Normalization for exact reuse:

- trim leading/trailing whitespace
- collapse repeated internal whitespace
- case-insensitive comparison for duplicate detection
- preserve Admin-entered display capitalization for a newly created topic

Resolution order:

1. Exact normalized match to an existing **approved** subtopic → reuse its ID.
2. Exact normalized match to an existing **suggested** subtopic → promote that same row to `approved` and reuse its ID because the Admin explicitly selected that topic.
3. Exact normalized match to a **disabled** subtopic → reject with a clear message; do not silently reactivate disabled curriculum data.
4. No exact match → create a new `approved` subtopic under the selected Chapter and use its ID.

This guarantees that Exam Scope, Question Mapping, Performance, and future reuse all reference canonical IDs.

## 9. Topic Reuse in Future Exams

Although V2 uses manual entry rather than a mandatory dropdown, the Topic Name field should provide lightweight autocomplete/suggestions from existing approved topics under the selected Chapter.

Admin may:

- click an existing suggestion to reuse it, or
- type a new topic name.

The final save still resolves server-side using the canonicalization rules above; client autocomplete is convenience only and never security/validation truth.

## 10. Exam Scope Persistence

Keep `exam_scope_items` as the authoritative exam-level intended coverage layer.

For `Whole Chapter`:

- `subtopic_id = null`

For `Specific Topic`:

- canonical `subtopic_id` is required after backend resolution.

The existing human-readable `exams.syllabus` summary continues to be generated for compatibility/display.

Duplicate exact exam scope rows remain blocked.

## 11. Relationship to Question Mapping

Question-level mapping remains scoring truth.

Exam scope is only intended coverage/context.

When Manage Questions opens:

- Whole Chapter scope prefills Subject → Unit → Chapter.
- Specific Topic scope prefills Subject → Unit → Chapter → canonical Topic.
- Multiple exam scope rows remain selectable as presets.

Admin still selects Question Range and FULL/PARTIAL. No question mappings are silently created just because exam scope exists.

Publish validation remains strict: all questions must have valid mappings/answer keys/marks before publish.

## 12. Protected Backend Changes

Extend protected Admin exam scope logic with a single-purpose topic resolver.

Suggested interface:

`resolve_or_create_exam_subtopic(chapter_id, topic_name)`

It may be implemented inside `admin-exams` service logic or as a service-only SQL RPC, but direct anon/authenticated topic writes remain prohibited.

The operation must validate:

- Chapter exists
- Chapter belongs to selected Unit
- Unit belongs to selected Subject
- Topic name is non-empty after normalization
- disabled exact matches are rejected
- no duplicate canonical topic is created under the same Chapter

Save ordering should resolve all specific topics and validate all rows before replacing the exam scope, so a failed row cannot leave a partially updated scope.

## 13. Data/API for Student-First Exam Performance

Prefer extending the existing protected `exam-performance` API rather than exposing direct client table joins.

Add an Admin student-monitor action that can return, for one student:

- eligible exams/audience
- valid attempts/results
- subject membership derived from canonical mapping/scope
- subject summary counts
- subject exam timeline
- existing exact-scope E-history rows

The browser should receive one coherent protected payload instead of reproducing security-sensitive audience/performance joins client-side.

Existing `admin_list` / rebuild behavior can remain available for internal/backward compatibility.

## 14. Error Handling

Create/Edit Exam:

- Scope Subject missing → block save.
- Unit missing → block save.
- Chapter missing → block save.
- Specific Topic selected but Topic Name empty → block save.
- Disabled exact topic match → block save with explicit message.
- Duplicate scope row → block save.
- Backend topic resolution failure → do not partially replace exam scope.

Exam Performance:

- No exams for subject → show `No Exams Yet`, not zero-filled misleading history.
- Submitted result not yet published → Admin may see score; mark publication state clearly.
- Legacy NEET/Mixed unmapped exam → show as legacy/unmapped, never guess subject allocation.

## 15. Backward Compatibility

- Historical exams/results/attempts/responses are not rewritten.
- Existing structured `exam_scope_items` remain valid.
- Existing approved subtopic IDs remain valid.
- Existing suggested subtopics are not bulk-approved; only an exact topic explicitly chosen by Admin may be promoted during save.
- Existing question mappings and generated scope performance remain unchanged unless the Admin explicitly rebuilds an exam after mapping changes.
- Student-side result visibility rules remain unchanged.

## 16. Testing Requirements

Add TDD/regression coverage for at least:

1. Subject → Unit cascade.
2. Unit → Chapter cascade.
3. Whole Chapter hides Topic Name and saves null subtopic.
4. Specific Topic reveals manual input and requires a name.
5. Existing approved topic is reused.
6. Existing suggested exact topic is promoted/reused, not duplicated.
7. Disabled exact topic is rejected.
8. New manual topic creates one approved canonical subtopic.
9. Case/whitespace duplicate detection.
10. Multi-scope mixed-subject exam saves correctly.
11. Mapping preset receives resolved canonical topic ID.
12. Student exam summary counts distinct eligible exams correctly.
13. Mixed/NEET exam can contribute once to multiple subject cards based on mapped subject coverage.
14. Legacy NEET/Mixed unmapped exam is not guessed into a subject.
15. RE-EXAM history is retained without inventing Subject E-series.
16. Exact Unit/Chapter/Topic E-history numbering remains unchanged.
17. RESET semantics remain unchanged.
18. Existing answer-save, audience, publish-validation, grading, result-publication, and performance regressions remain green.

## 17. Production Rollout

Use patch-based rollout:

1. Implement/tests on isolated feature branch.
2. Run full exam regression suite.
3. Record historical production counts before any DB change.
4. Apply only required migration/RPC changes.
5. Deploy only affected protected Admin functions.
6. Smoke test with a draft/non-historical exam where possible.
7. Re-check counts and security/RLS.
8. PR review and direct merge to `main` after green verification, following the user’s standing instruction not to ask routine merge-option questions.

## 18. Success Criteria

The change is complete when:

- Selecting a student in Exam Performance immediately shows Physics/Chemistry/Biology exam counts and performance.
- Clicking a subject shows that student’s subject exam history plus exact Unit/Chapter/Topic E-history.
- No Subject E-series is fabricated.
- Create/Edit Exam reliably guides Subject → Unit → Chapter.
- Choosing Specific Topic opens manual Topic Name entry.
- Manual topics become/reuse canonical approved syllabus IDs.
- Whole Chapter remains supported.
- Multiple scope rows remain supported.
- Question Mapping receives the scope as a preset but remains scoring truth.
- Historical exam data and existing stable exam behavior remain safe.
