import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const authUrl=new URL('./supabase/functions/academy-communications/auth-policy.mjs',import.meta.url)
const authPath=fileURLToPath(authUrl)
const indexUrl=new URL('./supabase/functions/academy-communications/index.ts',import.meta.url)
const indexPath=fileURLToPath(indexUrl)

test('communications auth policy and Edge entrypoint exist',()=>{
  assert.equal(existsSync(authPath),true,'auth-policy.mjs must exist')
  assert.equal(existsSync(indexPath),true,'academy-communications/index.ts must exist')
})

if(existsSync(authPath)){
  const {isInternalAuthorised,providerReadiness}=await import(authUrl)

  test('internal actions require an exact non-empty server secret',()=>{
    assert.equal(isInternalAuthorised({provided:'',expected:''}),false)
    assert.equal(isInternalAuthorised({provided:'wrong',expected:'secret'}),false)
    assert.equal(isInternalAuthorised({provided:'secret',expected:'secret'}),true)
  })

  test('provider readiness returns booleans only and never secret values',()=>{
    const ready=providerReadiness({
      RESEND_API_KEY:'re_super_secret',
      META_WHATSAPP_ACCESS_TOKEN:'meta_secret',
      META_WHATSAPP_PHONE_NUMBER_ID:'12345',
      META_GRAPH_API_VERSION:'v99.0',
      WHATSAPP_TEMPLATE_MORNING_PLAN:'morning_plan',
      WHATSAPP_TEMPLATE_EXAM_PUBLISHED:'exam_published',
      WHATSAPP_TEMPLATE_RESULT_PUBLISHED:'result_published'
    })
    assert.deepEqual(ready,{email:{configured:true},whatsapp:{configured:true}})
    assert.doesNotMatch(JSON.stringify(ready),/secret|re_super/i)
  })
}

if(existsSync(indexPath)){
  const source=readFileSync(indexPath,'utf8')
  test('Edge function has separate Admin JWT and trusted internal authorization paths',()=>{
    assert.match(source,/x-sga-internal-key/i)
    assert.match(source,/auth\.getUser\(/)
    assert.match(source,/role[^\n]+admin/i)
    assert.match(source,/is_active/)
  })

  test('Edge function never sends provider secrets in its JSON status payload',()=>{
    assert.doesNotMatch(source,/json\([^\n]*(RESEND_API_KEY|META_WHATSAPP_ACCESS_TOKEN|ACADEMY_COMMUNICATIONS_INTERNAL_KEY)/)
  })
}
