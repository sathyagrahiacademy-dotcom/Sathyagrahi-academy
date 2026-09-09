import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const nav=fs.readFileSync('admin-examinations-nav.js','utf8')

test('master Control Center is dormant unless explicitly enabled',()=>{
  assert.match(nav,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED\s*===\s*true/)
})

test('stable legacy Exams enhancement remains the default production path',()=>{
  const flag=nav.indexOf('SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED')
  const control=nav.indexOf("loadScript('examControlCenterUi'")
  const legacy=nav.indexOf("loadScript('adminExamsEnhancements'")
  assert.ok(flag>=0,'explicit master feature flag is required')
  assert.ok(control>flag,'Control Center must be behind the explicit flag')
  assert.ok(legacy>flag,'legacy path must remain available when the flag is off')
  assert.match(nav,/if\s*\(masterPhase1Enabled\)[\s\S]*examControlCenterUi[\s\S]*else[\s\S]*adminExamsEnhancements/)
})
