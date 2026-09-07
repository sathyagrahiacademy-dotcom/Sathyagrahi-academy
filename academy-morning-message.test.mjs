import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMorningMessage } from './supabase/functions/academy-morning-cron/morning-message.mjs'

const message=buildMorningMessage({
  student:{full_name:'SATHYA'},date:'2026-09-08',tasks:[
    {subject:'Biology',chapter:'Biological Classification',topic:'Day 1 of 2',task_type:'Study',target_minutes:240},
    {subject:'Biology',chapter:'The Living World',topic:'Revision - I',task_type:'Revision',target_minutes:0},
    {subject:'Chemistry',chapter:'Some Basic Concepts in Chemistry',topic:'Day 2 of 3',task_type:'Study',target_minutes:240},
    {subject:'Physics',chapter:'Physics and Measurement',topic:'Day 2 of 2',task_type:'Study',target_minutes:240}
  ]
})

test('morning email uses approved Academy greeting and subject-card structure',()=>{
  assert.match(message.html,/Good Morning, SATHYA!/)
  assert.match(message.html,/Biological Classification/)
  assert.match(message.html,/The Living World/)
  assert.match(message.html,/Revision - I/)
  assert.match(message.html,/4 HOURS/)
  assert.match(message.html,/Some Basic Concepts in Chemistry/)
  assert.match(message.html,/Physics and Measurement/)
})

test('morning email has no study-plan button and no study-only time label',()=>{
  assert.doesNotMatch(message.html,/Open Study Plan/i)
  assert.doesNotMatch(message.html,/STUDY TIME/i)
})

test('morning email routes from official info address',()=>{
  assert.equal(message.from,'info@sathyagrahiacademy.com')
})
