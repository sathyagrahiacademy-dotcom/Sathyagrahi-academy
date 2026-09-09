import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const nav=fs.readFileSync('admin-examinations-nav.js','utf8')
const controller=fs.readFileSync('admin-exam-control-center.js','utf8')

test('Exams page contains a gated Control Center path and stable legacy fallback',()=>{
  assert.match(nav,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED/)
  assert.match(nav,/exam-control-center-ui\.js/)
  assert.match(nav,/admin-exam-control-center\.js/)
  assert.match(nav,/admin-exams-enhancements\.js/)
})

test('Control Center requests authenticated server summary',()=>{
  assert.match(controller,/action:'control_center'/)
  assert.match(controller,/functions\/v1\/admin-exams/)
  assert.match(controller,/Authorization/)
})

test('Control Center injects approved operator dashboard regions',()=>{
  for(const id of ['examSummaryCards','todayExamCard','needsAttention','examLifecycleTabs','examTypeFilter','examBatchFilter','examMonthFilter']){
    assert.match(controller,new RegExp(id),`missing ${id}`)
  }
  for(const label of ["TODAY'S EXAMS",'UPCOMING / AVAILABLE','LIVE NOW','RESULTS PENDING','ACTION REQUIRED']){
    assert.match(controller,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  }
})

test('Control Center renders approved exam list columns and preserves data-id hooks',()=>{
  for(const heading of ['EXAM NAME','TYPE','BATCH','DATE','CODE','QUESTIONS','STUDENTS','STATUS','NEXT ACTION']){
    assert.match(controller,new RegExp(heading))
  }
  assert.match(controller,/data-id=/)
  assert.match(controller,/data-control-row/)
})

test('state actions route to existing safe exam operations and result/performance pages',()=>{
  assert.match(controller,/admin-results\.html\?exam=/)
  assert.match(controller,/admin-performance\.html\?exam=/)
  assert.match(controller,/admin-exam-questions\.html\?exam=/)
  assert.match(controller,/class="small-btn edit"/)
  assert.match(controller,/class="small-btn audience"/)
  assert.match(controller,/class="small-btn manage"/)
})

test('legacy rerenders are detected so dashboard is restored after existing operations',()=>{
  assert.match(controller,/MutationObserver/)
  assert.match(controller,/data-control-row/)
  assert.match(controller,/loadControlCenter/)
})
