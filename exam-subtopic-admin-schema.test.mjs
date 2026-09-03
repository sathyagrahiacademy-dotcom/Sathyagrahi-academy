import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=(fs.readFileSync('EXAM_MAPPING_PERFORMANCE_MIGRATION.sql','utf8')+'\n'+fs.readFileSync('EXAM_SUBTOPIC_ADMIN_RPC_MIGRATION.sql','utf8')).toLowerCase();

test('merge subtopics is atomic and service only',()=>{
  assert.match(sql,/create\s+or\s+replace\s+function\s+merge_exam_subtopics/i);
  assert.match(sql,/update\s+exam_mapping_groups[\s\S]+subtopic_id/i);
  assert.match(sql,/update\s+exam_question_syllabus_map[\s\S]+subtopic_id/i);
  assert.match(sql,/grant\s+execute\s+on\s+function\s+merge_exam_subtopics[\s\S]+service_role/i);
});

test('split subtopic is atomic and refuses mapped sources',()=>{
  assert.match(sql,/create\s+or\s+replace\s+function\s+split_exam_subtopic/i);
  assert.match(sql,/exam_mapping_groups[\s\S]+raise\s+exception[\s\S]+mapped/i);
  assert.match(sql,/grant\s+execute\s+on\s+function\s+split_exam_subtopic[\s\S]+service_role/i);
});
