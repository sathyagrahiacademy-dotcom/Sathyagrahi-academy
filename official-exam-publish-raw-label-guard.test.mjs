import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync('OFFICIAL_EXAM_PUBLISH_RAW_LABEL_GUARD_MIGRATION.sql','utf8')

test('official publish guard accepts either one approved canonical map or complete raw Excel labels',()=>{
  assert.match(sql,/canonical_rows=1 and approved_rows=1/)
  assert.match(sql,/canonical_rows=0 and raw_ready/)
  assert.match(sql,/subject_label in \('Physics','Chemistry','Biology'\)/)
  for(const col of ['unit_label','chapter_label','topic_label']) assert.match(sql,new RegExp(col))
  assert.match(sql,/approved canonical mapping OR complete Excel Subject\/Unit\/Chapter\/Topic labels/i)
})

test('official publish guard enforces current fixed test splits',()=>{
  assert.match(sql,/new\.exam_type='daily'/)
  assert.match(sql,/v_physics<>15 or v_chemistry<>15 or v_biology<>15/)
  assert.match(sql,/new\.exam_type in \('weekly','unit','monthly','grand'\)/)
  assert.match(sql,/v_physics<>45 or v_chemistry<>45 or v_biology<>90/)
})

test('official publish guard keeps question answer and marking safety',()=>{
  assert.match(sql,/v_question_count<>v_expected_questions/)
  assert.match(sql,/v_valid_answer_keys<>v_question_count/)
  assert.match(sql,/q\.marks is distinct from 4 or q\.negative_marks is distinct from 1/)
})

test('migration only replaces the guard function and does not delete exam data',()=>{
  assert.match(sql,/create or replace function public\.validate_official_exam_publish\(\)/i)
  assert.doesNotMatch(sql,/drop table|truncate|delete from public\.exam_/i)
})
