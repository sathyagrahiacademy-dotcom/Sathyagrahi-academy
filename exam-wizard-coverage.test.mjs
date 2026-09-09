import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8')
const ui=fs.readFileSync('admin-exam-wizard.js','utf8')

test('wizard Edge Function exposes master scope read and replace actions after Admin auth',()=>{
  const auth=edge.indexOf("profile.role !== 'admin'")
  const read=edge.indexOf("action === 'get_master_scope'")
  const replace=edge.indexOf("action === 'replace_master_scope'")
  assert.ok(auth>=0)
  assert.ok(read>auth,'get_master_scope must execute after Admin authorization')
  assert.ok(replace>auth,'replace_master_scope must execute after Admin authorization')
})

test('master scope read returns planned canonical scope facts only',()=>{
  const start=edge.indexOf("action === 'get_master_scope'")
  const end=edge.indexOf("action === 'replace_master_scope'",start)
  const block=edge.slice(start,end>start?end:start+9000)
  assert.match(block,/from\('exam_scope_items'\)/)
  for(const field of ['unit_id','chapter_id','subtopic_id','sort_order','planned_questions']) assert.match(block,new RegExp(field))
  assert.doesNotMatch(block,/question_text|correct_option|password_hash/)
})

test('master scope replace uses strict v3 RPC and invalidates blueprint approval',()=>{
  const start=edge.indexOf("action === 'replace_master_scope'")
  const block=edge.slice(start,start+11000)
  assert.match(block,/replace_exam_scope_items_v3/)
  assert.match(block,/p_exam_id:examId/)
  assert.match(block,/p_created_by:user\.id/)
  assert.match(block,/blueprint_approved_at:null/)
  assert.match(block,/is_published/)
})

test('coverage Step 2 renders canonical cascading controls and planned question summary',()=>{
  for(const token of ['mwCoverageRows','mwAddCoverage','Questions Planned','WHOLE CHAPTER','Physics','Chemistry','Biology','Total Planned']){
    assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`missing ${token}`)
  }
  assert.match(ui,/state\.bootstrap\.syllabus/)
  assert.doesNotMatch(ui,/mwCoverage[^\n]{0,160}<input[^>]+placeholder=["'][^"']*Topic/i)
})

test('coverage Step 2 calls read and replace actions and stores planned totals against Step 1 expected questions',()=>{
  assert.match(ui,/action:'get_master_scope'/)
  assert.match(ui,/action:'replace_master_scope'/)
  assert.match(ui,/state\.basics\s*=\s*payload/)
  assert.match(ui,/state\.basics\.expectedQuestions/)
  assert.match(ui,/plannedQuestions/)
})

test('coverage client blocks duplicate and whole-chapter/topic overlap before save',()=>{
  assert.match(ui,/DUPLICATE_SCOPE/)
  assert.match(ui,/WHOLE_CHAPTER_TOPIC_OVERLAP/)
})

test('successful coverage save advances to Questions step',()=>{
  const start=ui.indexOf("action:'replace_master_scope'")
  const block=ui.slice(start,start+5000)
  assert.match(block,/setStep\(3\)/)
})
