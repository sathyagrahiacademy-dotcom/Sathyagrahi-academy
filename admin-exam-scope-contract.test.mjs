import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8');

test('admin exams exposes scope tree and scope read actions',()=>{
  assert.match(src,/action === 'scope_tree'/);
  assert.match(src,/action === 'get_scope'/);
  assert.match(src,/neet_syllabus_units/);
  assert.match(src,/neet_syllabus_subtopics/);
});

test('create and update persist canonical scope through v2 atomic RPC',()=>{
  assert.match(src,/scopeItems/);
  assert.match(src,/normaliseExamScopeDraftV2/);
  assert.match(src,/replace_exam_scope_items_v2/);
  assert.match(src,/p_created_by/);
});

test('scope tree exposes active suggestions but hides disabled topics',()=>{
  assert.match(src,/neet_syllabus_subtopics[^\n]+\.neq\(['"]status['"],['"]disabled['"]\)/);
});

test('get scope enriches canonical rows for v2 editor',()=>{
  assert.match(src,/scopeType/);
  assert.match(src,/topicName/);
  assert.match(src,/subtopicTitle/);
  assert.match(src,/subject/);
});
