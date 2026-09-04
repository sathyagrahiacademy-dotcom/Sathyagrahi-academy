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
  assert.match(sql, /import_exam_questions_to_bank/i);
  assert.match(sql, /add_bank_questions_to_exam/i);
});

test('exam Excel template is syllabus-aware for automatic mapping', () => {
  const js = read('admin-exam-questions.js');
  for (const header of ['Subject','Unit','Chapter','Topic','Difficulty','Question Type','Source','Source Year']) {
    assert.ok(js.includes(`"${header}"`) || js.includes(`'${header}'`), `missing ${header} header`);
  }
  assert.match(js, /subject:/i);
  assert.match(js, /unit:/i);
  assert.match(js, /chapter:/i);
  assert.match(js, /topic:/i);
});

test('question bank reads a protected central-bank API instead of exam_questions directly', () => {
  const js = read('admin-question-bank.js');
  assert.match(js, /functions\.invoke\(["']admin-question-bank["']/);
  assert.doesNotMatch(js, /from\(["']exam_questions["']\)/);
});

test('exam page exposes downloadable Blueprint PDF action', () => {
  const html = read('admin-exams.html');
  const blueprint = read('admin-exam-blueprint.js');
  assert.ok(blueprint.length > 0, 'blueprint module is missing');
  assert.match(blueprint, /BLUEPRINT/i);
  assert.match(blueprint, /jspdf/i);
  assert.match(html, /admin-exam-blueprint\.js/);
});
