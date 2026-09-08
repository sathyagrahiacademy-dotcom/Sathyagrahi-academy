import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('exam-scope-ui-utils.js','utf8');
const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const html=fs.readFileSync('admin-exams.html','utf8');
const control=fs.readFileSync('exam-control-center-ui.js','utf8');

test('V2 syllabus controller has the active topic helper it calls',()=>{
  assert.match(helper,/activeSubtopicsForChapter/);
});

test('Exams page keeps syllabus scripts and loads the new Control Center from branch navigation',()=>{
  assert.match(html,/admin-examinations-nav\.js\?v=20260905-1/);
  assert.match(html,/exam-scope-ui-utils\.js\?v=20260905-1/);
  assert.match(nav,/exam-control-center-ui\.js\?v=20260908-1/);
  assert.match(nav,/admin-exam-control-center\.js\?v=20260908-1/);
  assert.doesNotMatch(nav,/admin-exams-enhancements\.js/);
});

test('legacy archive overlay is retained as source history but no longer owns Exams navigation',()=>{
  const legacy=fs.readFileSync('admin-exams-enhancements.js','utf8');
  assert.match(legacy,/Current Exams/);
  assert.doesNotMatch(nav,/adminExamsEnhancements/);
});

test('master conducted grouping is exam-date based',()=>{
  assert.match(control,/groupConductedByMonth/);
  assert.match(control,/monthKey\(x\?\.examDate\)/);
  assert.doesNotMatch(control,/submitted_at|firstSubmittedAt/);
});
