import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const moduleUrl=new URL('./supabase/functions/academy-communications/provider-adapters.mjs',import.meta.url)
const modulePath=fileURLToPath(moduleUrl)
const edge=readFileSync(new URL('./supabase/functions/academy-communications/index.ts',import.meta.url),'utf8')

test('provider adapters module exists',()=>{
  assert.equal(existsSync(modulePath),true,'provider-adapters.mjs must exist')
})

test('WhatsApp connectivity tests are logged as test_whatsapp events',()=>{
  assert.match(edge,/eventType:['"]test_whatsapp['"]/)
})

test('Test Email dispatches only the email channel',()=>{
  const start=edge.indexOf('async function testDelivery')
  const end=edge.indexOf('async function retryDelivery',start)
  const section=edge.slice(start,end)
  const emailStart=section.indexOf("if(channel==='email')")
  const whatsappStart=section.indexOf('const sampleExam=',emailStart)
  const emailBranch=section.slice(emailStart,whatsappStart)
  assert.doesNotMatch(emailBranch,/deliverStudent\(/,'Test Email must not fan out to WhatsApp')
  assert.match(emailBranch,/channel:['"]email['"]/,'Test Email must target the email channel directly')
  assert.match(emailBranch,/return\s*\[\s*await\s+deliverChannel\(/,'Test Email response must remain an array for the Admin UI contract')
})

test('Test WhatsApp returns the same delivery-array shape as Test Email',()=>{
  const start=edge.indexOf('async function testDelivery')
  const end=edge.indexOf('async function retryDelivery',start)
  const section=edge.slice(start,end)
  const whatsappStart=section.indexOf('const sampleExam=')
  const whatsappBranch=section.slice(whatsappStart)
  assert.match(whatsappBranch,/channel:['"]whatsapp['"]/)
  assert.match(whatsappBranch,/return\s*\[\s*await\s+deliverChannel\(/,'Test WhatsApp response must be an array for the Admin UI contract')
})

if(existsSync(modulePath)){
  const {sendResendEmail,sendMetaTemplate}=await import(moduleUrl)

  test('Resend adapter keeps secret in Authorization header and sends idempotency key',async()=>{
    let request
    const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({id:'email-1'})}}
    const result=await sendResendEmail({fetchImpl,apiKey:'re_secret',idempotencyKey:'result:1:student:email',message:{from:'results@sathyagrahiacademy.com',senderName:'Sathyagrahi Academy – Results',to:'student@example.com',subject:'Result',html:'<b>Result</b>'}})
    assert.equal(request.url,'https://api.resend.com/emails')
    assert.equal(request.options.headers.Authorization,'Bearer re_secret')
    assert.equal(request.options.headers['Idempotency-Key'],'result:1:student:email')
    assert.doesNotMatch(request.options.body,/re_secret/)
    assert.equal(result.id,'email-1')
  })

  test('Meta adapter uses configured graph version phone id and utility template',async()=>{
    let request
    const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({messages:[{id:'wamid.1'}]})}}
    const result=await sendMetaTemplate({fetchImpl,accessToken:'meta_secret',apiVersion:'v99.0',phoneNumberId:'12345',to:'919876543210',templateName:'result_ready',language:'en',values:['Rahul','136/180']})
    assert.equal(request.url,'https://graph.facebook.com/v99.0/12345/messages')
    assert.equal(request.options.headers.Authorization,'Bearer meta_secret')
    const body=JSON.parse(request.options.body)
    assert.equal(body.messaging_product,'whatsapp')
    assert.equal(body.to,'919876543210')
    assert.equal(body.template.name,'result_ready')
    assert.equal(result.id,'wamid.1')
  })
}
