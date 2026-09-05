import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const client=fs.readFileSync('student-exam-attempt.js','utf8')
const html=fs.readFileSync('student-exam-attempt.html','utf8')
const server=fs.readFileSync('supabase/functions/student-exam-attempt/index.ts','utf8')

test('attempt page loads activity utility before attempt controller',()=>{
  const util=html.indexOf('exam-question-activity-utils.js')
  const controller=html.indexOf('student-exam-attempt.js')
  assert.ok(util>=0,'activity utility script is missing')
  assert.ok(controller>util,'activity utility must load before attempt controller')
})

test('client tracks current question, foreground state, heartbeat and true answer changes',()=>{
  assert.match(client,/sgaQuestionActivity/)
  assert.match(client,/createQuestionActivityTracker/)
  assert.match(client,/visibilitychange/)
  assert.match(client,/document\.hidden/)
  assert.match(client,/window\.addEventListener\(['"]focus['"]/)
  assert.match(client,/window\.addEventListener\(['"]blur['"]/)
  assert.match(client,/setInterval\([\s\S]*15_000/)
  assert.match(client,/answerChanged\(\)/)
  assert.match(client,/previousOption/)
})

test('client sends activity through student edge function and never calls privileged RPC directly',()=>{
  assert.match(client,/action\s*:\s*['"]activity['"]/)
  assert.match(client,/activeSeconds/)
  assert.match(client,/visitDelta/)
  assert.match(client,/answerChangeDelta/)
  assert.doesNotMatch(client,/record_exam_question_activity/)
  assert.doesNotMatch(client,/\.rpc\(/)
})

test('activity failures are fail-soft and independent from answer save queue',()=>{
  assert.match(client,/Activity logging failed/)
  assert.match(client,/\.catch\([^)]*=>[^}]*console/)
  assert.match(client,/createSaveQueue/)
})

test('server activity action verifies attempt ownership and active status before service-role RPC',()=>{
  assert.match(server,/action === ['"]activity['"]/)
  assert.match(server,/attempt\.student_id !== user\.id/)
  assert.match(server,/attempt\.status !== ['"]in_progress['"]/)
  assert.match(server,/record_exam_question_activity/)
  const ownership=server.indexOf('attempt.student_id !== user.id',server.indexOf("action === 'activity'"))
  const rpc=server.indexOf('record_exam_question_activity',server.indexOf("action === 'activity'"))
  assert.ok(ownership>=0&&rpc>ownership,'ownership verification must happen before activity RPC')
})

test('server validates event and bounded deltas before activity RPC',()=>{
  assert.match(server,/eventId/)
  assert.match(server,/activeSeconds/)
  assert.match(server,/visitDelta/)
  assert.match(server,/answerChangeDelta/)
  assert.match(server,/300/)
  assert.match(server,/10/)
})

test('server RPC payload matches the database activity function parameter names',()=>{
  assert.match(server,/p_active_seconds_delta\s*:\s*activeSeconds/)
  assert.doesNotMatch(server,/p_active_seconds\s*:\s*activeSeconds/)
})