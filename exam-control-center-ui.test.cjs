const test=require('node:test')
const assert=require('node:assert/strict')
const {
  filterControlCenterExams,
  groupConductedByMonth,
  priorityExam,
  statusLabel
}=require('./exam-control-center-ui.js')

const exam=(id,state,extra={})=>({id,title:`Exam ${id}`,examCode:`CODE-${id}`,examType:'daily',batchNo:1,examDate:'2026-09-08',state,issues:[],...extra})

test('status labels cover every master lifecycle state',()=>{
  assert.equal(statusLabel('draft'),'DRAFT')
  assert.equal(statusLabel('ready'),'READY')
  assert.equal(statusLabel('available'),'AVAILABLE')
  assert.equal(statusLabel('live'),'LIVE')
  assert.equal(statusLabel('conducted'),'CONDUCTED')
  assert.equal(statusLabel('results_ready'),'RESULTS READY')
  assert.equal(statusLabel('result_published'),'RESULT PUBLISHED')
  assert.equal(statusLabel('archived'),'ARCHIVED')
})

test('lifecycle tabs implement the approved grouping',()=>{
  const rows=['draft','ready','available','live','conducted','results_ready','result_published','archived'].map((s,i)=>exam(String(i),s))
  assert.deepEqual(filterControlCenterExams(rows,{tab:'draft'}).map(x=>x.state),['draft','ready'])
  assert.deepEqual(filterControlCenterExams(rows,{tab:'upcoming'}).map(x=>x.state),['available'])
  assert.deepEqual(filterControlCenterExams(rows,{tab:'live'}).map(x=>x.state),['live'])
  assert.deepEqual(filterControlCenterExams(rows,{tab:'conducted'}).map(x=>x.state),['conducted','results_ready','result_published'])
  assert.deepEqual(filterControlCenterExams(rows,{tab:'archived'}).map(x=>x.state),['archived'])
})

test('search type batch and month filters combine',()=>{
  const rows=[
    exam('1','available',{title:'Alpha Daily',examCode:'SGA-DT-010809',examType:'daily',batchNo:1,examDate:'2026-09-08'}),
    exam('2','available',{title:'Beta Weekly',examCode:'SGA-WT-020910',examType:'weekly',batchNo:2,examDate:'2026-10-09'})
  ]
  const out=filterControlCenterExams(rows,{search:'beta',type:'weekly',batch:'2',month:'2026-10'})
  assert.deepEqual(out.map(x=>x.id),['2'])
})

test('conducted exams group by exam date month rather than first submission',()=>{
  const groups=groupConductedByMonth([
    exam('sep','conducted',{examDate:'2026-09-08'}),
    exam('aug','result_published',{examDate:'2026-08-31'}),
    exam('open','available',{examDate:'2026-08-30'})
  ])
  assert.deepEqual(groups.map(x=>x.key),['2026-09','2026-08'])
  assert.deepEqual(groups[0].exams.map(x=>x.id),['sep'])
  assert.deepEqual(groups[1].exams.map(x=>x.id),['aug'])
})

test('priority prefers actionable today/live then live then today available then setup work',()=>{
  const rows=[
    exam('draft','draft',{examDate:'2026-09-07'}),
    exam('available','available',{examDate:'2026-09-08'}),
    exam('live','live',{examDate:'2026-09-07'}),
    exam('attention','available',{examDate:'2026-09-08',issues:[{code:'MAPPING_INCOMPLETE'}]})
  ]
  assert.equal(priorityExam(rows,{today:'2026-09-08'}).id,'attention')
  assert.equal(priorityExam(rows.filter(x=>x.id!=='attention'),{today:'2026-09-08'}).id,'live')
})
