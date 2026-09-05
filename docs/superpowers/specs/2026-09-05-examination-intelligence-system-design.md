# Sathyagrahi Academy Examination Intelligence System — Design

## Status
Approved by the academy owner on 05 September 2026.

## Goal
Turn every academy exam into a traceable preparation data point while preserving the existing Examination Branch flow:

**Exam → Questions → Mapping → Publish → Student Attempt → Results → Performance**

The system must not rebuild or bypass the current stable flow.

## 1. Examination Branch
Keep the existing branch navigation:

1. Exams
2. Question Bank
3. Results
4. Performance — upgraded to **Performance Intelligence**
5. Manual Exams

## 2. Official Exam Types
Three academy exam types are canonical:

| Type | Code | Questions | Duration | Marks | Marking |
| --- | --- | ---: | ---: | ---: | --- |
| Daily Exam | DLY | 45 | 45 min | 180 | +4 / -1 / 0 |
| Unit Exam | UNT | 180 | 180 min | 720 | +4 / -1 / 0 |
| Monthly Exam | MON | 180 | 180 min | 720 | +4 / -1 / 0 |

For Unit and Monthly exams the mapped question distribution must be:
- Physics: 45
- Chemistry: 45
- Biology: 90

For a Daily exam:
- a single-subject Daily exam must contain all 45 questions from that selected subject;
- a mixed Daily exam may distribute the 45 questions across subjects, but the total remains exactly 45.

Duration, total marks, expected question count and negative marking are derived from the exam type and are not free-form academy settings.

## 3. Exam Date and Automatic Exam Code
`exam_date` is compulsory at creation.

The server generates the exam code. Admin does not type it.

Format:

`SGA-{TYPE}-{YYYYMMDD}-{NNN}`

Examples:
- `SGA-DLY-20260905-001`
- `SGA-UNT-20260920-001`
- `SGA-MON-20260930-001`

Sequence is per type + exam date and must be collision-safe under concurrent creation.

Exam type, exam date and generated exam code are immutable after creation because they are historical traceability identifiers. Other draft-safe exam metadata can still be edited under existing rules.

## 4. Question Bank Taxonomy
Question Bank remains permanent and syllabus-aware:

**Subject → Unit → Chapter → Topic/Subtopic**

Keep existing filters and add controlled question-format validation.

### Physics allowed formats
- Direct Concept MCQ
- Numerical / Application
- Graph / Diagram
- Circuit Based
- Formula / Relation
- Statement I–II
- Match / Order

### Chemistry allowed formats
- Direct Concept / NCERT
- Numerical / Application
- Reaction / Product
- Reagent / Conversion
- Statement Based
- Assertion–Reason
- Match / Order / Trend

Chemistry naturally supports different mixes for Physical, Organic and Inorganic chapters; the validation remains at subject format level unless a later approved taxonomy adds chemistry-branch metadata.

### Biology allowed formats
- NCERT Direct
- Multiple Statements
- Statement I–II
- Assertion–Reason
- Match the Following
- Sequence / Order
- Diagram / Image

All official online exam questions remain four-option single-correct MCQs (A/B/C/D).

Difficulty values remain controlled:
- Easy
- Medium
- Hard

For official NEET-pattern Question Bank imports, Marks must be `4` and Negative Marks must be `1`. Existing strict full-batch validation remains mandatory: one invalid row rejects the whole import.

## 5. Publish Validation
Existing mapping/answer-key validation remains mandatory.

Add exam-template validation before publish:
- expected total question count matches exam type;
- official marks match template;
- each question is mapped to an approved syllabus topic;
- Unit/Monthly subject distribution is exactly 45 Physics / 45 Chemistry / 90 Biology;
- single-subject Daily exam questions all belong to the selected subject;
- mixed Daily exam total is exactly 45.

No existing historical exam may be retroactively broken. Legacy exams without an official `exam_type` remain supported under current validation behavior and are labelled legacy.

## 6. Automatic Exam Notification
Publishing an exam must automatically make an exam notification visible only to students eligible for that exam.

Preferred architecture: derive the exam notice from the same authoritative student exam-access data rather than duplicating generic notification rows. This avoids duplicate notices and stale audience data.

Exam notice content includes:
- exam type
- title
- exam code
- exam date
- question count
- duration
- marks
- syllabus summary
- Start Exam action when available

Unpublishing automatically removes the derived notice because the exam is no longer eligible.

## 7. Question Activity / Time Tracking
Add server-owned per-attempt per-question activity records:
- attempt_id
- question_id
- active_seconds
- visit_count
- answer_change_count
- first_viewed_at
- last_viewed_at
- updated_at

Rules:
- activity is owned by the exam attempt;
- client never writes directly to the activity table;
- Edge Function validates the student owns the active attempt and the question belongs to that exam;
- hidden/minimized tab time is not counted as active question time;
- activity updates are additive and idempotency-safe enough for normal browser retry behavior;
- answer saving remains the existing authoritative answer mechanism and must not depend on activity logging succeeding.

## 8. Answered Question Paper
After a result is published, the answered-paper view should support per question:
- question and options
- student answer
- correct answer
- correct/wrong/unattempted state
- difficulty
- topic
- time taken
- answer-change count
- explanation where available

Answer keys remain protected until result visibility rules permit showing them to that student.

## 9. Performance Intelligence
Existing official Unit/Chapter/Topic performance rows remain the base.

Add evidence dimensions:
- exams set / attempted
- total questions faced
- unique Question Bank questions faced
- Question Bank coverage %
- repeat exposure count
- accuracy
- Easy / Medium / Hard accuracy
- average active time per question
- recent trend
- retention signal where the same bank question is later answered incorrectly after previously being correct

Every displayed metric must be traceable through:

**Student → Exam Date → Exam Code → Attempt → Question**

## 10. Strength Classification
Do not classify mastery from one score alone.

Initial deterministic labels:
- **Mastered** — strong accuracy, sufficient unique coverage, hard-question evidence and repeated recent consistency
- **Strong** — good accuracy with meaningful coverage
- **Developing** — mixed evidence or insufficient coverage
- **Needs Revision** — declining/repeated errors, weak medium/hard performance, or retention issues
- **Weak** — sustained low accuracy with sufficient evidence

If accuracy is high but coverage is too low, use a non-mastered state such as **Strong Early Evidence — Low Coverage**.

Thresholds live in a pure tested policy module so they can be revised later without rewriting UI or stored historical scores.

## 11. Mentor Guidance
Performance Intelligence should produce deterministic mentor-oriented signals:
- Strengths
- Priority Weaknesses
- Speed Issues
- Retention Watch
- Coverage Gaps
- Next Exam Focus

The system must explain the evidence behind each signal. It must not invent AI-only judgments without measurable exam data.

## 12. Security and Integrity
- Preserve current admin/student authentication and audience assignment model.
- Do not expose service-role credentials to the browser.
- New server-owned tables in exposed schema must have RLS enabled and direct anon/authenticated privileges removed unless a specific safe student policy is intentionally created.
- Add indexes for ownership/filter columns used in authorization or performance queries.
- Published/historical exam content remains snapshot-stable.
- Existing attempts, raw answers, results and scope-performance generation remain authoritative and must not regress.

## 13. Rollout Strategy
Implement as independently verifiable patches:
1. policy contracts and schema foundation;
2. Exam Type / Exam Date / server-generated code;
3. Question Bank format validation;
4. publish-template validation + derived exam notices;
5. question activity tracking;
6. answered-paper enrichment;
7. Performance Intelligence and mentor guidance;
8. full Examination regression, security review, PR, merge and production verification.
