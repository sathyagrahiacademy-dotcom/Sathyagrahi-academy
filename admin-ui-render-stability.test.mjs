import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const control=fs.readFileSync('admin-exam-control-center.js','utf8')
const config=fs.readFileSync('supabase-config.js','utf8')

test('Master Control Center waits for the legacy exam table to finish its initial Loading state',()=>{
  assert.match(control,/countLine\.textContent\.trim\(\)===['"]Loading exams\.\.\.['"]/,'Control Center must treat the legacy Loading exams state as not ready')
  assert.match(control,/typeof rows\.onclick!==['"]function['"][^\n]*legacyReady/,'Control Center must require both the legacy row controller and finished initial render before starting')
})

test('portal navigation is applied immediately when the sidebar is already parsed',()=>{
  assert.match(config,/const portalNavPresent\s*=\s*Boolean\(/,'shared portal config must detect an already-parsed sidebar')
  const presentAt=config.indexOf('if (portalNavPresent)')
  const domReadyAt=config.indexOf("document.addEventListener('DOMContentLoaded', ensurePortalNavigation")
  assert.ok(presentAt>=0,'portal config must have an eager navigation branch')
  assert.ok(domReadyAt>=0,'portal config must retain the DOMContentLoaded fallback')
  assert.ok(presentAt<domReadyAt,'eager navigation must run before the DOMContentLoaded fallback')
  assert.match(config,/if \(portalNavPresent\) \{\s*ensurePortalNavigation\(\);/,'already-parsed sidebars must be normalized synchronously')
})
