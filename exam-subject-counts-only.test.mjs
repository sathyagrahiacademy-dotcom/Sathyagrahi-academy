import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const ui=fs.readFileSync('admin-exam-wizard.js','utf8')
const wizard=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8')
const admin=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8')
const migration=fs.readFileSync('EXAM_SUBJECT_QUESTION_COUNTS_MIGRATION.sql','utf8')

test('additive migration stores three subject question counts without replacing exam tables',()=>{
  for(const col of ['physics_question_count','chemistry_question_count','biology_question_count']){
    assert.match(migration,new RegExp('add column if not exists '+col,'i'),'missing '+col)
  }
  assert.match(migration,/check[\s\S]*physics_question_count[\s\S]*chemistry_question_count[\s\S]*biology_question_count/i)
  assert.doesNotMatch(migration,/drop table|truncate|delete from/i)
})

test('Create Exam uses subject counts only and has no syllabus topic picker',()=>{
  for(const id of ['mwPhysicsQuestions','mwChemistryQuestions','mwBiologyQuestions','mwExpectedQuestions']){
    assert.match(ui,new RegExp(id),'missing '+id)
  }
  assert.match(ui,/Physics Questions/)
  assert.match(ui,/Chemistry Questions/)
  assert.match(ui,/Biology Questions/)
  assert.doesNotMatch(ui,/mwCoverageRows|mwAddCoverage|WHOLE CHAPTER|Select Unit|Select Chapter|Topic \/ Whole Chapter/)
})

test('wizard is five simple steps with Questions immediately after Basic Details',()=>{
  for(const label of ['Basic Details','Questions','Validation','Students / Audience','Review & Publish']){
    assert.ok(ui.includes(label),'missing '+label)
  }
  assert.doesNotMatch(ui,/Coverage \/ Syllabus/)
})

test('subject counts derive total questions and total marks',()=>{
  assert.match(ui,/mwPhysicsQuestions/)
  assert.match(ui,/mwChemistryQuestions/)
  assert.match(ui,/mwBiologyQuestions/)
  assert.match(ui,/physics\s*\+\s*chemistry\s*\+\s*biology/)
  assert.match(ui,/expected\s*\*\s*4/)
})

test('master create and update persist subject question counts',()=>{
  const create=wizard.slice(wizard.indexOf("action === 'create_master_exam'"),wizard.indexOf("action === 'update_master_basics'"))
  for(const token of ['physics_question_count','chemistry_question_count','biology_question_count']) assert.match(create,new RegExp(token))
  const update=wizard.slice(wizard.indexOf("action === 'update_master_basics'"),wizard.indexOf("action === 'get_master_scope'"))
  for(const token of ['physics_question_count','chemistry_question_count','biology_question_count']) assert.match(update,new RegExp(token))
})

test('blueprint compares actual mapped question subjects to stored subject counts without requiring manual scope rows',()=>{
  const start=admin.indexOf('async function loadMasterBlueprintValidation')
  const block=admin.slice(start,start+9000)
  for(const token of ['physics_question_count','chemistry_question_count','biology_question_count']) assert.match(block,new RegExp(token))
  assert.match(block,/hasStoredSubjectPlan/)
  assert.match(block,/if\(!hasStoredSubjectPlan\)/,'legacy scope rows may remain only as backward-compatible fallback')
  assert.match(block,/actualSubjectCounts/)
  assert.match(block,/plannedSubjectCounts/)
})
