import assert from 'node:assert/strict';
import { validateSnapshotCoverage } from './supabase/functions/student-exam-attempt/sync-logic.mjs';

const ids=['q1','q2','q3'];
const valid=validateSnapshotCoverage(ids,[
  {questionId:'q1',selectedOption:'a',markedForReview:false},
  {questionId:'q2',selectedOption:null,markedForReview:true},
  {questionId:'q3',selectedOption:'D',markedForReview:false}
]);
assert.equal(valid.ok,true);
assert.deepEqual(valid.rows,[
  {question_id:'q1',selected_option:'A',marked_for_review:false},
  {question_id:'q2',selected_option:null,marked_for_review:true},
  {question_id:'q3',selected_option:'D',marked_for_review:false}
]);

assert.equal(validateSnapshotCoverage(ids,[
  {questionId:'q1',selectedOption:'A',markedForReview:false},
  {questionId:'q2',selectedOption:'B',markedForReview:false}
]).ok,false);

assert.equal(validateSnapshotCoverage(ids,[
  {questionId:'q1',selectedOption:'A',markedForReview:false},
  {questionId:'q1',selectedOption:'B',markedForReview:false},
  {questionId:'q3',selectedOption:'C',markedForReview:false}
]).ok,false);

assert.equal(validateSnapshotCoverage(ids,[
  {questionId:'q1',selectedOption:'A',markedForReview:false},
  {questionId:'q2',selectedOption:'X',markedForReview:false},
  {questionId:'q3',selectedOption:'C',markedForReview:false}
]).ok,false);

assert.equal(validateSnapshotCoverage(ids,[
  {questionId:'q1',selectedOption:'A',markedForReview:false},
  {questionId:'q2',selectedOption:'B',markedForReview:false},
  {questionId:'outside',selectedOption:'C',markedForReview:false}
]).ok,false);

console.log('exam submit snapshot validation tests passed');
