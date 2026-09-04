import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const path=new URL('./supabase/functions/exam-performance/index.ts',import.meta.url);
const src=fs.readFileSync(path,'utf8');

test('performance API exposes protected admin, student and rebuild actions',()=>{
  assert.match(src,/action === 'admin_list'/);
  assert.match(src,/action === 'student_list'/);
  assert.match(src,/action === 'rebuild_exam'/);
  assert.match(src,/exam_scope_performance_sequenced/);
  assert.match(src,/buildScopePerformance/);
  assert.match(src,/validateExamMapping/);
  assert.match(src,/is_published/);
});

test('performance API exposes student-first admin actions',()=>{
  assert.match(src,/action === 'admin_students'/);
  assert.match(src,/action === 'admin_student_detail'/);
  assert.match(src,/admin-student-performance\.mjs/);
  assert.match(src,/buildQuestionSubjectMap/);
  assert.match(src,/buildSubjectAttempt/);
  assert.match(src,/buildStudentExamMonitor/);
});

test('admin detail computes aggregates server-side without returning answer keys',()=>{
  assert.match(src,/exam_answer_keys/);
  assert.match(src,/exam_responses/);
  assert.match(src,/subjectAttempts/);
  assert.match(src,/profile:\{id:profile\.id/);
  assert.doesNotMatch(src,/return \{[\s\S]{0,260}answerKeys/);
});
