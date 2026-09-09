import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MASTER_EXAM_TYPES,
  normaliseMasterExamType,
  buildMasterExamCode,
  deriveExamLifecycle,
  nextExamAction
} from './supabase/functions/_shared/exam-master-policy.mjs'

test('final official types are Daily Weekly Monthly Grand only',()=>{
  assert.deepEqual(Object.keys(MASTER_EXAM_TYPES).sort(),['daily','grand','monthly','weekly'])
  assert.equal(MASTER_EXAM_TYPES.daily.code,'DT')
  assert.equal(MASTER_EXAM_TYPES.weekly.code,'WT')
  assert.equal(MASTER_EXAM_TYPES.monthly.code,'MT')
  assert.equal(MASTER_EXAM_TYPES.grand.code,'GT')
  assert.equal(normaliseMasterExamType('unit'),null)
})

test('code is SGA type batch DDMM with no year or sequence',()=>{
  assert.equal(buildMasterExamCode({type:'daily',batch:1,date:'2026-09-08'}),'SGA-DT-010809')
  assert.equal(buildMasterExamCode({type:'weekly',batch:2,date:'2027-05-02'}),'SGA-WT-020205')
  assert.equal(buildMasterExamCode({type:'monthly',batch:12,date:'2026-12-31'}),'SGA-MT-123112')
  assert.equal(buildMasterExamCode({type:'grand',batch:99,date:'2026-01-01'}),'SGA-GT-990101')
})

test('invalid type batch and date are rejected',()=>{
  assert.throws(()=>buildMasterExamCode({type:'unit',batch:1,date:'2026-09-08'}),/type/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:0,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:100,date:'2026-09-08'}),/batch/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:1,date:'08-09-2026'}),/date/i)
  assert.throws(()=>buildMasterExamCode({type:'daily',batch:1,date:'2026-02-31'}),/date/i)
})

test('published exam is Available until a student is actively attempting',()=>{
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:0,newStartsClosedAt:null,resultPublished:false}).state,'available')
  assert.equal(deriveExamLifecycle({isPublished:true,activeCount:1,newStartsClosedAt:null,resultPublished:false}).state,'live')
})

test('unpublished setup is Draft or Ready',()=>{
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:false}).state,'draft')
  assert.equal(deriveExamLifecycle({isPublished:false,setupReady:true}).state,'ready')
})

test('closed exam becomes Conducted then Results Ready',()=>{
  const closed='2026-09-08T17:00:00Z'
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:closed,activeCount:0,readyResultCount:0,resultPublished:false}).state,'conducted')
  assert.equal(deriveExamLifecycle({isPublished:true,newStartsClosedAt:closed,activeCount:0,readyResultCount:2,resultPublished:false}).state,'results_ready')
})

test('archive and published result have explicit precedence',()=>{
  assert.equal(deriveExamLifecycle({archivedAt:'2026-09-08T18:00:00Z',isPublished:true,resultPublished:true}).state,'archived')
  assert.equal(deriveExamLifecycle({isPublished:true,resultPublished:true}).state,'result_published')
})

test('next action is deterministic',()=>{
  assert.equal(nextExamAction('draft'),'Continue Setup')
  assert.equal(nextExamAction('ready'),'Publish Exam')
  assert.equal(nextExamAction('available'),'Monitor Exam')
  assert.equal(nextExamAction('live'),'Monitor Exam')
  assert.equal(nextExamAction('conducted'),'Review Results')
  assert.equal(nextExamAction('results_ready'),'Publish Results')
  assert.equal(nextExamAction('result_published'),'View Performance')
  assert.equal(nextExamAction('archived'),'View Exam')
})
