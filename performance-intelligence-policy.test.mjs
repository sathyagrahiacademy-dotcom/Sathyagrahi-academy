import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const modulePath='supabase/functions/exam-performance/performance-intelligence.mjs';
const load=async t=>{if(!fs.existsSync(modulePath)){t.skip('performance intelligence module not implemented yet');return null}return import(pathToFileURL(modulePath).href+'?v='+Date.now())};

function bank(topicId,count,difficulty='Medium',subject='Physics'){
  return Array.from({length:count},(_,i)=>({id:`b-${topicId}-${difficulty}-${i}`,subject,subtopic_id:topicId,difficulty,is_active:true}));
}
function events({topicId='t1',count=5,correct=4,difficulty='Medium',attempt='a1',start=1,subject='Physics',seconds=40}={}){
  return Array.from({length:count},(_,i)=>({bankQuestionId:`b-${topicId}-${difficulty}-${start+i-1}`,subtopicId:topicId,topicTitle:topicId==='t1'?'Entropy':'Hess Law',subject,difficulty,attemptId:attempt,submittedAt:`2026-09-${String(start).padStart(2,'0')}T10:00:00Z`,isAttempted:true,isCorrect:i<correct,activeSeconds:seconds}));
}

test('high accuracy with low bank coverage is never Mastered',async t=>{
  const m=await load(t);if(!m)return;
  const bankQuestions=bank('t1',20);
  const out=m.buildPerformanceIntelligence({bankQuestions,events:events({topicId:'t1',count:5,correct:5})});
  const topic=out.topics.find(x=>x.subtopicId==='t1');
  assert.equal(topic.coveragePct,25);
  assert.equal(topic.accuracy,100);
  assert.equal(topic.classification,'Strong Early Evidence — Low Coverage');
  assert.notEqual(topic.classification,'Mastered');
});

test('Mastered requires coverage hard evidence multiple attempts recent consistency and no retention miss',async t=>{
  const m=await load(t);if(!m)return;
  const bankQuestions=[...bank('t1',4,'Easy'),...bank('t1',4,'Medium'),...bank('t1',4,'Hard')];
  const first=[
    ...events({topicId:'t1',count:4,correct:4,difficulty:'Easy',attempt:'a1',start:1}),
    ...events({topicId:'t1',count:3,correct:3,difficulty:'Medium',attempt:'a1',start:1}),
    ...events({topicId:'t1',count:2,correct:2,difficulty:'Hard',attempt:'a1',start:1})
  ];
  const second=[
    {...events({topicId:'t1',count:1,correct:1,difficulty:'Medium',attempt:'a2',start:4})[0],submittedAt:'2026-09-12T10:00:00Z'},
    {...events({topicId:'t1',count:2,correct:2,difficulty:'Hard',attempt:'a2',start:3})[0],submittedAt:'2026-09-12T10:00:00Z'},
    {...events({topicId:'t1',count:2,correct:2,difficulty:'Hard',attempt:'a2',start:3})[1],submittedAt:'2026-09-12T10:00:00Z'}
  ];
  const out=m.buildPerformanceIntelligence({bankQuestions,events:[...first,...second]});
  const topic=out.topics.find(x=>x.subtopicId==='t1');
  assert.ok(topic.coveragePct>=70);
  assert.ok(topic.difficulty.Hard.attempted>=3);
  assert.ok(topic.distinctAttempts>=2);
  assert.ok(topic.recentAccuracy>=80);
  assert.equal(topic.retentionMisses,0);
  assert.equal(topic.classification,'Mastered');
});

test('correct then later wrong records retention miss; wrong then later correct records improvement',async t=>{
  const m=await load(t);if(!m)return;
  const bankQuestions=bank('t1',6);
  const e=[
    {bankQuestionId:'b-t1-Medium-0',subtopicId:'t1',topicTitle:'Entropy',subject:'Physics',difficulty:'Medium',attemptId:'a1',submittedAt:'2026-09-01T10:00:00Z',isAttempted:true,isCorrect:true,activeSeconds:30},
    {bankQuestionId:'b-t1-Medium-0',subtopicId:'t1',topicTitle:'Entropy',subject:'Physics',difficulty:'Medium',attemptId:'a2',submittedAt:'2026-09-05T10:00:00Z',isAttempted:true,isCorrect:false,activeSeconds:45},
    {bankQuestionId:'b-t1-Medium-1',subtopicId:'t1',topicTitle:'Entropy',subject:'Physics',difficulty:'Medium',attemptId:'a1',submittedAt:'2026-09-01T10:00:00Z',isAttempted:true,isCorrect:false,activeSeconds:40},
    {bankQuestionId:'b-t1-Medium-1',subtopicId:'t1',topicTitle:'Entropy',subject:'Physics',difficulty:'Medium',attemptId:'a2',submittedAt:'2026-09-05T10:00:00Z',isAttempted:true,isCorrect:true,activeSeconds:35}
  ];
  const out=m.buildPerformanceIntelligence({bankQuestions,events:e});
  assert.equal(out.summary.repeatExposure,2);
  assert.equal(out.summary.retentionMisses,1);
  assert.equal(out.summary.improvementEvents,1);
  assert.equal(out.topics[0].retentionMisses,1);
});

test('difficulty accuracy and bank-linked repeat exposure are exact; legacy events do not inflate coverage',async t=>{
  const m=await load(t);if(!m)return;
  const bankQuestions=[...bank('t1',2,'Easy'),...bank('t1',2,'Medium'),...bank('t1',2,'Hard')];
  const e=[
    {...events({topicId:'t1',count:2,correct:2,difficulty:'Easy'})[0]},
    {...events({topicId:'t1',count:2,correct:2,difficulty:'Easy'})[1]},
    {...events({topicId:'t1',count:2,correct:1,difficulty:'Medium'})[0]},
    {...events({topicId:'t1',count:2,correct:1,difficulty:'Medium'})[1]},
    {...events({topicId:'t1',count:2,correct:0,difficulty:'Hard'})[0]},
    {...events({topicId:'t1',count:2,correct:0,difficulty:'Hard'})[1]},
    {bankQuestionId:null,subtopicId:'t1',topicTitle:'Entropy',subject:'Physics',difficulty:'Hard',attemptId:'a1',submittedAt:'2026-09-01T11:00:00Z',isAttempted:true,isCorrect:true,activeSeconds:10}
  ];
  const out=m.buildPerformanceIntelligence({bankQuestions,events:e});
  assert.deepEqual(out.difficulty.Easy,{attempted:2,correct:2,accuracy:100,avgActiveSeconds:40});
  assert.equal(out.difficulty.Medium.accuracy,50);
  assert.equal(out.difficulty.Hard.attempted,3);
  assert.equal(out.summary.activeBankQuestions,6);
  assert.equal(out.summary.uniqueBankQuestionsFaced,6);
  assert.equal(out.summary.bankCoveragePct,100);
  assert.equal(out.summary.repeatExposure,0);
});

test('speed issue is relative to subject median and requires enough topic observations',async t=>{
  const m=await load(t);if(!m)return;
  const bankQuestions=[...bank('t1',4),...bank('t2',4)];
  const e=[
    ...events({topicId:'t1',count:3,correct:2,seconds:90}),
    ...events({topicId:'t2',count:4,correct:4,seconds:30})
  ];
  const out=m.buildPerformanceIntelligence({bankQuestions,events:e});
  const slow=out.topics.find(x=>x.subtopicId==='t1');
  const fast=out.topics.find(x=>x.subtopicId==='t2');
  assert.equal(slow.speedIssue,true);
  assert.equal(fast.speedIssue,false);
  assert.equal(out.mentor.speedIssues.length,1);
  assert.match(out.mentor.speedIssues[0].evidence,/subject median/i);
});
