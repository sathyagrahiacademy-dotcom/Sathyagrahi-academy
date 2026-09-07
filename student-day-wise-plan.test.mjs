import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html=readFileSync('student-learning-progress.html','utf8')
const js=readFileSync('student-learning-progress.js','utf8')

test('Learning Progress keeps the official NEET syllabus tracker',()=>{
  assert.match(html,/MY NEET SYLLABUS/i)
  assert.match(js,/student_learning_progress/)
  assert.match(js,/unit_no/)
  assert.match(js,/official_detail/)
})

test('student portal renders a view-only Day-wise Study Plan from the shared master source',()=>{
  assert.match(js,/academy_daily_study_plan/)
  assert.match(js,/function\s+renderDayWisePlan\s*\(/)
  assert.match(js,/DAY-WISE STUDY PLAN/)
  assert.match(js,/Today/i)
  assert.match(js,/Previous/i)
  assert.match(js,/Upcoming/i)
  assert.match(js,/4 HOURS/)
  assert.doesNotMatch(js,/from\(['"]academy_daily_study_plan['"]\)\s*\.\s*(insert|update|delete|upsert)/)
})

test('day-wise plan exposes Study Day and revision stage from the source rows',()=>{
  assert.match(js,/day_no/)
  assert.match(js,/total_days/)
  assert.match(js,/revision_stage/)
  assert.match(js,/event_type/)
})
