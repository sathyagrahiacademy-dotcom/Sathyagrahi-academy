import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync('EXAMINATIONS_MASTER_FOUNDATION_MIGRATION.sql','utf8').toLowerCase()

test('master lifecycle fields are additive',()=>{
  for(const column of ['batch_no','result_publish_mode','result_publish_at','new_starts_closed_at','blueprint_approved_at','archived_at']){
    assert.match(sql,new RegExp(`add column if not exists ${column}`))
  }
})

test('master migration replaces legacy hard-coded exam constraints safely',()=>{
  assert.match(sql,/drop constraint if exists exams_intelligence_type_check/)
  assert.match(sql,/drop constraint if exists exams_intelligence_metadata_check/)
  assert.match(sql,/exam_type is null or exam_type in \('daily','weekly','monthly','grand','unit'\)/)
  assert.match(sql,/batch_no is null or batch_no between 1 and 99/)
  assert.match(sql,/result_publish_mode in \('manual','scheduled'\)/)
  assert.match(sql,/expected_questions is null or expected_questions>0/)
  assert.match(sql,/duration_minutes>0/)
  assert.match(sql,/total_marks>0/)
})

test('master allocator uses final academy code format and rejects collisions',()=>{
  assert.match(sql,/create or replace function public\.allocate_exam_code_v2/)
  assert.match(sql,/when 'daily' then 'dt'/)
  assert.match(sql,/when 'weekly' then 'wt'/)
  assert.match(sql,/when 'monthly' then 'mt'/)
  assert.match(sql,/when 'grand' then 'gt'/)
  assert.match(sql,/lpad\(p_batch_no::text,2,'0'\)/)
  assert.match(sql,/to_char\(p_exam_date,'ddmm'\)/)
  assert.match(sql,/from public\.exam_access where exam_code=v_code/)
  assert.match(sql,/exam code already exists/)
})

test('master allocator remains server owned',()=>{
  assert.match(sql,/revoke all on function public\.allocate_exam_code_v2\(text,integer,date\) from public,anon,authenticated/)
  assert.match(sql,/grant execute on function public\.allocate_exam_code_v2\(text,integer,date\) to service_role/)
})
