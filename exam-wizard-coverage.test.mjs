import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8')
const ui=fs.readFileSync('admin-exam-wizard.js','utf8')

test('legacy scope service remains available for backward compatibility after Admin auth',()=>{
  const auth=edge.indexOf("profile.role !== 'admin'")
  const read=edge.indexOf("action === 'get_master_scope'")
  const replace=edge.indexOf("action === 'replace_master_scope'")
  assert.ok(auth>=0)
  assert.ok(read>auth)
  assert.ok(replace>auth)
})

test('Create Exam no longer asks teacher for Unit Chapter or Topic coverage',()=>{
  for(const token of ['mwCoverageRows','mwAddCoverage','WHOLE CHAPTER','Select Unit','Select Chapter','Topic / Whole Chapter']){
    assert.equal(ui.includes(token),false,'unexpected '+token)
  }
  assert.equal(ui.includes("action:'get_master_scope'"),false)
  assert.equal(ui.includes("action:'replace_master_scope'"),false)
})

test('subject distribution is captured with three counts and a derived total',()=>{
  for(const token of ['mwPhysicsQuestions','mwChemistryQuestions','mwBiologyQuestions','mwExpectedQuestions']){
    assert.ok(ui.includes(token),'missing '+token)
  }
  assert.match(ui,/physics\s*\+\s*chemistry\s*\+\s*biology/)
})

test('successful Draft save advances directly to Questions',()=>{
  const start=ui.indexOf("action:'create_master_exam'")
  const block=ui.slice(start,start+3000)
  assert.match(block,/setStep\(2\)/)
})
