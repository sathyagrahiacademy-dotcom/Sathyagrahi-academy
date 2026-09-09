import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const file='supabase/functions/admin-exam-wizard/index.ts'
const src=()=>fs.readFileSync(file,'utf8')

test('wizard Edge Function uses pure master wizard policy and admin authorization',()=>{
  const s=src()
  assert.match(s,/wizard-policy\.mjs/)
  assert.match(s,/normaliseWizardBasics/)
  const auth=s.indexOf("profile.role !== 'admin'")
  const create=s.indexOf("action === 'create_master_exam'")
  assert.ok(auth>=0)
  assert.ok(create>auth,'create_master_exam must execute after Admin authorization')
})

test('wizard bootstrap exposes canonical syllabus and final master types only',()=>{
  const s=src()
  assert.match(s,/action === 'wizard_bootstrap'/)
  for(const value of ['daily','weekly','monthly','grand']) assert.match(s,new RegExp(value))
  assert.doesNotMatch(s,/wizard_bootstrap[\s\S]{0,5000}password_hash|correct_option|selected_option/)
})

test('master create uses v2 final code allocator and master metadata',()=>{
  const s=src()
  const start=s.indexOf("action === 'create_master_exam'")
  const end=s.indexOf("action === 'update_master_basics'",start)
  const block=s.slice(start,end>start?end:start+14000)
  assert.match(block,/normaliseWizardBasics\(body\)/)
  assert.match(block,/allocate_exam_code_v2/)
  assert.doesNotMatch(block,/allocate_exam_code['"]/)
  for(const field of ['exam_type','exam_date','batch_no','expected_questions','duration_minutes','total_marks','result_publish_mode','result_publish_at','blueprint_approved_at']) assert.match(block,new RegExp(field))
  assert.match(block,/scheduled_start:null/)
  assert.match(block,/scheduled_end:null/)
  assert.match(block,/negative_marking:true/)
  assert.match(block,/password_hash/)
  assert.doesNotMatch(block,/exam_password\s*:/i)
})

test('master update locks identity and invalidates blueprint approval',()=>{
  const s=src()
  const start=s.indexOf("action === 'update_master_basics'")
  const block=s.slice(start,start+14000)
  assert.match(block,/is_published/)
  assert.match(block,/cannot be changed/i)
  assert.match(block,/blueprint_approved_at:null/)
  assert.match(block,/password_hash/)
  assert.match(block,/result_publish_mode/)
  assert.match(block,/result_publish_at/)
})
