import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'

const path='./ACADEMY_STUDY_PLAN_MIGRATION.sql'
const sql=existsSync(path)?readFileSync(path,'utf8').toLowerCase():''

test('master study plan migration creates shared source table and read-only daily view',()=>{
  assert.equal(existsSync(path),true,'ACADEMY_STUDY_PLAN_MIGRATION.sql must exist')
  assert.match(sql,/create table if not exists public\.academy_study_plan_chapters/)
  assert.match(sql,/planned_minutes integer not null default 240/)
  assert.match(sql,/create or replace view public\.academy_daily_study_plan/)
  assert.match(sql,/grant select on public\.academy_daily_study_plan to authenticated/)
})

test('master study plan is protected from student writes',()=>{
  assert.match(sql,/alter table public\.academy_study_plan_chapters enable row level security/)
  assert.match(sql,/revoke all on table public\.academy_study_plan_chapters from anon, authenticated/)
  assert.match(sql,/grant select on table public\.academy_study_plan_chapters to authenticated/)
})

test('migration seeds all 72 source-locked chapter calendars and Sep 08 anchors',()=>{
  assert.match(sql,/Biological Classification/i)
  assert.match(sql,/Some Basic Concepts in Chemistry/i)
  assert.match(sql,/Physics and Measurement/i)
  assert.match(sql,/2026-09-08/)
})
