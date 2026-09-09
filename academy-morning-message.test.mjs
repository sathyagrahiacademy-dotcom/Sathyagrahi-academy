import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMorningMessage } from './supabase/functions/academy-morning-cron/morning-message.mjs'

const message=buildMorningMessage({
  student:{full_name:'SATHYA'},date:'2026-09-10',tasks:[
    {subject:'Biology',chapter:'Plant Kingdom',topic:'Day 1 of 3',task_type:'Study',target_minutes:240},
    {subject:'Biology',chapter:'Biological Classification',topic:'Revision - I',task_type:'Revision',target_minutes:0},
    {subject:'Chemistry',chapter:'Atomic Structure',topic:'Day 1 of 4',task_type:'Study',target_minutes:240},
    {subject:'Chemistry',chapter:'Some Basic Concepts in Chemistry',topic:'Revision - I',task_type:'Revision',target_minutes:0},
    {subject:'Physics',chapter:'Kinematics',topic:'Day 2 of 5',task_type:'Study',target_minutes:240}
  ]
})

test('morning email locks the approved Sep-10 poster header and date strip',()=>{
  assert.match(message.html,/header-brand\.png/)
  assert.match(message.html,/DISCIPLINE TODAY/)
  assert.match(message.html,/A DOCTOR TOMORROW/)
  assert.match(message.html,/MORNING STUDY PLAN/)
  assert.match(message.html,/10 SEP/)
  assert.match(message.html,/2026/)
  assert.match(message.html,/THURSDAY/)
  assert.match(message.html,/SMALL STEPS/)
  assert.match(message.html,/BIG RESULTS/)
  assert.doesNotMatch(message.html,/NEET PREPARATION SYSTEM/i)
})

test('morning email locks greeting and three approved subject cards',()=>{
  assert.match(message.html,/Good Morning, SATHYA!/)
  assert.match(message.html,/Wishing you a focused study day\./)
  assert.match(message.html,/Plant Kingdom/)
  assert.match(message.html,/Biological Classification/)
  assert.match(message.html,/Atomic Structure/)
  assert.match(message.html,/Some Basic Concepts in Chemistry/)
  assert.match(message.html,/Kinematics/)
  assert.equal((message.html.match(/STUDY TODAY/g)||[]).length,3)
  assert.equal((message.html.match(/REVISION TODAY/g)||[]).length,3)
  assert.equal((message.html.match(/4 HOURS/g)||[]).length,3)
  assert.equal((message.html.match(/STUDY TIME/g)||[]).length,3)
  assert.match(message.html,/No Revision/)
})

test('morning email locks the approved focus and footer copy',()=>{
  assert.match(message.html,/TODAY’S FOCUS/)
  assert.match(message.html,/Complete today’s study as per plan and maintain your notes\./)
  assert.match(message.html,/Sathyagrahi Academy/)
  assert.match(message.html,/CONSISTENT EFFORTS/)
  assert.match(message.html,/BRIGHTER FUTURES/)
})

test('morning email has no study-plan button',()=>{
  assert.doesNotMatch(message.html,/Open Study Plan/i)
})

test('morning email uses only the locked deep-blue white orange palette',()=>{
  const colours=[...message.html.matchAll(/#[0-9a-f]{6}/gi)].map(m=>m[0].toUpperCase())
  const allowed=new Set(['#0B2F68','#123B68','#F47A1F','#FFFFFF','#EEF6FD'])
  assert.ok(colours.length>0)
  assert.deepEqual([...new Set(colours.filter(c=>!allowed.has(c)))],[])
})

test('morning email routes from official info address',()=>{
  assert.equal(message.from,'info@sathyagrahiacademy.com')
})
