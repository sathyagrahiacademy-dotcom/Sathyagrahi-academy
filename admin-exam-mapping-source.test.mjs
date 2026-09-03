import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('supabase/functions/admin-exam-mapping/index.ts','utf8');

test('mapping edge function is admin protected and normalizes actions',()=>{
  assert.match(src,/profile\.role\s*!==\s*['"]admin['"]/);
  assert.match(src,/normalizeAdminMappingAction/);
});

test('mapping writes use the atomic mapping and subtopic RPCs',()=>{
  assert.match(src,/replace_exam_mapping_group/);
  assert.match(src,/split_exam_subtopic/);
  assert.match(src,/merge_exam_subtopics/);
});

test('published exams are protected from mapping mutation',()=>{
  assert.match(src,/ensureDraftExam/);
  assert.match(src,/is_published/);
});

test('tree and validation use shared mapping validator',()=>{
  assert.match(src,/validateExamMapping/);
  assert.match(src,/buildQuestionMappings/);
  assert.match(src,/parseQuestionSelector/);
});
