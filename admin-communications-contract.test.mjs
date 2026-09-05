import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const htmlUrl=new URL('./admin-communications.html',import.meta.url)
const jsUrl=new URL('./admin-communications.js',import.meta.url)
const htmlPath=fileURLToPath(htmlUrl),jsPath=fileURLToPath(jsUrl)
const html=existsSync(htmlPath)?readFileSync(htmlPath,'utf8'):''
const js=existsSync(jsPath)?readFileSync(jsPath,'utf8'):''

test('Admin Communications page and script exist',()=>{
  assert.equal(existsSync(htmlPath),true,'admin-communications.html must exist')
  assert.equal(existsSync(jsPath),true,'admin-communications.js must exist')
})

test('Admin can control channels events and Morning Plan time',()=>{
  for(const id of ['emailEnabled','whatsappEnabled','morningPlanEnabled','examPublishedEnabled','resultPerformanceEnabled','morningSendTime']){
    assert.match(html,new RegExp(`id=["']${id}["']`))
  }
})

test('locked Google Workspace sender map is visible',()=>{
  assert.match(html,/info@sathyagrahiacademy\.com/)
  assert.match(html,/exams@sathyagrahiacademy\.com/)
  assert.match(html,/results@sathyagrahiacademy\.com/)
})

test('provider readiness tests and delivery log controls are present',()=>{
  for(const id of ['emailProviderStatus','whatsappProviderStatus','testStudent','testEmail','testWhatsapp','deliveryRows']){
    assert.match(html,new RegExp(`id=["']${id}["']`))
  }
  assert.match(js,/retry_delivery/)
})

test('frontend calls communication Edge Function and never writes communication tables directly',()=>{
  assert.match(js,/functions\/v1\/academy-communications/)
  assert.doesNotMatch(js,/\.from\(['"]academy_communication_/)
})

test('provider secrets are neither requested nor rendered in browser UI',()=>{
  assert.doesNotMatch(html,/(resend.*api.*key|meta.*access.*token|internal.*key)/i)
  assert.doesNotMatch(js,/(RESEND_API_KEY|META_WHATSAPP_ACCESS_TOKEN|ACADEMY_COMMUNICATIONS_INTERNAL_KEY)/)
})

test('principal Admin pages link to Communications',()=>{
  for(const file of ['admin-dashboard.html','admin-settings.html','admin-exams.html','admin-results.html']){
    const source=readFileSync(new URL(`./${file}`,import.meta.url),'utf8')
    assert.match(source,/href=["']admin-communications\.html["']/,`${file} must link to Communications`)
  }
})
