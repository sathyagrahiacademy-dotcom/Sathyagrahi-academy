import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const access=fs.readFileSync('supabase/functions/student-exam-access/index.ts','utf8')
const notifications=fs.readFileSync('student-notifications.js','utf8')
const html=fs.readFileSync('student-notifications.html','utf8')

test('student exam access list returns official notice metadata without password or answer keys',()=>{
  assert.match(access,/exam_type/)
  assert.match(access,/exam_date/)
  assert.match(access,/expected_questions/)
  assert.match(access,/exam_code/)
  assert.match(access,/question_count/)
  assert.doesNotMatch(access,/visible\.push\([\s\S]*password_hash/)
  assert.doesNotMatch(access,/visible\.push\([\s\S]*correct_option/)
})

test('notifications page loads eligible exams through student-exam-access instead of inserting notification rows',()=>{
  assert.match(notifications,/student-exam-access/)
  assert.match(notifications,/action\s*:\s*['"]list['"]/)
  assert.match(notifications,/SGAExamNotices/)
  assert.doesNotMatch(notifications,/from\(['"]notifications['"]\)\.insert/)
})

test('notifications UI supports a derived exam action',()=>{
  assert.match(html,/student-exam-notice-utils\.js/)
  assert.match(html,/n-action/)
  assert.match(notifications,/actionHref/)
  assert.match(notifications,/actionLabel/)
})
