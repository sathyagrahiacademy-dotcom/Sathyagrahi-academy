import assert from 'node:assert/strict';
import { decideAttempt } from './supabase/functions/student-exam-attempt/attempt-policy.mjs';

assert.deepEqual(decideAttempt([],1),{action:'create',attemptNo:1});
assert.equal(decideAttempt([{id:'a1',attempt_no:1,status:'in_progress'}],1).action,'resume');
assert.equal(decideAttempt([{id:'a1',attempt_no:1,status:'submitted'}],1).action,'block');
assert.deepEqual(decideAttempt([{id:'a1',attempt_no:1,status:'submitted'}],2),{action:'create',attemptNo:2});
assert.deepEqual(decideAttempt([
  {id:'a1',attempt_no:1,status:'submitted'},
  {id:'a3',attempt_no:3,status:'submitted'}
],3),{action:'create',attemptNo:4});
assert.equal(decideAttempt([
  {id:'a1',attempt_no:1,status:'submitted'},
  {id:'a2',attempt_no:2,status:'in_progress'}
],2).attempt.id,'a2');

console.log('exam attempt policy tests passed');
