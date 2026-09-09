import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { MASTER_EXAM_TYPES } from '../_shared/exam-master-policy.mjs'
import { normaliseWizardBasics } from '../admin-exams/wizard-policy.mjs'

function json(body:Record<string,unknown>,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
}

async function hashPassword(password:string){
  const bytes=new TextEncoder().encode(password)
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

async function loadCanonicalSyllabus(admin:any){
  const [unitsRes,chaptersRes,subtopicsRes]=await Promise.all([
    admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('subject').order('sort_order').order('unit_no'),
    admin.from('neet_syllabus_topics').select('id,unit_id,topic_title,sort_order').order('unit_id').order('sort_order').order('id'),
    admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,sort_order').eq('status','approved').order('chapter_id').order('sort_order').order('id')
  ])
  if(unitsRes.error) throw new Error(unitsRes.error.message)
  if(chaptersRes.error) throw new Error(chaptersRes.error.message)
  if(subtopicsRes.error) throw new Error(subtopicsRes.error.message)
  const subs=new Map<string,any[]>()
  for(const row of subtopicsRes.data||[]){const key=String(row.chapter_id);if(!subs.has(key))subs.set(key,[]);subs.get(key)!.push(row)}
  const chapters=new Map<string,any[]>()
  for(const row of chaptersRes.data||[]){const key=String(row.unit_id);if(!chapters.has(key))chapters.set(key,[]);chapters.get(key)!.push({...row,subtopics:subs.get(String(row.id))||[]})}
  return (unitsRes.data||[]).map((row:any)=>({...row,chapters:chapters.get(String(row.id))||[]}))
}

async function removePartialExam(admin:any,examId:string){
  try{await admin.from('exams').delete().eq('id',examId)}catch(_){/* best-effort cleanup */}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  const authHeader=req.headers.get('Authorization')||''
  if(!authHeader.startsWith('Bearer ')) return json({error:'Unauthorized'},401)
  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}})
    const {data:{user}}=await userClient.auth.getUser()
    if(!user) return json({error:'Unauthorized'},401)
    const {data:profile}=await userClient.from('profiles').select('role,is_active').eq('id',user.id).single()
    if(!profile||profile.role !== 'admin'||!profile.is_active) return json({error:'Admin access required'},403)
    const admin=createClient(url,sec,{auth:{persistSession:false}})
    const body=await req.json()
    const action=String(body.action||'')

    if(action === 'wizard_bootstrap'){
      const MASTER_TYPE_ORDER=['daily','weekly','monthly','grand']
      const [syllabus,studentsRes]=await Promise.all([
        loadCanonicalSyllabus(admin),
        admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','student').eq('is_active',true)
      ])
      if(studentsRes.error) return json({error:studentsRes.error.message},400)
      const types=MASTER_TYPE_ORDER.map(type=>({type,code:MASTER_EXAM_TYPES[type].code,label:MASTER_EXAM_TYPES[type].label}))
      return json({ok:true,types,syllabus,activeStudentCount:Number(studentsRes.count||0)})
    }

    if(action === 'create_master_exam'){
      const basic=normaliseWizardBasics(body)
      if(!basic.ok) return json({error:basic.error||'Invalid exam details'},400)
      const v=basic.value
      const examPassword=String(body.examPassword||'')
      if(examPassword.length<4||examPassword.length>64) return json({error:'Exam Password must be 4 to 64 characters'},400)

      const {data:exam,error:examError}=await admin.from('exams').insert({
        title:v.title,
        subject:'NEET',
        syllabus:null,
        exam_type:v.examType,
        exam_date:v.examDate,
        batch_no:v.batchNo,
        expected_questions:v.expectedQuestions,
        scheduled_start:null,
        scheduled_end:null,
        duration_minutes:v.durationMinutes,
        total_marks:v.totalMarks,
        negative_marking:true,
        instructions:v.instructions||null,
        status:'draft',
        is_published:false,
        result_published:false,
        audience_mode:'all',
        result_publish_mode:v.resultPublishMode,
        result_publish_at:v.resultPublishAt,
        blueprint_approved_at:null,
        created_by:user.id
      }).select('id').single()
      if(examError||!exam) return json({error:examError?.message||'Could not create exam'},400)

      const codeRes=await admin.rpc('allocate_exam_code_v2',{p_exam_type:v.examType,p_batch_no:v.batchNo,p_exam_date:v.examDate})
      if(codeRes.error||!codeRes.data){await removePartialExam(admin,exam.id);return json({error:codeRes.error?.message||'Could not generate Exam Code'},400)}
      const examCode=String(codeRes.data)
      const passwordHash=await hashPassword(examPassword)
      const {error:accessError}=await admin.from('exam_access').insert({exam_id:exam.id,exam_code:examCode,password_hash:passwordHash})
      if(accessError){await removePartialExam(admin,exam.id);return json({error:accessError.message||'Exam access setup failed'},400)}
      return json({ok:true,examId:exam.id,examCode,totalMarks:v.totalMarks})
    }

    if(action === 'update_master_basics'){
      const examId=String(body.examId||'')
      if(!examId) return json({error:'Exam ID is required'},400)
      const {data:exam,error:examError}=await admin.from('exams').select('id,is_published,exam_type,exam_date,batch_no,exam_access(exam_code)').eq('id',examId).maybeSingle()
      if(examError) return json({error:examError.message},400)
      if(!exam) return json({error:'Exam not found'},404)
      if(exam.is_published) return json({error:'Published master exam basics cannot be changed here'},409)
      if(body.examType!=null&&String(body.examType)!==String(exam.exam_type)) return json({error:'Exam Type cannot be changed'},409)
      if(body.batchNo!=null&&Number(body.batchNo)!==Number(exam.batch_no)) return json({error:'Batch cannot be changed'},409)
      if(body.examDate!=null&&String(body.examDate)!==String(exam.exam_date)) return json({error:'Exam Date cannot be changed'},409)

      const basic=normaliseWizardBasics({...body,examType:exam.exam_type,batchNo:exam.batch_no,examDate:exam.exam_date})
      if(!basic.ok) return json({error:basic.error||'Invalid exam details'},400)
      const v=basic.value
      const {error:updateError}=await admin.from('exams').update({
        title:v.title,
        expected_questions:v.expectedQuestions,
        duration_minutes:v.durationMinutes,
        total_marks:v.totalMarks,
        instructions:v.instructions||null,
        result_publish_mode:v.resultPublishMode,
        result_publish_at:v.resultPublishAt,
        blueprint_approved_at:null
      }).eq('id',examId)
      if(updateError) return json({error:updateError.message},400)

      const examPassword=body.examPassword==null?'':String(body.examPassword)
      if(examPassword){
        if(examPassword.length<4||examPassword.length>64) return json({error:'Exam Password must be 4 to 64 characters'},400)
        const passwordHash=await hashPassword(examPassword)
        const {error:accessError}=await admin.from('exam_access').update({password_hash:passwordHash}).eq('exam_id',examId)
        if(accessError) return json({error:accessError.message},400)
      }
      return json({ok:true,examId,totalMarks:v.totalMarks})
    }

    return json({error:'Unknown action'},400)
  }catch(error){
    console.error('admin-exam-wizard failed',error)
    return json({error:error instanceof Error?error.message:'Unexpected error'},500)
  }
})
