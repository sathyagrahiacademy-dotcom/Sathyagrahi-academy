import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const control=fs.readFileSync('admin-exam-control-center.js','utf8')
const config=fs.readFileSync('supabase-config.js','utf8')

test('Master Control Center does not wait for the legacy table to visibly render',()=>{
  assert.doesNotMatch(control,/legacyReady|Loading exams\.\.\./,'Master startup must not depend on the legacy visible renderer')
  assert.match(control,/if\(typeof rows\.onclick!==['"]function['"]\)\{setTimeout\(waitForLegacy,25\);return\}/,'Control Center may wait only for legacy action binding compatibility')
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
