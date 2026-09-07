import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyPlanFromChapters } from './academy-study-plan.mjs'

const rows=[
  {subject:'Biology',chapter_no:1,chapter:'The Living World',study_start:'2026-09-07',study_end:'2026-09-07',r1_date:'2026-09-08',r2_date:'2026-09-14',r3_date:'2026-09-28',r4_date:'2026-10-22',planned_minutes:240},
  {subject:'Biology',chapter_no:2,chapter:'Biological Classification',study_start:'2026-09-08',study_end:'2026-09-09',r1_date:'2026-09-10',r2_date:'2026-09-16',r3_date:'2026-09-30',r4_date:'2026-10-24',planned_minutes:240},
  {subject:'Chemistry',chapter_no:1,chapter:'Some Basic Concepts in Chemistry',study_start:'2026-09-07',study_end:'2026-09-09',r1_date:'2026-09-10',r2_date:'2026-09-16',r3_date:'2026-09-30',r4_date:'2026-10-24',planned_minutes:240},
  {subject:'Physics',chapter_no:1,chapter:'Physics and Measurement',study_start:'2026-09-07',study_end:'2026-09-08',r1_date:'2026-09-09',r2_date:'2026-09-15',r3_date:'2026-09-29',r4_date:'2026-10-23',planned_minutes:240}
]

test('08 Sep plan derives study day and revision from master calendar',()=>{
  const plan=dailyPlanFromChapters(rows,'2026-09-08')
  assert.deepEqual(plan.map(x=>({subject:x.subject,study:x.study?.chapter,day:x.study?.dayLabel,revision:x.revisions.map(r=>`${r.chapter}:${r.stage}`),minutes:x.plannedMinutes})),[
    {subject:'Biology',study:'Biological Classification',day:'Day 1 of 2',revision:['The Living World:R1'],minutes:240},
    {subject:'Chemistry',study:'Some Basic Concepts in Chemistry',day:'Day 2 of 3',revision:[],minutes:240},
    {subject:'Physics',study:'Physics and Measurement',day:'Day 2 of 2',revision:[],minutes:240}
  ])
})

test('revision stage comes from source dates instead of visual hard-coding',()=>{
  const biology=dailyPlanFromChapters(rows,'2026-09-08').find(x=>x.subject==='Biology')
  assert.equal(biology.revisions[0].stage,'R1')
})
