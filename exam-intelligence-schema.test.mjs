import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync(new URL('./EXAMINATION_INTELLIGENCE_FOUNDATION_MIGRATION.sql',import.meta.url),'utf8').toLowerCase()

test('migration adds legacy safe official exam metadata',()=>{
  assert.match(sql,/add column if not exists exam_type text/)
  assert.match(sql,/add column if not exists exam_date date/)
  assert.match(sql,/add column if not exists expected_questions integer/)
  assert.match(sql,/exam_type is null or exam_type in \('daily','unit','monthly'\)/)
})

test('migration adds collision safe automatic exam code allocator',()=>{
  assert.match(sql,/create table if not exists public\.exam_code_counters/)
  assert.match(sql,/primary key \(exam_type, exam_date\)/)
  assert.match(sql,/create or replace function public\.allocate_exam_code/)
  assert.match(sql,/on conflict \(exam_type, exam_date\) do update/)
  assert.match(sql,/sga-/)
  assert.match(sql,/grant execute on function public\.allocate_exam_code/)
})

test('migration creates idempotent per question activity storage',()=>{
  assert.match(sql,/create table if not exists public\.exam_question_activity/)
  assert.match(sql,/active_seconds integer not null default 0/)
  assert.match(sql,/visit_count integer not null default 0/)
  assert.match(sql,/answer_change_count integer not null default 0/)
  assert.match(sql,/first_viewed_at timestamp with time zone/)
  assert.match(sql,/last_viewed_at timestamp with time zone/)
  assert.match(sql,/unique \(attempt_id, question_id\)/)
  assert.match(sql,/create table if not exists public\.exam_question_activity_events/)
  assert.match(sql,/event_id uuid primary key/)
  assert.match(sql,/create or replace function public\.record_exam_question_activity/)
  assert.match(sql,/on conflict \(event_id\) do nothing/)
})

test('new server owned activity and counter tables are locked to service role',()=>{
  for(const table of ['exam_code_counters','exam_question_activity','exam_question_activity_events']){
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql,new RegExp(`revoke all on table public\\.${table} from anon, authenticated`))
    assert.match(sql,new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`))
  }
  assert.match(sql,/revoke all on function public\.record_exam_question_activity/)
  assert.match(sql,/grant execute on function public\.record_exam_question_activity[^;]*to service_role/)
})

test('activity ownership and lookup columns are indexed',()=>{
  assert.match(sql,/create index if not exists exam_question_activity_attempt_idx\s+on public\.exam_question_activity \(attempt_id\)/)
  assert.match(sql,/create index if not exists exam_question_activity_question_idx\s+on public\.exam_question_activity \(question_id\)/)
  assert.match(sql,/create index if not exists exam_question_activity_events_attempt_idx\s+on public\.exam_question_activity_events \(attempt_id\)/)
})
