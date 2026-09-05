const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const path='./exam-question-activity-utils.js'

test('question activity utility exists',()=>assert.ok(fs.existsSync(path),'question activity utility is missing'))

function load(t){
  if(!fs.existsSync(path)){t.skip('utility not implemented yet');return null}
  return require(path)
}

test('counts only foreground active time and records one visit on first entry',t=>{
  const api=load(t);if(!api)return
  let now=0,seq=0
  const tracker=api.createQuestionActivityTracker({now:()=>now,eventId:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`})
  tracker.enter('q1',{active:true})
  now=5000
  tracker.setActive(false)
  now=15000
  tracker.setActive(true)
  now=19000
  const event=tracker.flush()
  assert.equal(event.questionId,'q1')
  assert.equal(event.activeSeconds,9)
  assert.equal(event.visitDelta,1)
  assert.equal(event.answerChangeDelta,0)
})

test('switching question flushes old question and starts a new visit without double-counting rerender',t=>{
  const api=load(t);if(!api)return
  let now=0,seq=0
  const tracker=api.createQuestionActivityTracker({now:()=>now,eventId:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`})
  assert.equal(tracker.enter('q1',{active:true}),null)
  now=3000
  assert.equal(tracker.enter('q1',{active:true}),null,'same-question rerender must not create a new visit')
  now=7000
  const old=tracker.enter('q2',{active:true})
  assert.equal(old.questionId,'q1')
  assert.equal(old.activeSeconds,7)
  assert.equal(old.visitDelta,1)
  now=9000
  const current=tracker.flush()
  assert.equal(current.questionId,'q2')
  assert.equal(current.activeSeconds,2)
  assert.equal(current.visitDelta,1)
})

test('answer changes are additive and reset after a flush',t=>{
  const api=load(t);if(!api)return
  let now=0,seq=0
  const tracker=api.createQuestionActivityTracker({now:()=>now,eventId:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`})
  tracker.enter('q1',{active:true})
  tracker.answerChanged();tracker.answerChanged()
  now=1000
  const first=tracker.flush()
  assert.equal(first.answerChangeDelta,2)
  now=2000
  const second=tracker.flush()
  assert.equal(second.answerChangeDelta,0)
  assert.equal(second.visitDelta,0)
  assert.notEqual(first.eventId,second.eventId)
})

test('flush emits visit or answer-change events even below one second, but emits nothing when no deltas exist',t=>{
  const api=load(t);if(!api)return
  let now=0,seq=0
  const tracker=api.createQuestionActivityTracker({now:()=>now,eventId:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`})
  tracker.enter('q1',{active:true})
  now=250
  const first=tracker.flush()
  assert.equal(first.activeSeconds,0)
  assert.equal(first.visitDelta,1)
  const nothing=tracker.flush()
  assert.equal(nothing,null)
  tracker.answerChanged()
  const changed=tracker.flush()
  assert.equal(changed.activeSeconds,0)
  assert.equal(changed.answerChangeDelta,1)
})

test('long stalled samples are capped to avoid counting device sleep as active study time',t=>{
  const api=load(t);if(!api)return
  let now=0,seq=0
  const tracker=api.createQuestionActivityTracker({now:()=>now,eventId:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`,maxSampleMs:30000})
  tracker.enter('q1',{active:true})
  now=10*60*1000
  const event=tracker.flush()
  assert.equal(event.activeSeconds,30)
})
