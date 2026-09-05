const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const utilPath='./student-exam-notice-utils.js'

test('exam notice utility exists',()=>{
  assert.ok(fs.existsSync(utilPath),'student exam notice utility is missing')
})

test('eligible exam becomes a derived notification with official metadata and action',t=>{
  if(!fs.existsSync(utilPath))return t.skip('utility not implemented yet')
  const {buildExamNotice}=require(utilPath)
  const notice=buildExamNotice({
    id:'exam-1',title:'Daily Thermodynamics Test',subject:'Chemistry',syllabus:'Thermodynamics — Entropy',
    exam_type:'daily',exam_date:'2026-09-06',exam_code:'SGA-DLY-20260906-001',question_count:45,duration_minutes:45,total_marks:180,
    can_start:true,attempt_count:0,max_attempts:1
  })
  assert.equal(notice.kind,'exam')
  assert.equal(notice.id,'exam:exam-1')
  assert.equal(notice.title,'Daily Thermodynamics Test')
  assert.match(notice.message,/Daily Exam/)
  assert.match(notice.message,/SGA-DLY-20260906-001/)
  assert.match(notice.message,/06 Sep 2026/)
  assert.match(notice.message,/45 questions/)
  assert.match(notice.message,/45 min/)
  assert.match(notice.message,/180 marks/)
  assert.match(notice.message,/Thermodynamics — Entropy/)
  assert.equal(notice.actionHref,'student-examinations.html?exam=exam-1')
  assert.equal(notice.actionLabel,'OPEN EXAM')
})

test('completed assigned exam remains an exam notice but action explains completion',t=>{
  if(!fs.existsSync(utilPath))return t.skip('utility not implemented yet')
  const {buildExamNotice}=require(utilPath)
  const notice=buildExamNotice({id:'exam-2',title:'Unit Test',subject:'NEET',exam_type:'unit',exam_date:'2026-09-05',exam_code:'SGA-UNT-20260905-001',question_count:180,duration_minutes:180,total_marks:720,can_start:false,attempt_count:1,max_attempts:1})
  assert.equal(notice.actionHref,'student-examinations.html')
  assert.equal(notice.actionLabel,'VIEW EXAM')
  assert.match(notice.message,/Completed|attempt/i)
})

test('exam notice safely falls back for legacy exam metadata',t=>{
  if(!fs.existsSync(utilPath))return t.skip('utility not implemented yet')
  const {buildExamNotice}=require(utilPath)
  const notice=buildExamNotice({id:'legacy-1',title:'Weekly Test',subject:'Physics',syllabus:'Kinematics',duration_minutes:60,total_marks:180,question_count:45,can_start:true})
  assert.match(notice.message,/Physics/)
  assert.match(notice.message,/Kinematics/)
  assert.doesNotMatch(notice.message,/undefined|null/)
})
