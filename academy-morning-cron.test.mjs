import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'

const path='./supabase/functions/academy-morning-cron/index.ts'
const source=existsSync(path)?readFileSync(path,'utf8'):''

test('dedicated morning cron function exists and reads the shared daily plan',()=>{
  assert.equal(existsSync(path),true,'academy-morning-cron Edge Function must exist')
  assert.match(source,/academy_daily_study_plan/)
  assert.match(source,/plan_date/)
  assert.match(source,/morning_plan_enabled/)
  assert.match(source,/email_enabled/)
})

test('cron function is protected, time-gated and idempotent',()=>{
  assert.match(source,/x-sga-cron-key/i)
  assert.match(source,/verify_academy_morning_cron_key/)
  assert.match(source,/withinMorningWindow/)
  assert.match(source,/academy_communication_deliveries/)
  assert.match(source,/morning_plan:/)
})
