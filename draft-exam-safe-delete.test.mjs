import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const control=fs.readFileSync('admin-exam-control-center.js','utf8');
const edge=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8');

test('control center exposes destructive delete only for draft exams and confirms exact exam code',()=>{
  assert.match(control,/x\.state==='draft'[\s\S]*data-delete-draft/);
  assert.match(control,/DELETE DRAFT EXAM[\s\S]*Exam Code/);
  assert.match(control,/action:'delete'[\s\S]*confirmCode/);
});

test('admin-exams delete endpoint blocks published, non-draft, attempted, or result-bearing exams before deletion',()=>{
  assert.match(edge,/Only draft exams can be deleted/);
  assert.match(edge,/Published exams cannot be deleted/);
  assert.match(edge,/Draft exam cannot be deleted after an attempt exists/);
  assert.match(edge,/Draft exam cannot be deleted after a result exists/);
  assert.match(edge,/Type the exact Exam Code to delete this exam/);
});
