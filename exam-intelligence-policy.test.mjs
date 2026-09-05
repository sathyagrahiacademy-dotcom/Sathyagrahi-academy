import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXAM_TYPES,
  templateForExamType,
  buildExamCode,
  allowedQuestionTypes,
  validateQuestionType,
  validateOfficialQuestionMarking,
  validateExamTemplateCounts
} from './supabase/functions/_shared/exam-intelligence-policy.mjs'

test('official exam types are Daily Unit and Monthly only',()=>{
  assert.deepEqual(Object.keys(EXAM_TYPES).sort(),['daily','monthly','unit'])
})

test('Daily exam template is fixed at 45 questions 45 minutes and 180 marks',()=>{
  assert.deepEqual(templateForExamType('daily'),{
    code:'DLY',questions:45,durationMinutes:45,totalMarks:180,negativeMarking:true
  })
})

test('Unit and Monthly templates are fixed at 180 questions and 720 marks',()=>{
  assert.deepEqual(templateForExamType('unit'),{
    code:'UNT',questions:180,durationMinutes:180,totalMarks:720,negativeMarking:true
  })
  assert.deepEqual(templateForExamType('monthly'),{
    code:'MON',questions:180,durationMinutes:180,totalMarks:720,negativeMarking:true
  })
})

test('buildExamCode uses academy type date and three digit sequence',()=>{
  assert.equal(buildExamCode({type:'unit',date:'2026-09-20',sequence:2}),'SGA-UNT-20260920-002')
  assert.equal(buildExamCode({type:'daily',date:'2026-09-05',sequence:1}),'SGA-DLY-20260905-001')
})

test('buildExamCode rejects invalid date and out of range sequence',()=>{
  assert.throws(()=>buildExamCode({type:'daily',date:'05-09-2026',sequence:1}),/date/i)
  assert.throws(()=>buildExamCode({type:'daily',date:'2026-09-05',sequence:0}),/sequence/i)
  assert.throws(()=>buildExamCode({type:'daily',date:'2026-09-05',sequence:1000}),/sequence/i)
})

test('Physics question formats include Circuit Based',()=>{
  assert.ok(allowedQuestionTypes('Physics').includes('Circuit Based'))
  assert.equal(validateQuestionType('Physics','Circuit Based').ok,true)
})

test('Biology rejects Circuit Based question format',()=>{
  assert.equal(validateQuestionType('Biology','Circuit Based').ok,false)
})

test('Chemistry accepts Reaction Product question format',()=>{
  assert.equal(validateQuestionType('Chemistry','Reaction / Product').ok,true)
})

test('official bank marking requires plus four and minus one',()=>{
  assert.equal(validateOfficialQuestionMarking({marks:4,negativeMarks:1}).ok,true)
  assert.equal(validateOfficialQuestionMarking({marks:3,negativeMarks:1}).ok,false)
  assert.equal(validateOfficialQuestionMarking({marks:4,negativeMarks:0}).ok,false)
})

test('Monthly exam requires 45 Physics 45 Chemistry 90 Biology',()=>{
  assert.equal(validateExamTemplateCounts({examType:'monthly',examSubject:'NEET',totalQuestions:180,subjectCounts:{Physics:45,Chemistry:45,Biology:90}}).ok,true)
  assert.equal(validateExamTemplateCounts({examType:'monthly',examSubject:'NEET',totalQuestions:180,subjectCounts:{Physics:50,Chemistry:40,Biology:90}}).ok,false)
})

test('single subject Daily exam requires all 45 questions from that subject',()=>{
  assert.equal(validateExamTemplateCounts({examType:'daily',examSubject:'Chemistry',totalQuestions:45,subjectCounts:{Physics:0,Chemistry:45,Biology:0}}).ok,true)
  assert.equal(validateExamTemplateCounts({examType:'daily',examSubject:'Chemistry',totalQuestions:45,subjectCounts:{Physics:5,Chemistry:40,Biology:0}}).ok,false)
})

test('mixed Daily exam accepts any subject distribution totaling 45',()=>{
  assert.equal(validateExamTemplateCounts({examType:'daily',examSubject:'Mixed',totalQuestions:45,subjectCounts:{Physics:15,Chemistry:15,Biology:15}}).ok,true)
})
