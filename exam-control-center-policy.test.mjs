import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExamControlItem,
  buildControlCenterSummary
} from './supabase/functions/admin-exams/control-center-policy.mjs'

function base(overrides={}){
  return {
    id:'e1',title:'Daily Test',examType:'daily',examDate:'2026-09-08',batchNo:1,examCode:'SGA-DT-010809',
    isPublished:false,resultPublished:false,newStartsClosedAt:null,archivedAt:null,legacyCompleted:false,
    expectedQuestions:45,questionCount:45,mappedQuestions:45,keyedQuestions:45,blueprintApproved:true,
    assignedCount:3,activeCount:0,submittedCount:0,readyResultCount:0,publishedResultCount:0,
    resultPublishMode:'manual',issues:[],...overrides
  }
}

test('unpublished complete setup is Ready and incomplete setup is Draft',()=>{
  assert.equal(buildExamControlItem(base()).state,'ready')
  assert.equal(buildExamControlItem(base({mappedQuestions:44})).state,'draft')
})

test('published exam stays Available until an active attempt makes it Live',()=>{
  assert.equal(buildExamControlItem(base({isPublished:true})).state,'available')
  assert.equal(buildExamControlItem(base({isPublished:true,activeCount:1})).state,'live')
})

test('one submitted attempt alone does not make an open exam Conducted',()=>{
  const item=buildExamControlItem(base({isPublished:true,submittedCount:1,readyResultCount:1,newStartsClosedAt:null}))
  assert.equal(item.state,'available')
})

test('closed exam moves through Conducted Results Ready Result Published and Archived',()=>{
  const closed='2026-09-08T18:00:00Z'
  assert.equal(buildExamControlItem(base({isPublished:true,newStartsClosedAt:closed})).state,'conducted')
  assert.equal(buildExamControlItem(base({isPublished:true,newStartsClosedAt:closed,readyResultCount:2})).state,'results_ready')
  assert.equal(buildExamControlItem(base({isPublished:true,newStartsClosedAt:closed,resultPublished:true,publishedResultCount:2})).state,'result_published')
  assert.equal(buildExamControlItem(base({isPublished:true,resultPublished:true,archivedAt:'2026-09-09T00:00:00Z'})).state,'archived')
})

test('setup readiness requires complete questions mapping keys blueprint and audience',()=>{
  for(const patch of [
    {questionCount:0},
    {questionCount:44},
    {mappedQuestions:44},
    {keyedQuestions:44},
    {blueprintApproved:false},
    {assignedCount:0}
  ]){
    assert.equal(buildExamControlItem(base(patch)).setupReady,false,JSON.stringify(patch))
  }
  assert.equal(buildExamControlItem(base({expectedQuestions:null,questionCount:12,mappedQuestions:12,keyedQuestions:12})).setupReady,true)
})

test('incomplete setup creates deduplicated actionable issues',()=>{
  const item=buildExamControlItem(base({
    questionCount:44,mappedQuestions:40,keyedQuestions:42,blueprintApproved:false,assignedCount:0,
    issues:[{code:'MAPPING_INCOMPLETE',severity:'high',label:'Duplicate',action:'Duplicate',target:'QUESTIONS'}]
  }))
  assert.deepEqual(item.issues.map(x=>x.code),[
    'QUESTIONS_INCOMPLETE','MAPPING_INCOMPLETE','ANSWER_KEYS_INCOMPLETE','BLUEPRINT_PENDING','STUDENTS_MISSING'
  ])
  assert.equal(new Set(item.issues.map(x=>x.code)).size,item.issues.length)
  assert.deepEqual(item.issues.find(x=>x.code==='QUESTIONS_INCOMPLETE'),{code:'QUESTIONS_INCOMPLETE',severity:'high',label:'Questions incomplete',action:'Add Questions',target:'QUESTIONS'})
  assert.deepEqual(item.issues.find(x=>x.code==='MAPPING_INCOMPLETE'),{code:'MAPPING_INCOMPLETE',severity:'high',label:'Mapping incomplete',action:'Review Mapping',target:'QUESTIONS'})
})

test('control center summary counts today available live results pending and action required',()=>{
  const items=[
    buildExamControlItem(base({id:'today-ready',examDate:'2026-09-08'})),
    buildExamControlItem(base({id:'available',examDate:'2026-09-09',isPublished:true})),
    buildExamControlItem(base({id:'live',examDate:'2026-09-08',isPublished:true,activeCount:1})),
    buildExamControlItem(base({id:'pending',examDate:'2026-09-07',isPublished:true,newStartsClosedAt:'2026-09-08T10:00:00Z',readyResultCount:2})),
    buildExamControlItem(base({id:'attention',examDate:'2026-09-08',mappedQuestions:44}))
  ]
  assert.deepEqual(buildControlCenterSummary(items,{today:'2026-09-08'}),{
    today:3,
    upcomingAvailable:1,
    liveNow:1,
    resultsPending:1,
    actionRequired:1
  })
})
