import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fnPath='supabase/functions/student-result-review/index.ts';
const uiPath='student-results.js';
const htmlPath='student-results.html';

const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';

test('student result review edge function is versioned in repo',()=>{
  assert.ok(fs.existsSync(fnPath),'student-result-review Edge Function is not versioned in the repo');
});

test('answer keys remain hidden until ownership and published-result checks pass',()=>{
  const src=read(fnPath);
  const ownership=src.indexOf('attempt.student_id!==user.id');
  const published=src.indexOf('!result.is_published');
  const keys=src.indexOf("exam_answer_keys");
  assert.ok(ownership>=0,'ownership guard missing');
  assert.ok(published>=0,'published-result guard missing');
  assert.ok(keys>=0,'answer key load missing');
  assert.ok(ownership<keys,'answer keys must load only after ownership check');
  assert.ok(published<keys,'answer keys must load only after result publication check');
});

test('review response enriches snapshot questions with mapped topic and server-owned activity',()=>{
  const src=read(fnPath);
  assert.match(src,/difficulty,question_type,bank_question_id/);
  assert.match(src,/exam_question_syllabus_map/);
  assert.match(src,/neet_syllabus_subtopics/);
  assert.match(src,/subtopic_title/);
  assert.match(src,/exam_question_activity/);
  assert.match(src,/active_seconds/);
  assert.match(src,/visit_count/);
  assert.match(src,/answer_change_count/);
  assert.match(src,/topic:/);
});

test('answered paper UI shows all options and evidence metadata',()=>{
  const js=read(uiPath),html=read(htmlPath);
  assert.match(html,/student-answer-review-utils\.js/);
  assert.match(js,/sgaStudentAnswerReview/);
  assert.match(js,/Option A/);
  assert.match(js,/Option B/);
  assert.match(js,/Option C/);
  assert.match(js,/Option D/);
  assert.match(js,/Difficulty/);
  assert.match(js,/Topic/);
  assert.match(js,/Active Time/);
  assert.match(js,/Visits/);
  assert.match(js,/Answer Changes/);
});

test('answer paper PDF carries topic difficulty time and answer-change evidence',()=>{
  const js=read(uiPath);
  assert.match(js,/Topic/);
  assert.match(js,/Difficulty/);
  assert.match(js,/Time/);
  assert.match(js,/Changes/);
  assert.match(js,/activeTime/);
});
