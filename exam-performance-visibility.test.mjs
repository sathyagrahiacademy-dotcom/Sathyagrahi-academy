import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadPerformance } from './supabase/functions/exam-performance/visibility-policy.mjs';

test('admin can read published or unpublished performance',()=>{
  assert.equal(canReadPerformance({requesterRole:'admin',requesterId:'a',rowStudentId:'s',resultPublished:false}),true);
  assert.equal(canReadPerformance({requesterRole:'admin',requesterId:'a',rowStudentId:'s',resultPublished:true}),true);
});
test('student can read only own published performance',()=>{
  assert.equal(canReadPerformance({requesterRole:'student',requesterId:'s1',rowStudentId:'s1',resultPublished:true}),true);
  assert.equal(canReadPerformance({requesterRole:'student',requesterId:'s1',rowStudentId:'s1',resultPublished:false}),false);
  assert.equal(canReadPerformance({requesterRole:'student',requesterId:'s1',rowStudentId:'s2',resultPublished:true}),false);
});
