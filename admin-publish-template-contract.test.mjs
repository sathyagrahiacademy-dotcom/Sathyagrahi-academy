import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8')

test('publish validation loads official exam template metadata from database',()=>{
  assert.match(source,/select\(['"]id,total_marks,exam_type,subject,expected_questions,duration_minutes,negative_marking['"]\)/)
})

test('publish validation derives mapped subject counts from authoritative syllabus tree',()=>{
  assert.match(source,/loadScopeTree\(admin\)/)
  assert.match(source,/subjectCounts/)
  assert.match(source,/Physics\s*:\s*0/)
  assert.match(source,/Chemistry\s*:\s*0/)
  assert.match(source,/Biology\s*:\s*0/)
  assert.match(source,/subtopic_id/)
})

test('publish action passes server-loaded exam and subject counts into template gate',()=>{
  assert.match(source,/mappingValidation\s*,\s*exam\s*,\s*subjectCounts/)
  assert.match(source,/canPublishExam\(\{\s*mappingValidation\s*,\s*exam\s*,\s*subjectCounts\s*\}\)/)
})
