import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html=fs.readFileSync('admin-exam-questions.html','utf8')
const js=fs.readFileSync('admin-exam-questions.js','utf8')
const wizard=fs.readFileSync('admin-exam-wizard.js','utf8')
const edge=fs.readFileSync('supabase/functions/admin-question-bank/index.ts','utf8')
const direct=fs.readFileSync('EXAM_EXCEL_DIRECT_IMPORT_MIGRATION.sql','utf8')

test('Questions setup exposes Excel upload only',()=>{
  assert.match(html,/EXCEL UPLOAD/)
  assert.match(html,/id=["']excelImportMethod["']/)
  assert.doesNotMatch(html,/FROM QUESTION BANK|MANUAL QUESTION/)
  assert.match(html,/No Question Bank and no manual question entry/i)
})

test('question setup summary exposes expected added PCB mapped and answer-key counts',()=>{
  for(const label of ['EXPECTED','ADDED','PHYSICS','CHEMISTRY','BIOLOGY','MAPPED','ANSWER KEYS']) assert.match(html,new RegExp(label,'i'))
})

test('Excel controller validates official metadata and invokes one atomic import action',()=>{
  for(const field of ['Subject','Unit','Chapter','Topic','Difficulty','Question Type','Source','Source Year']) assert.ok(js.includes(field),field)
  assert.match(js,/action:["']bulk_import["']/)
  assert.match(js,/Marks must be 4/)
  assert.match(js,/Negative Marks must be 1/)
})

test('bulk import writes directly to exam and never writes the permanent Question Bank',()=>{
  assert.match(edge,/import_exam_questions_direct/)
  const start=edge.indexOf("action==='bulk_import'")
  const end=edge.indexOf("action==='add_to_exam'",start)
  const block=edge.slice(start,end)
  assert.doesNotMatch(block,/import_exam_questions_to_bank/)
  assert.match(direct,/insert into public\.exam_questions/i)
  assert.match(direct,/insert into public\.exam_answer_keys/i)
  assert.match(direct,/insert into public\.exam_question_syllabus_map/i)
  assert.doesNotMatch(direct,/insert into public\.question_bank_questions/i)
})

test('wizard Questions step opens only the Excel upload flow',()=>{
  assert.match(wizard,/EXCEL UPLOAD/)
  assert.match(wizard,/admin-exam-questions\.html\?exam=/)
  assert.doesNotMatch(wizard,/FROM QUESTION BANK|MANUAL QUESTION|admin-question-bank\.html/)
})
