# Sathyagrahi Academy Examinations Management Architecture

Date: 2026-09-04
Status: Design approved in conversation; implementation not started

## 1. Goal

Create one clear Examinations area that handles online exams, question reuse, publishing, student assignments, re-exams, result publication, offline/manual exam records, and exam performance without forcing the admin to use Supabase directly for routine recovery or cleanup.

The design must preserve the existing stable exam system and extend it incrementally.

## 2. Navigation

Keep one primary sidebar item:

- EXAMINATIONS

Inside it, use these sub-tabs:

1. Exams
2. Question Bank
3. Results
4. Exam Performance
5. Manual Exams

Do not create separate sidebar items for Publish Examinations, Question Bank, Results, or Exam Performance.

## 3. Exams Sub-Tab

### 3.1 Exam creation

An exam keeps the existing fields such as title, subject, syllabus, duration, total marks, negative marking, instructions, exam code, and password.

Additional exam-management actions:

- Edit Exam
- Manage Questions
- Range Mapping
- Publish
- Manage Assigned Students
- Unpublish
- Re-Exam
- Reset Attempts
- Delete Exam Completely

### 3.2 Publish to all or selected students

Publishing must support two modes:

- All active students
- Selected students

Selected-student publishing creates an explicit assignment/access record. A student must only see and access exams assigned to that student, unless the exam is published to all active students.

Admin can later add or remove assigned students without rebuilding the exam.

### 3.3 Exam deletion and reset

There are three distinct admin operations.

#### Individual Student Reset

For one selected student:

- Delete that student's attempt for this exam
- Delete that student's saved responses
- Delete that student's exam result
- Remove derived exam-performance records for that attempt
- Keep the exam, questions, answer keys, code/password, and other students' data
- Allow the selected student to take a fresh attempt

#### Reset All Students

For the exam:

- Delete all student attempts
- Delete all responses
- Delete all results
- Remove all derived exam-performance records
- Keep the exam, questions, answer keys, code/password, and mapping
- Allow the assigned students to take the exam again

#### Delete Exam Completely

Delete the exam and every dependent record, including:

- exam access
- exam questions
- answer keys
- assignments
- attempts
- responses
- results
- derived performance records

This destructive action must use strong confirmation, including typing the Exam Code.

Existing database cascade relationships should be used where appropriate, but backend actions must remain admin-authorized and explicit.

## 4. Re-Exam

Re-Exam is a first-class admin action, not a manual database workaround.

### Selected Student Re-Exam

- Clear only the selected student's prior attempt/result/performance for this exam
- Keep the exam and questions unchanged
- Create fresh eligibility for a new attempt
- Timer starts fresh on the new attempt
- Previous answers must not carry over

### All Students Re-Exam

- Clear all assigned students' prior attempts/results/performance for this exam
- Keep the exam and questions unchanged
- Re-open a fresh attempt for the same assigned audience

The UI should make the difference between Reset, Re-Exam, and Delete Exam Completely clear.

## 5. Exam Attempt Reliability

The current production incident showed that a student can see answers as selected in the browser while some answers never reach the server. Therefore exam integrity requires the following protections.

### 5.1 Immediate auto-save

Selecting A/B/C/D should save that answer to the server immediately.

### 5.2 Server-confirmed visual state

A question should be shown as Answered only after the server confirms the save. Local browser state alone must not be treated as authoritative.

### 5.3 Save before navigation

Before navigating with Next, Previous, question palette, or review controls, any pending answer/review state must be saved.

### 5.4 Final full sync before grading

Before final submission, the client must send a complete snapshot of the current attempt responses to the server. The server must verify the sync before grading.

If local answered count and server-saved count disagree, grading must not proceed until the missing state is reconciled or the user receives a clear recoverable error.

### 5.5 Server remains source of truth

Timer, submission status, and grading remain server-authoritative.

## 6. Question Import and Range Mapping

Individual manual mapping for 180 questions is too risky and time-consuming. Use Range Mapping.

### 6.1 Excel import

Keep the current Questions sheet. Add mapping support either through a Mapping sheet in the Excel template or through the website after import.

Recommended Mapping fields:

- From Question No
- To Question No
- Subject
- Unit
- Chapter
- Topic
- Coverage: Full or Partial

Example:

- Q1-Q20 -> Physics -> Motion in a Plane -> Vectors -> Partial
- Q21-Q45 -> Physics -> Laws of Motion -> Friction -> Full
- Q46-Q80 -> Chemistry -> Thermodynamics -> Enthalpy -> Partial

### 6.2 Website range editor

After import, admin can add/edit ranges in the website without editing each question individually.

### 6.3 Validation

Before publish, show a Mapping Preview with:

- mapped question count
- unmapped question count
- overlapping ranges
- invalid ranges
- subject/unit/chapter/topic breakdown

An exam cannot be published while any question is unmapped or while ranges overlap incorrectly.

### 6.4 Source of truth

Each question ultimately receives resolved Subject -> Unit -> Chapter -> Topic metadata derived from the ranges. Performance calculations use question-level resolved mapping as the source of truth.

## 7. Automatic Online Exam Performance

A student must not manually enter an Academy online exam after submission.

Flow:

Exam Create -> Excel Import -> Range Mapping -> Publish -> Student Attempt -> Final Sync -> Submit -> Server Grading -> Automatic Performance Record

The system records:

- exam name
- date
- source = Online Academy Exam
- overall score and percentage
- correct/wrong/unattempted
- subject-wise performance
- unit-wise performance
- chapter-wise performance
- topic-wise performance
- Full/Partial coverage
- E1/E2/E3 sequence at the relevant syllabus level

### 7.1 E1/E2/E3

For the same student and same mapped syllabus scope, valid chronological exams are numbered E1, E2, E3, and so on.

If an exam or manual record is deleted/cancelled, it must no longer count in this sequence. Sequence presentation should be derived from valid records rather than permanently trusting a stale number.

Examples:

- Vectors: E1 64%, E2 78%, E3 86%
- Motion in a Plane: E1 312/400, E2 346/400

Partial coverage must be visibly labeled so a partial-topic test is not mistaken for a full-topic assessment.

## 8. Manual / Offline Exams

Students may enter offline/external exam records from their portal.

Recommended fields:

- Exam Name
- Date
- Subject
- Unit
- Chapter
- Topic
- Coverage: Full / Partial
- Marks Obtained
- Total Marks
- Optional note/source

For multi-subject or multi-topic offline exams, the data model must support multiple scope lines rather than forcing a single subject/topic.

### 8.1 Approval

Manual student entries remain Pending until Admin approves them.

Only approved manual exams count in official Exam Performance and E1/E2/E3 history.

Admin can:

- Approve
- Edit
- Reject
- Cancel/Delete individual entry
- Delete an offline exam for all linked students when appropriate

Cancelled/deleted records must disappear from official performance calculations.

## 9. Results Sub-Tab

Results should support:

- Submitted students list
- View answer review
- Analytics
- Publish result to individual student
- Publish results to all eligible students
- Re-Exam selected student
- Clear/Reset selected attempt
- Scorecard access

Result publication and exam assignment are separate concerns.

## 10. Exam Performance Sub-Tab

This is a dedicated sub-tab inside EXAMINATIONS.

### 10.1 Overview

Show at minimum:

- Student
- Total valid exams
- Average percentage
- Best percentage
- Latest exam

### 10.2 Student view

Drill down:

Subject -> Unit -> Chapter -> Topic

Show E1/E2/E3 progression, online/offline source, date, coverage, and score.

### 10.3 Exam view

Show:

- Exam name
- Assigned students
- Students who attempted
- Scores
- Correct/Wrong/Unattempted
- Subject breakdown
- Unit/Chapter/Topic breakdown

### 10.4 Filters

- Student
- Subject
- Unit
- Chapter
- Topic
- Online / Offline
- Date range

## 11. Data Integrity Rules

1. Online performance is derived from submitted server-side exam data; students never manually duplicate it.
2. Manual/offline performance counts only after admin approval.
3. Deleting or resetting an exam attempt removes the corresponding derived performance.
4. Deleting an entire exam removes all corresponding performance.
5. Question mapping must be complete before publish.
6. Performance denominator must be consistent with actual mapped question marks.
7. Exam-level negative-marking configuration must agree with grading behavior. If negative marking is disabled, grading must not deduct per-question negative marks.
8. Final submit must not grade until the server has synchronized the full answer state.
9. Admin actions that remove attempts/results must be explicit, auditable, and scoped to individual student or all students.

## 12. Migration Strategy

Implement incrementally to protect the existing stable live site.

Suggested phases:

1. Exam answer reliability: auto-save, server-confirmed state, final full sync
2. Assignment model: Publish to All / Selected Students
3. Individual/All reset and re-exam actions
4. Range Mapping and publish validation
5. Automatic performance derivation
6. Manual/offline exam entry and admin approval
7. Unified EXAMINATIONS navigation and Exam Performance UI
8. Result publication improvements and final cleanup

Each phase should be independently tested before moving to the next.

## 13. Success Criteria

The design is successful when:

- no student can lose selected answers silently
- admin never needs Supabase for routine exam recovery
- one student's technical issue can be reset without affecting others
- exams can be published to all or selected students
- re-exams can be conducted for one or all students
- mixed-subject and partial-topic exams produce correct syllabus-level performance
- Academy online exams enter performance automatically
- offline exams can be manually entered, approved, edited, and deleted
- deleting/cancelling an exam removes it from official performance
- admin can understand all exam history from one EXAMINATIONS area
