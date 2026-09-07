import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const policyUrl=new URL('./supabase/functions/academy-communications/morning-policy.mjs',import.meta.url)
const policyPath=fileURLToPath(policyUrl)
const edge=readFileSync(new URL('./supabase/functions/academy-communications/index.ts',import.meta.url),'utf8')

test('morning scheduling policy module exists',()=>{
  assert.equal(existsSync(policyPath),true,'morning-policy.mjs must exist')
})

if(existsSync(policyPath)){
  const {indiaClock,withinMorningWindow}=await import(policyUrl)

  test('indiaClock converts UTC to Asia Kolkata date and clock',()=>{
    assert.deepEqual(indiaClock('2026-09-06T01:30:00.000Z'),{date:'2026-09-06',time:'07:00'})
    assert.deepEqual(indiaClock('2026-09-05T20:00:00.000Z'),{date:'2026-09-06',time:'01:30'})
  })

  test('dispatcher accepts only the configured five minute window',()=>{
    assert.equal(withinMorningWindow('07:00','07:00',5),true)
    assert.equal(withinMorningWindow('07:04','07:00',5),true)
    assert.equal(withinMorningWindow('07:05','07:00',5),false)
    assert.equal(withinMorningWindow('06:59','07:00',5),false)
  })
}

test('morning dispatcher uses the shared source-locked daily study plan',()=>{
  assert.match(edge,/action===['"]morning_dispatch['"]|action\s*===\s*['"]morning_dispatch['"]/)
  assert.match(edge,/from\(['"]academy_daily_study_plan['"]\)/)
  assert.match(edge,/plan_date/)
  assert.match(edge,/eventKey\(['"]morning_plan['"]/)
  assert.match(edge,/buildMorningMessage\(/)
  assert.doesNotMatch(edge,/Morning dispatcher is not enabled in this build/)
})

test('morning dispatcher respects event enablement and configured time',()=>{
  assert.match(edge,/morning_plan_enabled/)
  assert.match(edge,/morning_send_time/)
  assert.match(edge,/withinMorningWindow\(/)
})
