import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const src=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8')

test('admin exams imports control center policy',()=>{
  assert.match(src,/control-center-policy\.mjs/)
  assert.match(src,/buildExamControlItem/)
  assert.match(src,/buildControlCenterSummary/)
})

test('control center action exists after active Admin authorization',()=>{
  const auth=src.indexOf("profile.role !== 'admin'")
  const action=src.indexOf("action === 'control_center'")
  assert.ok(auth>=0,'existing Admin authorization guard missing')
  assert.ok(action>auth,'control_center must execute only after Admin authorization')
})

test('control center reads only lightweight exam facts and correct assignment table',()=>{
  for(const field of ['batch_no','result_publish_mode','result_publish_at','new_starts_closed_at','blueprint_approved_at','archived_at']){
    assert.match(src,new RegExp(field),`control center source should reference ${field}`)
  }
  assert.match(src,/exam_access\(exam_code\)/)
  assert.match(src,/from\('exam_student_assignments'\)/)
  assert.match(src,/\.eq\('is_assigned',true\)/)
  assert.match(src,/from\('exam_attempts'\)/)
  assert.match(src,/from\('exam_results'\)/)
  assert.doesNotMatch(src,/control_center[\s\S]{0,5000}password_hash/)
})

test('control center derives India date and reuses publish validation',()=>{
  assert.match(src,/Asia\/Kolkata/)
  assert.match(src,/formatToParts/)
  assert.match(src,/loadPublishValidation/)
})

test('control center response exposes summary and exams without academic answer data',()=>{
  assert.match(src,/return json\(\{ok:true,today,summary,exams:items\}\)/)
  const start=src.indexOf("action === 'control_center'")
  const end=src.indexOf("action === 'scope_tree'",start)
  const block=src.slice(start,end>start?end:start+12000)
  assert.doesNotMatch(block,/question_text|option_a|option_b|selected_option|correct_option|password_hash/)
})
