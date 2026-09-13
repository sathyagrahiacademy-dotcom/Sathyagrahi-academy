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

test('Exams page keeps syllabus scripts and contains the gated Control Center path',()=>{
  assert.match(html,/admin-examinations-nav\.js\?v=20260910-5/);
  assert.match(html,/exam-scope-ui-utils\.js\?v=20260905-1/);
  assert.match(nav,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED/);
  assert.match(nav,/exam-control-center-ui\.js\?v=20260908-1/);
  assert.match(nav,/admin-exam-control-center\.js\?v=20260913-1/);
  assert.match(nav,/admin-exam-credentials-ui\.js\?v=20260913-1/);
});

test('legacy archive overlay remains the default production path while master gate is off',()=>{
  const legacy=fs.readFileSync('admin-exams-enhancements.js','utf8');
  assert.match(legacy,/Current Exams/);
  assert.match(nav,/adminExamsEnhancements/);
  assert.match(nav,/admin-exams-enhancements\.js/);
  assert.match(nav,/if\s*\(masterPhase1Enabled\)[\s\S]*else[\s\S]*adminExamsEnhancements/);
});

test('master conducted grouping is exam-date based',()=>{
  assert.match(control,/groupConductedByMonth/);
  assert.match(control,/monthKey\(x\?\.examDate\)/);
  assert.doesNotMatch(control,/submitted_at|firstSubmittedAt/);
});
