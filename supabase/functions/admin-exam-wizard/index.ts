import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { MASTER_EXAM_TYPES } from '../_shared/exam-master-policy.mjs'
import { normaliseWizardBasics, validateResultRelease } from '../admin-exams/wizard-policy.mjs'
import { normaliseAudience } from '../admin-exams/audience-policy.mjs'
import { validateExamPassword } from './password-policy.mjs'

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

async function activeStudents(admin:any){
  const {data,error}=await admin.from('profiles').select('id,full_name,student_id').eq('role','student').eq('is_active',true).order('full_name')
  if(error)throw new Error(error.message)
  return data||[]
}

async function assignmentMap(admin:any,examId:string){
  const {data,error}=await admin.from('exam_student_assignments').select('student_id,is_assigned,max_attempts').eq('exam_id',examId)
  if(error)throw new Error(error.message)
  return new Map((data||[]).map((row:any)=>[String(row.student_id),row]))
}

async function applyAudience(admin:any,examId:string,mode:string,studentIds:unknown){
  const norm=normaliseAudience(mode,studentIds)
  if(!norm.ok)return norm
  const students=await activeStudents(admin)
  const activeIds=new Set(students.map((student:any)=>String(student.id)))
  const targetIds=norm.mode==='all'?[...activeIds]:norm.studentIds
  if(!targetIds.length)return {ok:false,error:'Select at least one student'}
  if(targetIds.some((id:string)=>!activeIds.has(id)))return {ok:false,error:'One or more selected students are not active'}
  const existing=await assignmentMap(admin,examId)
  const now=new Date().toISOString()
  const {error:offError}=await admin.from('exam_student_assignments').update({is_assigned:false,updated_at:now}).eq('exam_id',examId)
  if(offError)return {ok:false,error:offError.message}
  const rows=targetIds.map((studentId:string)=>({
    exam_id:examId,
    student_id:studentId,
    is_assigned:true,
    max_attempts:Math.max(1,Number(existing.get(studentId)?.max_attempts)||1),
    updated_at:now
  }))
  const {error:upsertError}=await admin.from('exam_student_assignments').upsert(rows,{onConflict:'exam_id,student_id'})
  if(upsertError)return {ok:false,error:upsertError.message}
  const {error:examError}=await admin.from('exams').update({audience_mode:norm.mode}).eq('id',examId)
  if(examError)return {ok:false,error:examError.message}
  return {ok:true,mode:norm.mode,assignedCount:targetIds.length}
}

async function callAdminExams(url:string,pub:string,authHeader:string,body:Record<string,unknown>){
  const response=await fetch(`${url}/functions/v1/admin-exams`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':authHeader,'apikey':pub},
    body:JSON.stringify(body)
  })
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(String(data?.error||'Exam validation request failed'))
  return data
}

function isMasterType(value:unknown){
  return ['daily','weekly','monthly','grand'].includes(String(value||'').toLowerCase())
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
      const passwordCheck=validateExamPassword(body.examPassword)
      if(!passwordCheck.ok) return json({error:passwordCheck.error},400)

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
      const passwordHash=await hashPassword(passwordCheck.password)
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
        const passwordCheck=validateExamPassword(examPassword)
        if(!passwordCheck.ok) return json({error:passwordCheck.error},400)
        const passwordHash=await hashPassword(passwordCheck.password)
        const {error:accessError}=await admin.from('exam_access').update({password_hash:passwordHash}).eq('exam_id',examId)
        if(accessError) return json({error:accessError.message},400)
      }
      return json({ok:true,examId,totalMarks:v.totalMarks})
    }

    if(action === 'get_master_scope'){
      const examId=String(body.examId||'')
      if(!examId) return json({error:'Exam ID is required'},400)
      const {data:exam,error:examError}=await admin.from('exams').select('id,expected_questions').eq('id',examId).maybeSingle()
      if(examError) return json({error:examError.message},400)
      if(!exam) return json({error:'Exam not found'},404)
      const {data:items,error:scopeError}=await admin.from('exam_scope_items')
        .select('unit_id,chapter_id,subtopic_id,sort_order,planned_questions')
        .eq('exam_id',examId).order('sort_order').order('id')
      if(scopeError) return json({error:scopeError.message},400)
      return json({ok:true,examId,expectedQuestions:Number(exam.expected_questions||0),items:items||[]})
    }

    if(action === 'replace_master_scope'){
      const examId=String(body.examId||'')
      if(!examId) return json({error:'Exam ID is required'},400)
      const items=Array.isArray(body.items)?body.items:[]
      const {data:exam,error:examError}=await admin.from('exams').select('id,is_published,expected_questions').eq('id',examId).maybeSingle()
      if(examError) return json({error:examError.message},400)
      if(!exam) return json({error:'Exam not found'},404)
      if(exam.is_published) return json({error:'Published exam coverage cannot be changed here'},409)
      if(!items.length) return json({error:'Add at least one coverage row'},400)
      const plannedTotal=items.reduce((sum:number,item:any)=>sum+(Number.isInteger(Number(item?.plannedQuestions))?Number(item.plannedQuestions):0),0)
      if(items.some((item:any)=>!Number.isInteger(Number(item?.plannedQuestions))||Number(item.plannedQuestions)<=0)) return json({error:'Every coverage row needs positive Questions Planned'},400)
      if(plannedTotal!==Number(exam.expected_questions||0)) return json({error:`Coverage planned total must equal ${Number(exam.expected_questions||0)} questions`},400)
      const rpc=await admin.rpc('replace_exam_scope_items_v3',{p_exam_id:examId,p_items:items,p_created_by:user.id})
      if(rpc.error) return json({error:rpc.error.message},400)
      const {error:invalidateError}=await admin.from('exams').update({blueprint_approved_at:null}).eq('id',examId)
      if(invalidateError) return json({error:invalidateError.message},400)
      return json({ok:true,examId,plannedTotal,count:Number(rpc.data?.count||items.length),items:rpc.data?.items||items})
    }

    if(action === 'master_students'){
      const examId=String(body.examId||'')
      if(!examId)return json({error:'Exam ID is required'},400)
      const {data:exam,error:examError}=await admin.from('exams').select('id,title,exam_type,exam_date,batch_no,duration_minutes,total_marks,is_published,audience_mode,result_publish_mode,result_publish_at,blueprint_approved_at').eq('id',examId).maybeSingle()
      if(examError)return json({error:examError.message},400)
      if(!exam)return json({error:'Exam not found'},404)
      if(!isMasterType(exam.exam_type))return json({error:'Master audience is available only for DT/WT/MT/GT exams'},409)
      const [students,assignments]=await Promise.all([activeStudents(admin),assignmentMap(admin,examId)])
      const rows=students.map((student:any)=>({
        id:student.id,
        full_name:student.full_name||'',
        student_id:student.student_id||'',
        assigned:Boolean(assignments.get(String(student.id))?.is_assigned)
      }))
      const assignedCount=rows.filter((row:any)=>row.assigned).length
      return json({ok:true,exam:{id:exam.id,title:exam.title,examType:exam.exam_type,examDate:exam.exam_date,batchNo:exam.batch_no,durationMinutes:exam.duration_minutes,totalMarks:exam.total_marks,isPublished:Boolean(exam.is_published),audienceMode:exam.audience_mode||'all',resultPublishMode:exam.result_publish_mode||'manual',resultPublishAt:exam.result_publish_at||null,blueprintApprovedAt:exam.blueprint_approved_at||null},students:rows,assignedCount})
    }

    if(action === 'save_master_audience'){
      const examId=String(body.examId||'')
      if(!examId)return json({error:'Exam ID is required'},400)
      const {data:exam,error:examError}=await admin.from('exams').select('id,is_published,exam_type').eq('id',examId).maybeSingle()
      if(examError)return json({error:examError.message},400)
      if(!exam)return json({error:'Exam not found'},404)
      if(!isMasterType(exam.exam_type))return json({error:'Master audience is available only for DT/WT/MT/GT exams'},409)
      if(exam.is_published)return json({error:'Published exam audience changes require the protected post-publish workflow'},409)
      const result=await applyAudience(admin,examId,String(body.mode||''),body.studentIds)
      if(!result.ok)return json({error:result.error||'Could not save audience'},400)
      const assignedCount=Number(result.assignedCount||0)
      if(assignedCount<=0)return json({error:'Select at least one student'},400)
      return json({ok:true,examId,mode:result.mode,assignedCount})
    }

    if(action === 'publish_master_exam'){
      const examId=String(body.examId||'')
      if(!examId)return json({error:'Exam ID is required'},400)
      const {data:exam,error:examError}=await admin.from('exams').select('id,title,exam_type,exam_date,batch_no,duration_minutes,total_marks,expected_questions,is_published,status,blueprint_approved_at,result_publish_mode,result_publish_at').eq('id',examId).maybeSingle()
      if(examError)return json({error:examError.message},400)
      if(!exam)return json({error:'Exam not found'},404)
      if(!isMasterType(exam.exam_type))return json({error:'Master publish is available only for DT/WT/MT/GT exams'},409)
      if(exam.is_published)return json({ok:true,examId,alreadyPublished:true,status:exam.status||'active'})

      const resultRelease=validateResultRelease({mode:exam.result_publish_mode,publishAt:exam.result_publish_at})
      if(!resultRelease.ok)return json({error:resultRelease.error||'Result release configuration is invalid'},409)

      const blueprint=await callAdminExams(url,pub,authHeader,{action:'master_blueprint_validation',examId})
      if(blueprint?.validation?.ok!==true)return json({error:'Blueprint has unresolved validation issues.',status:blueprint?.status||'ACTION REQUIRED',validation:blueprint?.validation||null},409)
      if(!exam.blueprint_approved_at)return json({error:'Approve the current Blueprint before publishing.'},409)

      const [students,assignments]=await Promise.all([activeStudents(admin),assignmentMap(admin,examId)])
      const assignedCount=students.reduce((count:number,student:any)=>count+(assignments.get(String(student.id))?.is_assigned?1:0),0)
      if(assignedCount<=0)return json({error:'Assign at least one active student before publishing.'},409)

      const {error:publishError}=await admin.from('exams').update({
        is_published:true,
        status:'active',
        scheduled_start:null,
        scheduled_end:null
      }).eq('id',examId).eq('is_published',false)
      if(publishError)return json({error:publishError.message},400)

      return json({
        ok:true,
        examId,
        status:'active',
        assignedCount,
        portalNotification:true,
        startPolicy:'Start Anytime while available',
        resultRelease:{mode:resultRelease.mode,publishAt:resultRelease.publishAt}
      })
    }

    return json({error:'Unknown action'},400)
  }catch(error){
    console.error('admin-exam-wizard failed',error)
    return json({error:error instanceof Error?error.message:'Unexpected error'},500)
  }
})