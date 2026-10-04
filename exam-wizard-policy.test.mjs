import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normaliseWizardBasics,
  suggestExamTitle,
  normaliseCoverageRows,
  detectCoverageOverlap,
  buildWizardReadiness,
  validateResultRelease
} from './supabase/functions/admin-exams/wizard-policy.mjs'

const syllabusLookup={
  units:new Map([
    ['uP',{id:'uP',subject:'Physics'}],
    ['uC',{id:'uC',subject:'Chemistry'}]
  ]),
  chapters:new Map([
    ['cP',{id:'cP',unit_id:'uP'}],
    ['cC',{id:'cC',unit_id:'uC'}]
  ]),
  subtopics:new Map([
    ['sP1',{id:'sP1',chapter_id:'cP'}],
    ['sP2',{id:'sP2',chapter_id:'cP'}],
    ['sC1',{id:'sC1',chapter_id:'cC'}]
  ])
}

test('wizard basics enforce fixed SGA exam plans and derive total marks',()=>{
  const dt=normaliseWizardBasics({
    examType:'daily',batchNo:1,examDate:'2026-09-09',title:'Daily Test',
    expectedQuestions:45,physicsQuestions:15,chemistryQuestions:15,biologyQuestions:15,durationMinutes:45,resultPublishMode:'manual'
  })
  assert.equal(dt.ok,true)
  assert.equal(dt.value.expectedQuestions,45)
  assert.equal(dt.value.totalMarks,180)

  const wt=normaliseWizardBasics({
    examType:'weekly',batchNo:1,examDate:'2026-09-09',title:'Weekly Test',
    expectedQuestions:180,physicsQuestions:45,chemistryQuestions:45,biologyQuestions:90,durationMinutes:180,resultPublishMode:'manual'
  })
  assert.equal(wt.ok,true)
  assert.equal(wt.value.expectedQuestions,180)
  assert.equal(wt.value.totalMarks,720)
  assert.equal(wt.value.biologyQuestionCount,90)

  assert.equal(normaliseWizardBasics({
    examType:'weekly',batchNo:1,examDate:'2026-09-09',title:'Bad Weekly',
    expectedQuestions:45,physicsQuestions:15,chemistryQuestions:15,biologyQuestions:15,durationMinutes:45,resultPublishMode:'manual'
  }).ok,false)
})

test('wizard basics reject legacy type invalid batch date count and duration',()=>{
  assert.equal(normaliseWizardBasics({examType:'unit',batchNo:1,examDate:'2026-09-09',title:'x',expectedQuestions:10,durationMinutes:10,resultPublishMode:'manual'}).ok,false)
  assert.equal(normaliseWizardBasics({examType:'daily',batchNo:0,examDate:'2026-09-09',title:'x',expectedQuestions:10,durationMinutes:10,resultPublishMode:'manual'}).ok,false)
  assert.equal(normaliseWizardBasics({examType:'daily',batchNo:1,examDate:'09-09-2026',title:'x',expectedQuestions:10,durationMinutes:10,resultPublishMode:'manual'}).ok,false)
  assert.equal(normaliseWizardBasics({examType:'daily',batchNo:1,examDate:'2026-09-09',title:'x',expectedQuestions:0,durationMinutes:10,resultPublishMode:'manual'}).ok,false)
  assert.equal(normaliseWizardBasics({examType:'daily',batchNo:1,examDate:'2026-09-09',title:'x',expectedQuestions:10,durationMinutes:0,resultPublishMode:'manual'}).ok,false)
})

test('title suggestion is deterministic and batch aware',()=>{
  assert.equal(suggestExamTitle({type:'daily',batch:1,date:'2026-09-09'}),'SGA DAILY TEST | BATCH 01 | 09 SEP 2026')
  assert.equal(suggestExamTitle({type:'grand',batch:12,date:'2026-12-31'}),'SGA GRAND TEST | BATCH 12 | 31 DEC 2026')
})

test('manual result release needs no schedule and scheduled requires future timestamp',()=>{
  assert.deepEqual(validateResultRelease({mode:'manual',publishAt:null,now:'2026-09-09T10:00:00Z'}),{ok:true,mode:'manual',publishAt:null})
  assert.equal(validateResultRelease({mode:'scheduled',publishAt:null,now:'2026-09-09T10:00:00Z'}).ok,false)
  assert.equal(validateResultRelease({mode:'scheduled',publishAt:'2026-09-09T09:00:00Z',now:'2026-09-09T10:00:00Z'}).ok,false)
  const future=validateResultRelease({mode:'scheduled',publishAt:'2026-09-09T11:00:00Z',now:'2026-09-09T10:00:00Z'})
  assert.equal(future.ok,true)
  assert.equal(future.mode,'scheduled')
})

test('coverage rows require canonical hierarchy and positive planned questions',()=>{
  const good=normaliseCoverageRows([
    {subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sP1',plannedQuestions:5},
    {subject:'Chemistry',unitId:'uC',chapterId:'cC',subtopicId:null,plannedQuestions:10}
  ],{syllabusLookup})
  assert.equal(good.ok,true)
  assert.equal(good.items[0].plannedQuestions,5)
  assert.equal(good.items[1].subtopicId,null)

  assert.equal(normaliseCoverageRows([{subject:'Physics',unitId:'uC',chapterId:'cC',subtopicId:null,plannedQuestions:5}],{syllabusLookup}).ok,false)
  assert.equal(normaliseCoverageRows([{subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sC1',plannedQuestions:5}],{syllabusLookup}).ok,false)
  assert.equal(normaliseCoverageRows([{subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sP1',plannedQuestions:0}],{syllabusLookup}).ok,false)
})

test('exact duplicate and whole chapter plus topic overlap are detected',()=>{
  const exact=[
    {subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sP1',plannedQuestions:3},
    {subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sP1',plannedQuestions:2}
  ]
  const exactIssues=detectCoverageOverlap(exact)
  assert.ok(exactIssues.some(x=>x.code==='DUPLICATE_SCOPE'))

  const overlap=[
    {subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:null,plannedQuestions:5},
    {subject:'Physics',unitId:'uP',chapterId:'cP',subtopicId:'sP2',plannedQuestions:5}
  ]
  const issues=detectCoverageOverlap(overlap)
  assert.ok(issues.some(x=>x.code==='WHOLE_CHAPTER_TOPIC_OVERLAP'))
})

test('wizard readiness requires planned total questions keys mapping blueprint and students',()=>{
  const ready=buildWizardReadiness({
    expectedQuestions:20,plannedQuestions:20,questionCount:20,keyedQuestions:20,mappedQuestions:20,
    blueprintApproved:true,assignedCount:3,resultReleaseValid:true
  })
  assert.equal(ready.ready,true)
  assert.deepEqual(ready.issues,[])

  const blocked=buildWizardReadiness({
    expectedQuestions:20,plannedQuestions:18,questionCount:19,keyedQuestions:18,mappedQuestions:17,
    blueprintApproved:false,assignedCount:0,resultReleaseValid:false
  })
  assert.equal(blocked.ready,false)
  for(const code of ['COVERAGE_TOTAL_MISMATCH','QUESTIONS_INCOMPLETE','ANSWER_KEYS_INCOMPLETE','MAPPING_INCOMPLETE','BLUEPRINT_PENDING','STUDENTS_MISSING','RESULT_RELEASE_INVALID']){
    assert.ok(blocked.issues.some(x=>x.code===code),`missing ${code}`)
  }
})
