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

test('create and update persist canonical scope through RPC',()=>{
  assert.match(src,/scopeItems/);
  assert.match(src,/replace_exam_scope_items/);
});