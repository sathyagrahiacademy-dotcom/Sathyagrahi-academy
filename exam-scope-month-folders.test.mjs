import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('exam-scope-ui-utils.js','utf8');
const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const html=fs.readFileSync('admin-exams.html','utf8');

test('V2 syllabus controller has the active topic helper it calls',()=>{
  assert.match(helper,/activeSubtopicsForChapter/);
});

test('Exams page loads the cache-busted scope and archive enhancement scripts',()=>{
  assert.match(html,/admin-examinations-nav\.js\?v=20260905-1/);
  assert.match(html,/exam-scope-ui-utils\.js\?v=20260905-1/);
  assert.match(nav,/admin-exams-enhancements\.js\?v=20260905-1/);
});

test('Exams enhancement owns the blended Exam Coverage label and conducted folders',()=>{
  const src=fs.readFileSync('admin-exams-enhancements.js','utf8');
  assert.match(src,/Exam Coverage/);
  assert.match(src,/Current Exams/);
  assert.match(src,/exam_attempts/);
  assert.match(src,/submitted_at/);
  assert.match(src,/MutationObserver/);
});

test('conducted exams are grouped by first valid submitted month',async()=>{
  const mod=await import('./exam-archive-utils.mjs');
  const exams=[{id:'draft',title:'Draft'},{id:'aug',title:'August'},{id:'sep',title:'September'},{id:'inprogress',title:'In Progress'}];
  const attempts=[
    {exam_id:'aug',status:'submitted',submitted_at:'2026-08-25T10:20:31Z'},
    {exam_id:'aug',status:'submitted',submitted_at:'2026-08-26T10:20:31Z'},
    {exam_id:'sep',status:'submitted',submitted_at:'2026-09-04T18:00:00Z'},
    {exam_id:'inprogress',status:'in_progress',submitted_at:null}
  ];
  const grouped=mod.groupExamArchive(exams,attempts);
  assert.deepEqual(grouped.current.map(x=>x.id),['draft','inprogress']);
  assert.equal(grouped.months[0].label,'September 2026');
  assert.deepEqual(grouped.months[0].exams.map(x=>x.id),['sep']);
  assert.equal(grouped.months[1].label,'August 2026');
  assert.deepEqual(grouped.months[1].exams.map(x=>x.id),['aug']);
  assert.equal(grouped.months[1].conductedAt,'2026-08-25T10:20:31.000Z');
});
