import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('EXAMINATIONS_MASTER_PHASE2_MIGRATION.sql','utf8');

test('Phase 2 DB invalidates Blueprint approval when setup facts mutate',()=>{
  assert.match(sql,/create\s+or\s+replace\s+function\s+public\.invalidate_exam_blueprint_approval/i);
  assert.match(sql,/blueprint_approved_at\s*=\s*null/i);
  for(const table of ['exam_scope_items','exam_questions','exam_answer_keys','exam_question_syllabus_map']){
    assert.match(sql,new RegExp(`after\\s+insert\\s+or\\s+update\\s+or\\s+delete\\s+on\\s+public\\.${table}`,'i'),`missing Blueprint invalidation trigger for ${table}`);
  }
});

test('invalidation only affects unpublished setup exams',()=>{
  assert.match(sql,/is_published\s*=\s*false/i);
  assert.match(sql,/blueprint_approved_at\s+is\s+not\s+null/i);
});
