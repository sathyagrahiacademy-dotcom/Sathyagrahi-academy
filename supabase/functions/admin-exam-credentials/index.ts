import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { validateExamPassword } from '../admin-exam-wizard/password-policy.mjs'
import {
  EXAM_CREDENTIAL_KEY_VERSION,
  credentialSecretName,
  decryptExamCredential,
  encryptExamCredential,
  sha256Hex
} from '../_shared/exam-credential-crypto.mjs'

const noStoreHeaders={'Cache-Control':'no-store, private','Pragma':'no-cache','Expires':'0'}

function json(body:Record<string,unknown>,status=200,extraHeaders:Record<string,string>={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,'Content-Type':'application/json',...extraHeaders}
  })
}

function revealJson(body:Record<string,unknown>,status=200){
  return json(body,status,noStoreHeaders)
}

function firstRpcRow(data:any){
  return Array.isArray(data)?(data[0]||null):(data||null)
}

async function loadExam(admin:any,examId:string){
  const {data:exam,error:examError}=await admin.from('exams')
    .select('id,title,status,is_published,result_published')
    .eq('id',examId).maybeSingle()
  if(examError)throw new Error('Unable to load exam')
  if(!exam)return null

  const {data:access,error:accessError}=await admin.from('exam_access')
    .select('exam_code').eq('exam_id',examId).maybeSingle()
  if(accessError)throw new Error('Unable to load exam access')

  return {
    id:String(exam.id),
    title:String(exam.title||''),
    status:String(exam.status||''),
    isPublished:Boolean(exam.is_published),
    resultPublished:Boolean(exam.result_published),
    examCode:String(access?.exam_code||'').trim().toUpperCase()
  }
}

async function loadVaultRow(admin:any,examId:string){
  const {data,error}=await admin.rpc('get_exam_credential_v1',{p_exam_id:examId})
  if(error)throw new Error('Unable to load stored exam credential')
  return firstRpcRow(data)
}

function readKey(version:number){
  const name=credentialSecretName(version)
  const keyBase64=Deno.env.get(name)||''
  if(!keyBase64)throw new Error('Exam credential service is not configured')
  return keyBase64
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)

  const authHeader=req.headers.get('Authorization')||''
  if(!authHeader.startsWith('Bearer '))return json({error:'Unauthorized'},401)

  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}})
    const {data:{user},error:userError}=await userClient.auth.getUser()
    if(userError||!user)return json({error:'Unauthorized'},401)

    const {data:profile,error:profileError}=await userClient.from('profiles')
      .select('role,is_active').eq('id',user.id).single()
    if(profileError||!profile||profile.role !== 'admin'||!profile.is_active)return json({error:'Admin access required'},403)

    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(url,sec,{auth:{persistSession:false}})
    const body=await req.json().catch(()=>({}))
    const action=String(body?.action||'')
    const examId=String(body?.examId||'').trim()
    if(!examId)return json({error:'Exam ID is required'},400)

    const exam=await loadExam(admin,examId)
    if(!exam)return json({error:'Exam not found'},404)
    if(!exam.examCode)return json({error:'Exam Code not found'},409)

    if(action === 'status'){
      const vault=await loadVaultRow(admin,examId)
      return json({ok:true,exam:{
        id:exam.id,
        title:exam.title,
        examCode:exam.examCode,
        status:exam.status,
        isPublished:exam.isPublished,
        resultPublished:exam.resultPublished
      },hasStoredPassword:Boolean(vault)})
    }

    if(action === 'reveal'){
      const vault=await loadVaultRow(admin,examId)
      if(!vault)return revealJson({error:'Password not stored',code:'RESET_REQUIRED',examCode:exam.examCode},409)
      const keyVersion=Number(vault.key_version)
      const keyBase64=readKey(keyVersion)
      const password=await decryptExamCredential({
        ciphertext:String(vault.ciphertext||''),
        iv:String(vault.iv||''),
        keyVersion,
        examId,
        examCode:exam.examCode,
        keyBase64
      })
      const checked=validateExamPassword(password)
      if(!checked.ok)throw new Error('Stored exam credential is invalid')
      return revealJson({ok:true,examCode:exam.examCode,password:checked.password})
    }

    if(action === 'reset'){
      const passwordCheck=validateExamPassword(body?.newPassword)
      if(!passwordCheck.ok)return json({error:passwordCheck.error},400)

      const pureDraft=exam.status==='draft'&&!exam.isPublished&&!exam.resultPublished
      const confirmNonDraft=body?.confirmNonDraft===true
      if(!pureDraft&&!confirmNonDraft){
        return json({error:'Explicit confirmation required for non-draft exam password reset',code:'CONFIRM_NON_DRAFT_REQUIRED',examCode:exam.examCode},409)
      }

      const keyVersion=EXAM_CREDENTIAL_KEY_VERSION
      const keyBase64=readKey(keyVersion)
      const passwordHash=await sha256Hex(passwordCheck.password)
      const encrypted=await encryptExamCredential({
        password:passwordCheck.password,
        examId,
        examCode:exam.examCode,
        keyBase64
      })
      const {error:upsertError}=await admin.rpc('upsert_exam_credential_v1',{
        p_exam_id:examId,
        p_exam_code:exam.examCode,
        p_password_hash:passwordHash,
        p_ciphertext:encrypted.ciphertext,
        p_iv:encrypted.iv,
        p_key_version:encrypted.keyVersion,
        p_updated_by:user.id
      })
      if(upsertError)throw new Error('Unable to update exam credential')
      return json({ok:true,examCode:exam.examCode})
    }

    return json({error:'Unknown action'},400)
  }catch(_error){
    return json({error:'Unable to process exam credential request'},500)
  }
})
