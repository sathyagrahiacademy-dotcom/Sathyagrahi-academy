import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fn=fs.readFileSync('supabase/functions/exam-performance/index.ts','utf8');
const ui=fs.readFileSync('student-performance.js','utf8');
const html=fs.readFileSync('student-performance.html','utf8');

test('student intelligence action is student-only and bound to authenticated user',()=>{
  assert.match(fn,/action === ['"]student_intelligence['"]/);
  assert.match(fn,/profile\.role !== ['"]student['"]/);
  assert.match(fn,/loadStudentIntelligence\(admin,user\.id\)/);
});

test('student intelligence reads only published-result attempts before building evidence',()=>{
  assert.match(fn,/exam_results/);
  assert.match(fn,/is_published/);
  assert.match(fn,/publishedAttemptIds/);
  assert.match(fn,/exam_question_activity/);
  assert.match(fn,/question_bank_questions/);
  assert.match(fn,/bank_question_id/);
});

test('student intelligence may use answer keys internally but never returns them',()=>{
  assert.match(fn,/exam_answer_keys/);
  const returnSlice=fn.slice(fn.indexOf('async function loadStudentIntelligence'));
  assert.doesNotMatch(returnSlice,/answerKeys\s*:/);
  assert.doesNotMatch(returnSlice,/correct_option\s*:/);
});

test('student performance UI requests intelligence and preserves existing syllabus E-history',()=>{
  assert.match(ui,/action:['"]student_intelligence['"]/);
  assert.match(ui,/student_list/);
  assert.match(ui,/Bank Coverage/);
  assert.match(ui,/Repeat Exposure/);
  assert.match(ui,/Retention Watch/);
  assert.match(ui,/Difficulty/);
  assert.match(ui,/Next Exam Focus/);
  assert.match(html,/examDrill/);
});

test('mentor layer presents evidence-backed strengths weaknesses speed retention coverage and focus',()=>{
  assert.match(ui,/Strengths/);
  assert.match(ui,/Priority Weaknesses/);
  assert.match(ui,/Speed Issues/);
  assert.match(ui,/Retention Watch/);
  assert.match(ui,/Coverage Gaps/);
  assert.match(ui,/Next Exam Focus/);
  assert.match(ui,/evidence/);
});
