import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const legacy=fs.readFileSync('admin-exams.js','utf8')
const control=fs.readFileSync('admin-exam-control-center.js','utf8')

function adminSidebarPages(){
  return fs.readdirSync('.').filter(name=>/^admin-.*\.html$/.test(name)).filter(name=>{
    const html=fs.readFileSync(name,'utf8')
    return /<aside[\s>]/i.test(html)&&/<nav[\s>]/i.test(html)&&html.includes('admin-notifications.html')&&html.includes('admin-help-feedback.html')
  })
}

test('Master Control Center waits until the legacy exam controller has finished its initial render',()=>{
  const ready='window.SGA_ADMIN_EXAMS_LEGACY_READY=true'
  const readyAt=legacy.lastIndexOf(ready)
  const finalLoadAt=legacy.lastIndexOf('await load()')
  assert.ok(readyAt>finalLoadAt,'legacy controller must publish readiness only after its final initial load/render')
  assert.match(control,/SGA_ADMIN_EXAMS_LEGACY_READY/,'Control Center must wait for the explicit legacy-ready signal instead of rows.onclick alone')
})

test('every admin sidebar renders Communications statically before first paint',()=>{
  const pages=adminSidebarPages()
  assert.ok(pages.length>=10,'expected admin pages with sidebars')
  const invalid=[]
  for(const name of pages){
    const html=fs.readFileSync(name,'utf8')
    const notifications=html.indexOf('href="admin-notifications.html"')
    const communications=html.indexOf('href="admin-communications.html"')
    const help=html.indexOf('href="admin-help-feedback.html"')
    if(!(notifications>=0&&communications>notifications&&help>communications))invalid.push(name)
  }
  assert.deepEqual(invalid,[],`Communications is missing or out of canonical order in: ${invalid.join(', ')}`)
})
