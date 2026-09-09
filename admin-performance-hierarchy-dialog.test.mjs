import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./exam-performance-ui-utils.js');

const scope={
  attempt_id:'a2',exam_id:'e1',exam_sequence:2,scope_level:'topic',coverage:'partial',
  unit_id:1,unit_title:'Physics and Measurement',chapter_id:11,chapter_title:'Units and systems of units',subtopic_id:101,subtopic_title:'International System of Units',
  question_count:4,earned_marks:12,max_marks:16,percentage:75,correct_count:3,wrong_count:1,unattempted_count:0
};
const history=[
  {attempt_id:'a1',exam_id:'e1',attempt_no:1,exam_title:'Daily Test 01',exam_code:'SGA-DT-010809',exam_date:'2026-09-08',resultPublished:true},
  {attempt_id:'a2',exam_id:'e1',attempt_no:2,exam_title:'Daily Test 01 Reattempt',exam_code:'SGA-DT-010809',exam_date:'2026-09-09',resultPublished:false}
];

test('E chip is compact and exact scope dialog joins by attempt id',()=>{
  assert.equal(u.eChipLabel(scope),'E2');
  const m=u.eDialogModel(scope,history);
  assert.equal(m.attemptId,'a2');
  assert.equal(m.examTitle,'Daily Test 01 Reattempt');
  assert.equal(m.examCode,'SGA-DT-010809');
  assert.equal(m.examDate,'2026-09-09');
  assert.equal(m.attemptNo,2);
  assert.equal(m.questionCount,4);
  assert.equal(m.earnedMarks,12);
  assert.equal(m.maxMarks,16);
  assert.equal(m.percentage,75);
  assert.equal(m.correct,3);assert.equal(m.wrong,1);assert.equal(m.unattempted,0);
  assert.equal(m.resultPublished,false);
  assert.equal(m.scopeLabel,'International System of Units');
  assert.equal(m.scopePath,'Physics and Measurement → Units and systems of units → International System of Units');
});

test('performance page uses clean subject tabs hierarchy and a single E dialog',()=>{
  const html=fs.readFileSync('admin-performance.html','utf8');
  assert.match(html,/id="performanceSubjectTabs"/);
  assert.match(html,/id="performanceHierarchy"/);
  assert.match(html,/id="eHistoryDialog"/);
  assert.match(html,/id="eDialogContent"/);
  assert.doesNotMatch(html,/class="subject-cards"/);
  assert.doesNotMatch(html,/id="attemptBox"/);
});

test('controller opens clickable E scope and Full Result deep links exact attempt',()=>{
  const js=fs.readFileSync('admin-performance.js','utf8');
  assert.match(js,/data-e-scope/);
  assert.match(js,/openEDialog/);
  assert.match(js,/admin-results\.html\?attempt=/);
  assert.match(js,/data-dialog-close/);
});
