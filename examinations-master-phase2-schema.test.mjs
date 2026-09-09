import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const file='EXAMINATIONS_MASTER_PHASE2_MIGRATION.sql'
const sql=()=>fs.readFileSync(file,'utf8')

test('phase 2 migration adds planned questions additively',()=>{
  const s=sql()
  assert.match(s,/alter table public\.exam_scope_items[\s\S]*add column if not exists planned_questions integer/i)
  assert.match(s,/planned_questions is null or planned_questions > 0/i)
})

test('v3 scope replacement is additive and service-role only',()=>{
  const s=sql()
  assert.match(s,/create or replace function public\.replace_exam_scope_items_v3\s*\(\s*p_exam_id uuid,\s*p_items jsonb,\s*p_created_by uuid\s*\)/i)
  assert.doesNotMatch(s,/drop function[\s\S]*replace_exam_scope_items_v2/i)
  assert.match(s,/revoke all on function public\.replace_exam_scope_items_v3\(uuid,jsonb,uuid\) from public, anon, authenticated/i)
  assert.match(s,/grant execute on function public\.replace_exam_scope_items_v3\(uuid,jsonb,uuid\) to service_role/i)
})

test('v3 scope rows are canonical approved-only with planned counts',()=>{
  const s=sql()
  assert.match(s,/v_planned_questions\s*:=\s*nullif\(v_item->>'plannedQuestions',''\)::integer/i)
  assert.match(s,/v_planned_questions is null or v_planned_questions <= 0/i)
  assert.match(s,/neet_syllabus_subtopics[\s\S]*status = 'approved'/i)
  assert.doesNotMatch(s,/insert into public\.neet_syllabus_subtopics/i)
  assert.doesNotMatch(s,/status = 'suggested'/i)
  assert.match(s,/insert into public\.exam_scope_items\(exam_id, unit_id, chapter_id, subtopic_id, sort_order, planned_questions, updated_at\)/i)
})

test('v3 rejects duplicate and whole-chapter/topic overlap',()=>{
  const s=sql()
  assert.match(s,/Duplicate exam scope row/i)
  assert.match(s,/Whole Chapter overlaps a Specific Topic/i)
})
