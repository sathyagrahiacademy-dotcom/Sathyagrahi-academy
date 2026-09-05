import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html=readFileSync(new URL('./admin-exams.html',import.meta.url),'utf8')
const js=readFileSync(new URL('./admin-exams.js',import.meta.url),'utf8')
const edge=readFileSync(new URL('./supabase/functions/admin-exams/index.ts',import.meta.url),'utf8')

test('exam form captures official type and compulsory exam date',()=>{
  assert.match(html,/id="examType"/)
  assert.match(html,/value="daily"[^>]*>Daily Exam</)
  assert.match(html,/value="unit"[^>]*>Unit Exam</)
  assert.match(html,/value="monthly"[^>]*>Monthly Exam</)
  assert.match(html,/id="examDate"[^>]*type="date"[^>]*required/)
})

test('official template fields are derived and exam code is read only',()=>{
  assert.match(html,/id="expectedQuestions"[^>]*readonly/)
  assert.match(html,/id="duration"[^>]*readonly/)
  assert.match(html,/id="marks"[^>]*readonly/)
  assert.match(html,/id="code"[^>]*readonly/)
  assert.match(html,/Generated automatically after save/i)
})

test('admin UI sends type and date and loads official metadata',()=>{
  assert.match(js,/exam_type,exam_date,expected_questions/)
  assert.match(js,/examType:document\.getElementById\('examType'\)\.value/)
  assert.match(js,/examDate:document\.getElementById\('examDate'\)\.value/)
  assert.doesNotMatch(js,/examCode:document\.getElementById\('code'\)\.value/)
})

test('admin backend derives official template and allocates code server side',()=>{
  assert.match(edge,/exam-intelligence-policy\.mjs/)
  assert.match(edge,/normaliseExamType/)
  assert.match(edge,/templateForExamType/)
  assert.match(edge,/allocate_exam_code/)
  assert.match(edge,/exam_type:examType/)
  assert.match(edge,/exam_date:examDate/)
  assert.match(edge,/expected_questions:template\.questions/)
})

test('official exam identity is immutable on update while legacy update remains explicit',()=>{
  assert.match(edge,/Official Exam Type cannot be changed/i)
  assert.match(edge,/Official Exam Date cannot be changed/i)
  assert.match(edge,/existing\.exam_type/)
  assert.match(edge,/legacy/i)
})
