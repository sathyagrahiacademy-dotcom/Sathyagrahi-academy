import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync(new URL('./ACADEMY_COMMUNICATIONS_MIGRATION.sql',import.meta.url),'utf8').toLowerCase()

test('migration creates disabled-by-default communications settings',()=>{
  assert.match(sql,/create table if not exists public\.academy_communication_settings/)
  assert.match(sql,/email_enabled boolean not null default false/)
  assert.match(sql,/whatsapp_enabled boolean not null default false/)
  assert.match(sql,/morning_plan_enabled boolean not null default false/)
  assert.match(sql,/exam_published_enabled boolean not null default false/)
  assert.match(sql,/result_performance_enabled boolean not null default false/)
  assert.match(sql,/morning_send_time time not null default '07:00:00'/)
  assert.match(sql,/timezone text not null default 'asia\/kolkata'/)
})

test('migration creates idempotent delivery audit storage',()=>{
  assert.match(sql,/create table if not exists public\.academy_communication_deliveries/)
  assert.match(sql,/channel text not null check \(channel in \('email','whatsapp'\)\)/)
  assert.match(sql,/status text not null default 'pending' check \(status in \('pending','sent','failed','skipped'\)\)/)
  assert.match(sql,/attempt_count integer not null default 0/)
  assert.match(sql,/unique \(event_key, student_id, channel\)/)
  assert.match(sql,/create index if not exists academy_communication_deliveries_student_idx/)
  assert.match(sql,/create index if not exists academy_communication_deliveries_status_idx/)
})

test('communication tables are service owned and protected by RLS',()=>{
  for(const table of ['academy_communication_settings','academy_communication_deliveries']){
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql,new RegExp(`revoke all on table public\\.${table} from anon, authenticated`))
    assert.match(sql,new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`))
  }
})
