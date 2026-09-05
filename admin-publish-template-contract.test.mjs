import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync('EXAMINATION_INTELLIGENCE_FOUNDATION_MIGRATION.sql','utf8')

test('official publish template is protected by a database trigger',()=>{
  assert.match(migration,/create or replace function public\.validate_official_exam_publish/i)
  assert.match(migration,/create trigger exams_official_publish_guard/i)
  assert.match(migration,/before update of is_published on public\.exams/i)
})

test('publish guard explicitly preserves legacy exams',()=>{
  assert.match(migration,/new\.exam_type is null/i)
  assert.match(migration,/return new/i)
})

test('publish guard enforces official template metadata and actual question totals',()=>{
  assert.match(migration,/expected_questions/i)
  assert.match(migration,/duration_minutes/i)
  assert.match(migration,/total_marks/i)
  assert.match(migration,/negative_marking/i)
  assert.match(migration,/from public\.exam_questions/i)
  assert.match(migration,/45/)
  assert.match(migration,/180/)
  assert.match(migration,/720/)
})

test('publish guard derives authoritative subject counts through approved syllabus mapping',()=>{
  assert.match(migration,/exam_question_syllabus_map/i)
  assert.match(migration,/neet_syllabus_subtopics/i)
  assert.match(migration,/neet_syllabus_topics/i)
  assert.match(migration,/neet_syllabus_units/i)
  assert.match(migration,/status\s*=\s*'approved'/i)
  assert.match(migration,/v_physics/i)
  assert.match(migration,/v_chemistry/i)
  assert.match(migration,/v_biology/i)
})
