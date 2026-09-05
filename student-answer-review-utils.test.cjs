const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const path='student-answer-review-utils.js';

test('answered paper utility exists',()=>{
  assert.ok(fs.existsSync(path),'student answer review utility is missing');
});

function load(){
  if(!fs.existsSync(path))return null;
  const code=fs.readFileSync(path,'utf8');
  const sandbox={window:{}};
  vm.runInNewContext(code,sandbox);
  return sandbox.window.sgaStudentAnswerReview;
}

function plain(value){return JSON.parse(JSON.stringify(value))}

test('formats active time deterministically',t=>{
  const u=load();if(!u)return t.skip('utility not implemented yet');
  assert.equal(u.formatActiveTime(0),'0 sec');
  assert.equal(u.formatActiveTime(59),'59 sec');
  assert.equal(u.formatActiveTime(60),'1 min 00 sec');
  assert.equal(u.formatActiveTime(125),'2 min 05 sec');
});

test('builds legacy-safe question intelligence metadata',t=>{
  const u=load();if(!u)return t.skip('utility not implemented yet');
  assert.deepEqual(plain(u.normaliseQuestionMeta({difficulty:'Hard',topic:'Entropy',active_seconds:74,visit_count:3,answer_change_count:2})),{
    difficulty:'Hard',topic:'Entropy',activeSeconds:74,activeTime:'1 min 14 sec',visitCount:3,answerChangeCount:2
  });
  assert.deepEqual(plain(u.normaliseQuestionMeta({})),{
    difficulty:'Not Set',topic:'Unmapped',activeSeconds:0,activeTime:'0 sec',visitCount:0,answerChangeCount:0
  });
});
