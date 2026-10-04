import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

test('legacy Question Bank data is preserved but not used for new exam imports', () => {
  const legacy = read('QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql');
  const retire = read('QUESTION_BANK_RETIREMENT_MIGRATION.sql');
  assert.match(legacy,/create table if not exists public\.question_bank_questions/i);
  assert.match(retire,/Legacy Question Bank retained for historical compatibility/i);
  assert.doesNotMatch(retire,/drop table|truncate|delete from/i);
});

test('Question Bank auto-sync trigger is retired for future exams',()=>{
  const sql=read('QUESTION_BANK_RETIREMENT_MIGRATION.sql');
  assert.match(sql,/drop trigger if exists exam_question_map_sync_bank on public\.exam_question_syllabus_map/i);
});

test('exam Excel template remains syllabus-aware for automatic mapping', () => {
  const js = read('admin-exam-questions.js');
  for (const header of ['Subject','Unit','Chapter','Topic','Difficulty','Question Type','Source','Source Year']) {
    assert.ok(js.includes('"'+header+'"') || js.includes("'"+header+"'"), 'missing '+header+' header');
  }
  assert.match(js,/action:["']bulk_import["']/);
  assert.match(js,/auto-map|AUTO MAPPED/i);
});

test('protected import API allows Excel bulk import and retires Question Bank actions', () => {
  const edge=read('supabase/functions/admin-question-bank/index.ts');
  assert.match(edge,/profile\.role!==["']admin["']/);
  assert.match(edge,/action!==["']bulk_import["']/);
  assert.match(edge,/Question Bank is retired/);
  assert.match(edge,/import_exam_questions_direct/);
  const bulk=edge.slice(edge.indexOf("action==='bulk_import'"),edge.indexOf("action==='add_to_exam'"));
  assert.doesNotMatch(bulk,/import_exam_questions_to_bank/);
});

test('direct Excel import writes exam snapshot key and mapping without bank storage',()=>{
  const sql=read('EXAM_EXCEL_DIRECT_IMPORT_MIGRATION.sql');
  assert.match(sql,/insert into public\.exam_questions/i);
  assert.match(sql,/insert into public\.exam_answer_keys/i);
  assert.match(sql,/insert into public\.exam_question_syllabus_map/i);
  assert.doesNotMatch(sql,/insert into public\.question_bank_questions/i);
  assert.match(sql,/physics_question_count/);
  assert.match(sql,/chemistry_question_count/);
  assert.match(sql,/biology_question_count/);
});

test('exam page loads downloadable Blueprint PDF action and protected data API', () => {
  const nav=read('admin-examinations-nav.js'),blueprint=read('admin-exam-blueprint.js'),edge=read('supabase/functions/admin-exam-blueprint/index.ts');
  assert.ok(blueprint.length > 0, 'blueprint module is missing');
  assert.match(blueprint, /BLUEPRINT/i);
  assert.match(blueprint, /jspdf/i);
  assert.match(nav,/jspdf@/i);assert.match(nav,/jspdf-autotable@/i);assert.match(nav,/admin-exam-blueprint\.js/);
  assert.match(edge,/Admin access required/);assert.match(edge,/exam_code/);assert.doesNotMatch(edge,/password_hash/);
});

test('Blueprint reuses canonical mapping validation without exposing answer keys', () => {
  const edge=read('supabase/functions/admin-exam-blueprint/index.ts');
  assert.match(edge,/validateExamMapping/);
  assert.match(edge,/\.in\(["']question_id["'],\s*questionIds\)/);
  assert.match(edge,/publishReady:\s*coreValidation\.ok/);
  assert.doesNotMatch(edge,/correct_option[^\n]*return json/i);
});
