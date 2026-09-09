import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html=fs.readFileSync('admin-exam-questions.html','utf8')
const js=fs.readFileSync('admin-exam-questions.js','utf8')
const bank=fs.readFileSync('admin-question-bank.js','utf8')
const wizard=fs.readFileSync('admin-exam-wizard.js','utf8')

test('Step 3 exposes the three approved question methods',()=>{
  for(const label of ['FROM QUESTION BANK','EXCEL IMPORT','MANUAL QUESTION']){
    assert.match(html,new RegExp(label))
  }
  for(const id of ['fromQuestionBank','excelImportMethod','manualQuestionMethod']){
    assert.match(html,new RegExp(`id=["']${id}["']`))
  }
})

test('question setup summary exposes expected added PCB mapped and answer-key counts',()=>{
  for(const label of ['EXPECTED','ADDED','PHYSICS','CHEMISTRY','BIOLOGY','MAPPED','ANSWER KEYS']){
    assert.match(html,new RegExp(label,'i'))
  }
  for(const id of ['expectedCount','addedCount','physicsCount','chemistryCount','biologyCount','mappedCount','answerKeyCount']){
    assert.match(html,new RegExp(`id=["']${id}["']`))
  }
})

test('question table presents the approved operator metadata columns',()=>{
  for(const label of ['QNO','SUBJECT','TOPIC','DIFFICULTY','TYPE','SOURCE','STATUS']){
    assert.match(html,new RegExp(`>${label}<`,'i'))
  }
})

test('question controller loads expected total and immutable exam snapshot metadata',()=>{
  assert.match(js,/expected_questions/)
  for(const field of ['bank_question_id','difficulty','question_type','source_label','source_year']){
    assert.match(js,new RegExp(field))
  }
})

test('question controller reuses protected mapping tree for subject topic mapped and answer-key facts',()=>{
  assert.match(js,/admin-exam-mapping/)
  assert.match(js,/action:["']tree["']/)
  assert.match(js,/mappingRows/)
  assert.match(js,/answerKeys/)
  for(const subject of ['Physics','Chemistry','Biology']) assert.match(js,new RegExp(subject))
})

test('question methods reuse existing bank Excel and manual flows instead of creating parallel engines',()=>{
  assert.match(js,/admin-question-bank\.html\?exam=/)
  assert.match(js,/bulkFile/)
  assert.match(js,/questionForm/)
  assert.match(js,/scrollIntoView|focus\(/)
  assert.doesNotMatch(js,/functions\.invoke\(["']admin-exam-wizard["'][\s\S]{0,500}(?:bulk_import|add_to_exam)/)
})

test('Question Bank can receive and preselect the current draft exam from Step 3',()=>{
  assert.match(bank,/URLSearchParams\(location\.search\)/)
  assert.match(bank,/get\(["']exam["']\)/)
  assert.match(bank,/targetExam/)
})

test('wizard Step 3 points Admin into the existing question setup flow',()=>{
  assert.match(wizard,/FROM QUESTION BANK/)
  assert.match(wizard,/EXCEL IMPORT/)
  assert.match(wizard,/MANUAL QUESTION/)
  assert.match(wizard,/admin-exam-questions\.html\?exam=/)
})
