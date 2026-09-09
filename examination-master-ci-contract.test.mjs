import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const yml=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8')

test('Examination verification runs on pull requests to main and manual dispatch',()=>{
  assert.match(yml,/pull_request:\s*\n\s*branches:\s*\n\s*- main/)
  assert.match(yml,/workflow_dispatch:/)
})

test('temporary feature-branch push trigger is removed',()=>{
  assert.doesNotMatch(yml,/feature\/examinations-master-phase-1/)
  assert.doesNotMatch(yml,/feature\/examination-intelligence-foundation/)
})

test('fast contracts include all Phase 1 master policies and UI contracts',()=>{
  for(const file of [
    'exam-master-policy.test.mjs',
    'examinations-master-foundation-schema.test.mjs',
    'exam-control-center-policy.test.mjs',
    'admin-exam-control-center-contract.test.mjs',
    'exam-control-center-ui.test.cjs',
    'admin-exam-control-center-ui.test.mjs'
  ]) assert.match(yml,new RegExp(file.replaceAll('.','\\.')))
})

test('browser syntax gate includes new Control Center JavaScript',()=>{
  assert.match(yml,/node --check exam-control-center-ui\.js/)
  assert.match(yml,/node --check admin-exam-control-center\.js/)
})

test('full root regression and Edge TypeScript parsing remain mandatory',()=>{
  assert.match(yml,/node --test \*\.test\.js \*\.test\.mjs \*\.test\.cjs/)
  assert.match(yml,/esbuild@0\.25\.9 supabase\/functions\/admin-exams\/index\.ts/)
})
