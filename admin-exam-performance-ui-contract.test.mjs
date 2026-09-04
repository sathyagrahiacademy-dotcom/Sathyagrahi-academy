import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('admin-performance.html','utf8');
const js=fs.readFileSync('admin-performance.js','utf8');

test('page is student-first with left list and right detail host',()=>{
  assert.match(html,/id="studentSearch"/);
  assert.match(html,/id="studentList"/);
  assert.match(html,/id="studentDetail"/);
  assert.match(html,/examSectionNav/);
  assert.match(html,/admin-examinations-nav\.js/);
});

test('old generic academy analytics are removed',()=>{
  assert.doesNotMatch(html,/Academy Average/);
  assert.doesNotMatch(html,/Weakness Analysis/);
  assert.doesNotMatch(html,/Subject-wise Performance/);
});

test('controller uses protected student-first performance actions only',()=>{
  assert.match(js,/admin_students/);
  assert.match(js,/admin_student_detail/);
  assert.match(js,/detail\.subjects/);
  assert.match(js,/rebuild_exam/);
  assert.doesNotMatch(js,/\.from\(['"]exam_results['"]\)/);
});

test('subject attempts and exact E history have dedicated render paths',()=>{
  assert.match(js,/subjectHistory/);
  assert.match(js,/subjectScopeHierarchy/);
  assert.match(js,/attemptLabel/);
  assert.match(js,/formatEHistoryRow/);
});
