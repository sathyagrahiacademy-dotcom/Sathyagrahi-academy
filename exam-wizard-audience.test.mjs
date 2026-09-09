import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('.',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');

test('dedicated wizard service exposes student and audience actions',async()=>{
  const src=await read('supabase/functions/admin-exam-wizard/index.ts');
  for(const token of ['master_students','save_master_audience','activeStudents','assignmentMap','applyAudience']) assert.ok(src.includes(token),`missing ${token}`);
  assert.match(src,/action\s*===\s*['"]master_students['"]/);
  assert.match(src,/action\s*===\s*['"]save_master_audience['"]/);
});

test('master student list is active-only and reports assigned count',async()=>{
  const src=await read('supabase/functions/admin-exam-wizard/index.ts');
  assert.match(src,/eq\(['"]role['"],['"]student['"]\)\.eq\(['"]is_active['"],true\)/);
  assert.ok(src.includes('assignedCount'));
  assert.ok(src.includes('assigned:Boolean'));
});

test('wizard Step 5 companion exposes approved audience modes and operator controls',async()=>{
  const src=await read('admin-exam-wizard-release.js');
  for(const token of ['ALL ACTIVE STUDENTS','SELECTED STUDENTS','SELECT ALL','CLEAR ALL','mwAudienceSearch','mwAudienceRows','mwAssignedCount','master_students','save_master_audience']) assert.ok(src.includes(token),`missing ${token}`);
});

test('wizard Step 5 refuses to continue with zero assigned students',async()=>{
  const src=await read('admin-exam-wizard-release.js');
  assert.match(src,/assignedCount[^\n]{0,140}<=?0|assignedCount[^\n]{0,140}<\s*1/);
  assert.match(src,/Select at least one student|assign at least one student/i);
});
