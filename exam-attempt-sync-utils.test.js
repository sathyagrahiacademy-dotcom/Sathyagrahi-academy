const assert = require('assert');
const u = require('./exam-attempt-sync-utils.js');

(async()=>{
  const questions = [{id:'q1'},{id:'q2'},{id:'q3'}];
  const responses = {
    q1:{selected_option:'b',marked_for_review:false},
    q2:{selected_option:null,marked_for_review:true}
  };

  const snapshot = u.buildFullSnapshot(questions,responses);
  assert.deepStrictEqual(snapshot,[
    {questionId:'q1',selectedOption:'B',markedForReview:false},
    {questionId:'q2',selectedOption:null,markedForReview:true},
    {questionId:'q3',selectedOption:null,markedForReview:false}
  ]);
  assert.deepStrictEqual(u.snapshotQuestionIds(snapshot),['q1','q2','q3']);
  assert.strictEqual(u.statusForQuestion({questionId:'q1',response:responses.q1,visited:true,confirmedCurrent:false}),'notanswered');
  assert.strictEqual(u.statusForQuestion({questionId:'q1',response:responses.q1,visited:true,confirmedCurrent:true}),'answered');
  assert.strictEqual(u.statusForQuestion({questionId:'q2',response:responses.q2,visited:true,confirmedCurrent:true}),'review');
  assert.strictEqual(u.normaliseAnswer('d'),'D');
  assert.strictEqual(u.normaliseAnswer(''),null);

  const writes=[];
  const confirmed={};
  const queue=u.createSaveQueue(async(questionId,state)=>{
    writes.push(state.selected_option);
    await new Promise(resolve=>setTimeout(resolve,state.selected_option==='A'?20:1));
    confirmed[questionId]={...state};
  });
  queue.enqueue('q1',{selected_option:'A',marked_for_review:false});
  queue.enqueue('q1',{selected_option:'B',marked_for_review:false});
  await queue.flush('q1');
  assert.deepStrictEqual(writes,['A','B']);
  assert.strictEqual(confirmed.q1.selected_option,'B');
  assert.strictEqual(queue.hasPending(),false);

  console.log('exam-attempt-sync-utils tests passed');
})().catch(err=>{console.error(err);process.exit(1)});
