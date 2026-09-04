import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

test('migration defines permanent central question bank and exam snapshot link', () => {
  const sql = read('QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql');
  assert.match(sql, /create table if not exists public\.question_bank_questions/i);
  assert.match(sql, /bank_question_id[\s\S]*references public\.question_bank_questions/i);
  assert.match(sql, /on delete set null/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.question_bank_questions from anon, authenticated/i);
  assert.match(sql, /import_exam_questions_to_bank/i);
  assert.match(sql, /add_bank_questions_to_exam/i);
});

test('manual canonical mappings automatically sync mapped questions to permanent bank', () => {
  const sql=read('QUESTION_BANK_MAPPING_SYNC_TRIGGER_MIGRATION.sql');
  assert.match(sql,/create trigger exam_question_map_sync_bank/i);
  assert.match(sql,/after insert or update of subtopic_id on public\.exam_question_syllabus_map/i);
  assert.match(sql,/question_bank_questions/i);
  assert.match(sql,/bank_question_id/i);
});

test('exam Excel template is syllabus-aware for automatic mapping', () => {
  const js = read('admin-exam-questions.js');
  for (const header of ['Subject','Unit','Chapter','Topic','Difficulty','Question Type','Source','Source Year']) {
    assert.ok(js.includes(`"${header}"`) || js.includes(`'${header}'`), `missing ${header} header`);
  }
  assert.match(js, /admin-question-bank/);
  assert.match(js, /action:["']bulk_import["']/);
  assert.match(js, /automatic mapping/i);
});

test('protected central Question Bank API owns list import reuse and sync actions', () => {
  const edge=read('supabase/functions/admin-question-bank/index.ts');
  assert.match(edge,/profile\.role!==['"]admin['"]/);
  assert.match(edge,/action===['"]list['"]/);
  assert.match(edge,/action===['"]bulk_import['"]/);
  assert.match(edge,/action===['"]add_to_exam['"]/);
  assert.match(edge,/import_exam_questions_to_bank/);
  assert.match(edge,/add_bank_questions_to_exam/);
});

test('question bank reads protected central-bank API instead of exam_questions directly', () => {
  const js = read('admin-question-bank.js');
  assert.match(js, /functions\.invoke\(['"]admin-question-bank['"]/);
  assert.doesNotMatch(js, /from\(['"]exam_questions['"]\)/);
  assert.match(js,/unitTitle/);assert.match(js,/chapterTitle/);assert.match(js,/topicTitle/);
});

test('exam page loads downloadable Blueprint PDF action and protected data API', () => {
  const nav=read('admin-examinations-nav.js'),blueprint=read('admin-exam-blueprint.js'),edge=read('supabase/functions/admin-exam-blueprint/index.ts');
  assert.ok(blueprint.length > 0, 'blueprint module is missing');
  assert.match(blueprint, /BLUEPRINT/i);
  assert.match(blueprint, /jspdf/i);
  assert.match(nav,/jspdf@/i);assert.match(nav,/jspdf-autotable@/i);assert.match(nav,/admin-exam-blueprint\.js/);
  assert.match(edge,/Admin access required/);assert.match(edge,/exam_code/);assert.doesNotMatch(edge,/password_hash/);
});
