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
- **Current Average %** uses the latest valid graded attempt for each distinct exam so a RE-EXAM does not accidentally overweight one exam in the summary.
- **Best %** is the best valid attempt percentage across the selected student’s exam history.
- **Overall Accuracy** aggregates correct/wrong from the latest valid attempt of each distinct exam.

RESET-invalidated attempts must not contribute. RE-EXAM valid attempts remain visible in history even though only the latest valid attempt contributes to the current summary average/accuracy.

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

### Subject classification source of truth

For mapped exams, subject membership is derived from **question-level canonical syllabus mapping** (`exam_question_syllabus_map` resolved through the mapped subtopic/chapter/unit), because question mapping is scoring truth.

`exam_scope_items` is only intended coverage/context and must not override actual scoring mappings.

This matters for `NEET` or `Mixed` exams: one exam may legitimately contribute to Physics, Chemistry, and Biology subject cards when its mapped questions cover all three subjects.

A distinct exam is counted at most once inside a given subject card, even if multiple mapped questions/scopes in that exam belong to that subject.

For legacy unmapped exams:

- `Physics`, `Chemistry`, or `Biology` exam types may be shown under that declared single subject.
- Legacy `NEET`/`Mixed` exams are not guessed into subject cards. They remain identifiable as legacy/unmapped rather than fabricating subject distribution.

## 5. Subject Performance Must Be Subject-Specific

A mixed NEET exam must never show its whole-exam score as Physics/Chemistry/Biology performance.

For mapped exams, the protected server calculates subject-specific attempt metrics from the questions mapped to that subject:

- Subject Earned Marks
- Subject Max Marks
- Subject Percentage
- Subject Correct
- Subject Wrong
- Subject Unattempted

Each question belongs to one primary scoring topic, so it contributes once to exactly one subject.

For implementation, subject earned/max may be derived from the subject’s mapped question set directly, or by summing only the non-overlapping Unit-level performance rows for that subject. Topic + Chapter + Unit rows must never be summed together because that would double/triple count the same questions.

For a legacy unmapped single-subject exam, the full exam result may be used as that declared subject’s fallback performance because there is no mixed-subject allocation to infer.

### Subject summary average

Within a subject card:

- `Exams Attempted` counts distinct exams with a valid attempt containing that subject.
- `Average %` uses the latest valid subject-specific attempt percentage per distinct exam.
- `Best %` uses the best valid subject-specific attempt percentage in that subject’s history.

## 6. Subject Detail — Exam History

Clicking a subject card opens that subject’s exam-only detail.

Show a chronological subject exam history with:

- Exam Name
- Scope summary for that subject
- Attempt number (`Attempt 1`, `Attempt 2`, ... when re-exams exist)
- Subject Earned / Subject Max Marks
- Subject Percentage
- Subject Correct / Wrong / Unattempted
- Result publication state
- Submitted date/time

For a mapped mixed exam, every metric above is subject-specific, not the whole-exam metric.

Important: this subject-level exam list does **not** invent a global Subject E1/E2/E3 series.

Official `E1 / E2 / E3...` remains exact-scope-wise only, as already approved in Phase 3.

## 7. Subject Detail — Unit / Chapter / Topic E-History

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

## 8. Create/Edit Exam — Scope Editor V2

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

The UI must make dependency state explicit:

- Before Subject: Unit shows `Select Subject First` and is disabled.
- Before Unit: Chapter shows `Select Unit First` and is disabled.
- Before Chapter: Scope Type is disabled.

This prevents an empty Chapter dropdown from looking like a data/loading bug.

## 9. Manual Topic Entry — Canonicalization

Manual Topic entry must not remain free text detached from syllabus IDs.

When Admin saves a scope row with `Specific Topic`, the protected backend resolves the entered name under the selected Chapter.

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

## 10. Topic Reuse in Future Exams

V2 uses a manual Topic Name field rather than a mandatory topic dropdown.

The Topic Name input may show lightweight autocomplete suggestions from existing **approved** topics under the selected Chapter.

Admin may:

- click an existing suggestion to reuse it, or
- type a new topic name.

The final save always resolves server-side using the canonicalization rules above; client autocomplete is convenience only and never validation/security truth.

## 11. Atomic Topic Resolution + Scope Persistence

Keep `exam_scope_items` as the authoritative exam-level intended coverage layer.

For `Whole Chapter`:

- `subtopic_id = null`

For `Specific Topic`:

- canonical `subtopic_id` is required after backend resolution.

### Required transaction boundary

Topic promotion/creation and exam-scope replacement must occur in **one PostgreSQL transaction**.

Implement this as a service-only Security Definer RPC, for example:

`replace_exam_scope_items_v2(p_exam_id uuid, p_items jsonb) returns integer`

Each JSON item carries enough information to distinguish:

- whole chapter (`scopeType='chapter'`), or
- specific topic (`scopeType='topic'`, `topicName='...'`, optionally an existing approved `subtopicId`).

The RPC must:

1. Validate every Unit/Chapter relationship.
2. Validate every scope type/topic name.
3. Resolve all topic matches by the rules in Section 9.
4. Reject disabled conflicts/duplicates.
5. Create/promote required subtopics.
6. Replace all `exam_scope_items` rows.
7. Return only after the entire operation succeeds.

Any exception rolls back topic changes and scope changes together. There must be no orphan approved topic created by a failed exam save.

Direct `anon` / `authenticated` execute and direct topic/scope table writes remain prohibited; only `service_role` may execute the RPC.

The existing human-readable `exams.syllabus` summary continues to be generated for compatibility/display from the resolved canonical rows.

## 12. Relationship to Question Mapping

Question-level mapping remains scoring truth.

Exam scope is only intended coverage/context.

When Manage Questions opens:

- Whole Chapter scope prefills Subject → Unit → Chapter.
- Specific Topic scope prefills Subject → Unit → Chapter → canonical Topic.
- Multiple exam scope rows remain selectable as presets.

Admin still selects Question Range and FULL/PARTIAL. No question mappings are silently created just because exam scope exists.

Publish validation remains strict: all questions must have valid mappings/answer keys/marks before publish.

## 13. Protected API for Student-First Exam Performance

Extend the existing protected `exam-performance` Edge Function with a specific Admin action:

`action: 'admin_student_monitor'`

Input:

- `studentId`

Response must contain one coherent protected payload with:

- student identity needed by the page
- eligible published exams/audience state
- valid attempts/results and attempt ordinals
- mapped subject membership per exam
- subject-specific question/score metrics per attempt
- three subject summaries
- subject exam timelines
- legacy/unmapped exam markers
- existing exact-scope E-history rows

The browser must not recreate audience or subject-scoring security logic using direct table joins.

Existing `admin_list` and `rebuild_exam` actions remain available for backward compatibility/maintenance.

## 14. Error Handling

Create/Edit Exam:

- Scope Subject missing → block save.
- Unit missing → block save.
- Chapter missing → block save.
- Specific Topic selected but Topic Name empty → block save.
- Disabled exact topic match → block save with explicit message.
- Duplicate scope row → block save.
- Backend topic/scope transaction failure → no topic or scope partial write.

Exam Performance:

- No exams for subject → show `No Exams Yet`, not misleading zero-filled history.
- Submitted result not yet published → Admin may see score; publication state is clearly marked.
- Legacy NEET/Mixed unmapped exam → show as legacy/unmapped, never guess subject allocation.
- Subject score cannot be derived for a mapped exam → show an explicit data-integrity warning rather than falling back to whole-exam percentage.

## 15. Backward Compatibility

- Historical exams/results/attempts/responses are not rewritten.
- Existing structured `exam_scope_items` remain valid.
- Existing approved subtopic IDs remain valid.
- Existing suggested subtopics are not bulk-approved; only an exact topic explicitly chosen by Admin may be promoted during save.
- Existing question mappings and generated scope performance remain unchanged unless Admin explicitly rebuilds an exam after mapping changes.
- Student-side result visibility rules remain unchanged.
- Existing `replace_exam_scope_items` RPC remains available until all callers are migrated; V2 caller uses the atomic V2 RPC.

## 16. Testing Requirements

Add TDD/regression coverage for at least:

1. Subject → Unit cascade.
2. Unit → Chapter cascade.
3. Disabled placeholder states before prerequisites are selected.
4. Whole Chapter hides Topic Name and saves null subtopic.
5. Specific Topic reveals manual input and requires a name.
6. Existing approved topic is reused.
7. Existing suggested exact topic is promoted/reused, not duplicated.
8. Disabled exact topic is rejected.
9. New manual topic creates one approved canonical subtopic.
10. Case/whitespace duplicate detection.
11. Topic promotion/creation and scope replacement roll back together on any failing row.
12. Multi-scope mixed-subject exam saves correctly.
13. Mapping preset receives resolved canonical topic ID.
14. Student exam summary counts distinct eligible exams correctly.
15. RE-EXAM does not overweight current summary average; latest valid attempt per exam is used.
16. Mixed/NEET exam contributes once to each mapped subject card.
17. Mixed/NEET subject score uses only questions mapped to that subject.
18. Mixed exam Physics/Chemistry/Biology correct/wrong/unattempted counts are subject-specific.
19. Legacy single-subject unmapped exam may use full-result fallback.
20. Legacy NEET/Mixed unmapped exam is not guessed into a subject.
21. RE-EXAM history is retained without inventing Subject E-series.
22. Exact Unit/Chapter/Topic E-history numbering remains unchanged.
23. RESET semantics remain unchanged.
24. Existing answer-save, audience, publish-validation, grading, result-publication, and performance regressions remain green.

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
- Clicking a subject shows that student’s subject-specific exam history plus exact Unit/Chapter/Topic E-history.
- Mixed-exam subject scores/counts are calculated only from questions mapped to that subject.
- No Subject E-series is fabricated.
- Create/Edit Exam clearly guides Subject → Unit → Chapter with disabled prerequisite states.
- Choosing Specific Topic opens manual Topic Name entry.
- Manual topics become/reuse canonical approved syllabus IDs in the same transaction as scope save.
- Whole Chapter remains supported.
- Multiple scope rows remain supported.
- Question Mapping receives the scope as a preset but remains scoring truth.
- Historical exam data and existing stable exam behavior remain safe.
