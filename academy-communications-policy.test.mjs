import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SENDERS,
  eventKey,
  indiaDateKey,
  maskRecipient,
  normalisePhone
} from './supabase/functions/academy-communications/communication-policy.mjs'

test('locked sender aliases match Academy Google Workspace structure',()=>{
  assert.equal(SENDERS.morning_plan,'info@sathyagrahiacademy.com')
  assert.equal(SENDERS.exam_published,'exams@sathyagrahiacademy.com')
  assert.equal(SENDERS.result_published,'results@sathyagrahiacademy.com')
})

test('event keys are deterministic for exam result and morning deliveries',()=>{
  assert.equal(eventKey('exam_published',{examId:'exam-1'}),'exam_published:exam-1')
  assert.equal(eventKey('result_published',{attemptId:'attempt-7'}),'result_published:attempt-7')
  assert.equal(eventKey('morning_plan',{studentId:'student-2',date:'2026-09-06'}),'morning_plan:student-2:2026-09-06')
})

test('indiaDateKey uses Asia Kolkata calendar date',()=>{
  assert.equal(indiaDateKey('2026-09-05T20:00:00.000Z'),'2026-09-06')
  assert.equal(indiaDateKey('2026-09-06T02:00:00.000Z'),'2026-09-06')
})

test('recipient masking preserves useful shape without exposing the full value',()=>{
  assert.equal(maskRecipient('student@example.com','email'),'s*****t@example.com')
  assert.equal(maskRecipient('+91 98765 43210','whatsapp'),'********3210')
})

test('phone normalization returns digits-only international value',()=>{
  assert.equal(normalisePhone('+91 98765-43210'),'919876543210')
  assert.equal(normalisePhone('  '),'')
})
