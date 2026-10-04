import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const policy=fs.readFileSync('supabase/functions/admin-question-bank/import-policy.mjs','utf8')
const ui=fs.readFileSync('admin-exam-questions.js','utf8')
const html=fs.readFileSync('admin-exam-questions.html','utf8')
const migration=fs.readFileSync('EXAM_EXCEL_METADATA_AS_IS_MIGRATION.sql','utf8')

test('Question Type Difficulty Source and Source Year are accepted as metadata without approved-list validation',()=>{
  assert.doesNotMatch(policy,/validateQuestionType/)
  assert.doesNotMatch(policy,/Difficulty must be Easy, Medium or Hard/)
  assert.doesNotMatch(policy,/invalid Source Year/)
  assert.doesNotMatch(ui,/approvedQuestionTypes/)
  assert.doesNotMatch(ui,/not an approved .* format/)
  assert.doesNotMatch(ui,/Difficulty must be Easy, Medium or Hard/)
  assert.doesNotMatch(ui,/invalid Source Year/)
})

test('raw Source Year text is preserved additively',()=>{
  assert.match(migration,/add column if not exists source_year_label text/i)
  assert.match(migration,/source_year_label/i)
  assert.doesNotMatch(migration,/drop column|alter column .* type|delete from|truncate/i)
})

test('Excel UI no longer tells teacher Question Type must match an approved format',()=>{
  assert.doesNotMatch(html,/Question Type must match the approved format/i)
  assert.doesNotMatch(ui,/Official syllabus, Question Type/)
})
