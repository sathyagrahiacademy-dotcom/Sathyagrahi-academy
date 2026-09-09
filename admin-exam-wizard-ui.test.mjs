import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const nav=fs.readFileSync('admin-examinations-nav.js','utf8')
const file='admin-exam-wizard.js'
const src=()=>fs.readFileSync(file,'utf8')

test('master wizard script loads only inside the existing production gate',()=>{
  const gate=nav.indexOf('if(masterPhase1Enabled)')
  const wizard=nav.indexOf("admin-exam-wizard.js")
  const legacy=nav.indexOf("admin-exams-enhancements.js")
  assert.ok(gate>=0)
  assert.ok(wizard>gate,'wizard must load only after master gate')
  assert.ok(legacy>gate,'legacy fallback must remain present')
})

test('wizard intercepts Create Exam only in master mode and keeps a separate modal',()=>{
  const s=src()
  assert.match(s,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED\s*!==\s*true/)
  assert.match(s,/addEventListener\('click',[\s\S]*true\)/)
  assert.match(s,/stopImmediatePropagation\(\)/)
  assert.match(s,/masterExamWizardModal/)
  assert.doesNotMatch(s,/id=["']modal["']/)
})

test('wizard presents the approved six setup steps',()=>{
  const s=src()
  for(const label of ['Basic Details','Coverage / Syllabus','Questions','Blueprint & Validation','Students / Audience','Publish / Result Release']){
    assert.match(s,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  }
})

test('Step 1 has final type batch date identity duration scoring password and result release controls',()=>{
  const s=src()
  for(const id of ['mwExamType','mwBatchNo','mwExamDate','mwTitle','mwExamCode','mwExpectedQuestions','mwDurationMinutes','mwTotalMarks','mwPassword','mwResultPublishMode','mwResultPublishAt','mwInstructions']){
    assert.match(s,new RegExp(id),`missing ${id}`)
  }
  for(const value of ['daily','weekly','monthly','grand']) assert.match(s,new RegExp(`value=["']${value}["']`))
  assert.doesNotMatch(s,/value=["']unit["']/)
  for(const label of ['SHOW','COPY','REGENERATE','MANUAL CHANGE','+4 / −1 / 0']) assert.match(s,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
})

test('Step 1 previews final code and derives total marks without fixed templates',()=>{
  const s=src()
  assert.match(s,/SGA-\$\{typeCode\}-\$\{String\(batch\)\.padStart\(2,'0'\)\}\$\{dd\}\$\{mm\}/)
  assert.match(s,/expected\s*\*\s*4/)
  assert.doesNotMatch(s,/daily[^\n]{0,120}questions\s*:\s*45/i)
  assert.doesNotMatch(s,/monthly[^\n]{0,120}questions\s*:\s*180/i)
})

test('wizard calls dedicated authenticated Edge Function and creates draft through create_master_exam',()=>{
  const s=src()
  assert.match(s,/functions\/v1\/admin-exam-wizard/)
  assert.match(s,/Authorization/)
  assert.match(s,/action:'wizard_bootstrap'/)
  assert.match(s,/action:'create_master_exam'/)
  assert.match(s,/examPassword/)
  assert.match(s,/resultPublishMode/)
  assert.match(s,/resultPublishAt/)
})

test('successful Step 1 stores server exam id and code then advances to Coverage',()=>{
  const s=src()
  assert.match(s,/state\.examId\s*=\s*data\.examId/)
  assert.match(s,/state\.examCode\s*=\s*data\.examCode/)
  assert.match(s,/setStep\(2\)/)
})
