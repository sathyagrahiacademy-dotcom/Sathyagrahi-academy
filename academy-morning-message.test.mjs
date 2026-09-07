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

test('morning email uses approved Academy greeting and aligned subject-card structure',()=>{
  assert.match(message.html,/Good Morning, SATHYA!/)
  assert.match(message.html,/Biological Classification/)
  assert.match(message.html,/The Living World/)
  assert.match(message.html,/Revision - I/)
  assert.match(message.html,/Some Basic Concepts in Chemistry/)
  assert.match(message.html,/Physics and Measurement/)
  assert.match(message.html,/rowspan="2"/)
  assert.equal((message.html.match(/4 HOURS/g)||[]).length,3)
})

test('morning email has no study-plan button and no study-only time label',()=>{
  assert.doesNotMatch(message.html,/Open Study Plan/i)
  assert.doesNotMatch(message.html,/STUDY TIME/i)
})

test('morning email uses only the locked deep-blue white orange palette',()=>{
  const colours=[...message.html.matchAll(/#[0-9a-f]{6}/gi)].map(m=>m[0].toUpperCase())
  const allowed=new Set(['#0B2F68','#123B68','#F47A1F','#FFFFFF'])
  assert.ok(colours.length>0)
  assert.deepEqual([...new Set(colours.filter(c=>!allowed.has(c)))],[])
})

test('morning email routes from official info address',()=>{
  assert.equal(message.from,'info@sathyagrahiacademy.com')
})
