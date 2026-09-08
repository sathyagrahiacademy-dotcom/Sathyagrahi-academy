import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildResultDayMessage, deliveryEventKey } from './result-message.mjs'
import { sendResendEmail } from './resend.mjs'

const text=(value:unknown)=>String(value??'').trim()
function json(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})}
function maskEmail(value:unknown){
  const email=text(value).toLowerCase(),at=email.indexOf('@')
  if(at<=0)return email?'***':''
  const local=email.slice(0,at),domain=email.slice(at+1)
  if(local.length===1)return `*@${domain}`
  if(local.length===2)return `${local[0]}*@${domain}`
  return `${local[0]}${'*'.repeat(local.length-2)}${local.at(-1)}@${domain}`
}

async function audience(admin:any,exam:any){
  const {data:students,error}=await admin.from('profiles')
    .select('id,full_name,student_id,email').eq('role','student').eq('is_active',true).order('full_name')
  if(error)throw new Error(error.message)
  if(exam.audience_mode!=='selected')return students||[]
  const {data:assignments,error:assignmentError}=await admin.from('exam_student_assignments')
    .select('student_id').eq('exam_id',exam.id).eq('is_assigned',true)
  if(assignmentError)throw new Error(assignmentError.message)
  const allowed=new Set((assignments||[]).map((row:any)=>text(row.student_id)))
  return (students||[]).filter((row:any)=>allowed.has(text(row.id)))
}

async function latestAttempt(admin:any,examId:string,studentId:string){
  const {data,error}=await admin.from('exam_attempts')
    .select('id,attempt_no,status,submitted_at')
    .eq('exam_id',examId).eq('student_id',studentId)
    .in('status',['submitted','auto_submitted','graded'])
    .order('attempt_no',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error(error.message)
  return data||null
}

async function publishedResult(admin:any,attemptId:string){
  const {data,error}=await admin.from('exam_results')
    .select('attempt_id,total_score,correct_count,wrong_count,unattempted_count,percentage,graded_at,is_published')
    .eq('attempt_id',attemptId).eq('is_published',true).maybeSingle()
  if(error)throw new Error(error.message)
  return data||null
}

async function subjectPerformance(admin:any,attemptId:string){
  const {data:rows,error}=await admin.from('exam_scope_performance')
    .select('unit_id,earned_marks,max_marks,percentage').eq('attempt_id',attemptId).eq('scope_level','unit')
  if(error)throw new Error(error.message)
  if(!rows?.length)return []
  const unitIds=[...new Set(rows.map((row:any)=>Number(row.unit_id)).filter(Number.isFinite))]
  if(!unitIds.length)return []
  const {data:units,error:unitError}=await admin.from('neet_syllabus_units').select('id,subject').in('id',unitIds)
  if(unitError)throw new Error(unitError.message)
  const subjectByUnit=new Map((units||[]).map((row:any)=>[String(row.id),text(row.subject)]))
  const sums=new Map<string,{subject:string,earned_marks:number,max_marks:number}>()
  for(const row of rows){
    const subject=subjectByUnit.get(String(row.unit_id))||'Other'
    if(!sums.has(subject))sums.set(subject,{subject,earned_marks:0,max_marks:0})
    const item=sums.get(subject)!
    item.earned_marks+=Number(row.earned_marks)||0
    item.max_marks+=Number(row.max_marks)||0
  }
  const order={Physics:1,Chemistry:2,Biology:3} as Record<string,number>
  return [...sums.values()].map(row=>({...row,percentage:row.max_marks>0?row.earned_marks/row.max_marks*100:0})).sort((a,b)=>(order[a.subject]||9)-(order[b.subject]||9)||a.subject.localeCompare(b.subject))
}

async function claimDelivery(admin:any,key:string,student:any){
  const existing=await admin.from('academy_communication_deliveries').select('*')
    .eq('event_key',key).eq('student_id',student.id).eq('channel','email').maybeSingle()
  if(existing.error)throw new Error(existing.error.message)
  if(existing.data){
    if(existing.data.status!=='failed')return {claimed:false,row:existing.data}
    const now=new Date().toISOString()
    const retry=await admin.from('academy_communication_deliveries').update({
      status:'pending',attempt_count:Math.max(0,Number(existing.data.attempt_count)||0)+1,
      recipient_masked:maskEmail(student.email),failure_reason:null,provider_message_id:null,attempted_at:now,sent_at:null,updated_at:now
    }).eq('id',existing.data.id).eq('status','failed').select('*').maybeSingle()
    if(retry.error)throw new Error(retry.error.message)
    return {claimed:Boolean(retry.data),row:retry.data||existing.data}
  }
  const now=new Date().toISOString()
  const insert=await admin.from('academy_communication_deliveries').insert({
    event_type:'result_published',event_key:key,student_id:student.id,channel:'email',recipient_masked:maskEmail(student.email),provider:'resend',status:'pending',attempt_count:1,attempted_at:now,updated_at:now
  }).select('*').single()
  if(insert.error)throw new Error(insert.error.message)
  return {claimed:true,row:insert.data}
}

async function finishDelivery(admin:any,id:string,status:string,providerMessageId:string|null=null,failureReason:string|null=null){
  const now=new Date().toISOString()
  const {error}=await admin.from('academy_communication_deliveries').update({status,provider_message_id:providerMessageId,failure_reason:failureReason,sent_at:status==='sent'?now:null,updated_at:now}).eq('id',id)
  if(error)throw new Error(error.message)
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const url=Deno.env.get('SUPABASE_URL')||''
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
    const resend=Deno.env.get('RESEND_API_KEY')||''
    if(!url||!sec||!resend)throw new Error('Result email provider or Supabase service configuration is missing')
    const admin=createClient(url,sec,{auth:{persistSession:false}})

    const provided=req.headers.get('x-sga-cron-key')||''
    const {data:authorised,error:authError}=await admin.rpc('verify_academy_morning_cron_key',{p_key:provided})
    if(authError)throw new Error(authError.message)
    if(!authorised)return json({error:'Unauthorized cron request'},401)

    const body=await req.json().catch(()=>({}))
    const examCode=text(body?.examCode)
    if(!examCode)throw new Error('Exam code is required')

    const {data:access,error:accessError}=await admin.from('exam_access').select('exam_id,exam_code').eq('exam_code',examCode).maybeSingle()
    if(accessError)throw new Error(accessError.message)
    if(!access)throw new Error('Exam code not found')
    const {data:exam,error:examError}=await admin.from('exams')
      .select('id,title,exam_date,total_marks,audience_mode,is_published,result_published').eq('id',access.exam_id).maybeSingle()
    if(examError)throw new Error(examError.message)
    if(!exam||!exam.is_published)throw new Error('Published exam not found')
    if(!exam.result_published)throw new Error('Exam results are not published')

    const {data:settings,error:settingsError}=await admin.from('academy_communication_settings').select('email_enabled,result_performance_enabled').eq('id',1).single()
    if(settingsError)throw new Error(settingsError.message)
    if(!settings?.email_enabled)return json({ok:true,status:'disabled',reason:'Email is disabled'})
    if(!settings?.result_performance_enabled)return json({ok:true,status:'disabled',reason:'Result & Performance email is disabled'})

    const students=await audience(admin,exam)
    const key=deliveryEventKey(exam.id)
    const results=[]
    for(const student of students){
      if(!text(student.email)){
        const existing=await admin.from('academy_communication_deliveries').select('id,status').eq('event_key',key).eq('student_id',student.id).eq('channel','email').maybeSingle()
        if(existing.error)throw new Error(existing.error.message)
        if(!existing.data){
          const now=new Date().toISOString()
          const skipped=await admin.from('academy_communication_deliveries').insert({event_type:'result_published',event_key:key,student_id:student.id,channel:'email',recipient_masked:'',provider:'resend',status:'skipped',attempt_count:0,failure_reason:'Student recipient is missing',updated_at:now}).select('id').single()
          if(skipped.error)throw new Error(skipped.error.message)
        }
        results.push({studentId:student.id,studentName:student.full_name,status:'missing_email'})
        continue
      }

      const attempt=await latestAttempt(admin,exam.id,student.id)
      let result:any=null,subjectRows:any[]=[]
      if(attempt){
        result=await publishedResult(admin,attempt.id)
        if(!result){
          results.push({studentId:student.id,studentName:student.full_name,status:'result_not_published'})
          continue
        }
        subjectRows=await subjectPerformance(admin,attempt.id)
      }

      const claim=await claimDelivery(admin,key,student)
      if(!claim.claimed){
        results.push({studentId:student.id,studentName:student.full_name,status:claim.row?.status||'duplicate',duplicate:true})
        continue
      }
      const message=buildResultDayMessage({student,exam,result,subjectPerformance:subjectRows,siteUrl:Deno.env.get('SGA_SITE_URL')||'https://sathyagrahiacademy.com'})
      try{
        const sent=await sendResendEmail({apiKey:resend,idempotencyKey:`${key}:${student.id}:email`,message:{...message,to:student.email,replyTo:message.from}})
        await finishDelivery(admin,claim.row.id,'sent',sent.id,null)
        results.push({studentId:student.id,studentName:student.full_name,status:'sent',attendance:attempt?'attended':'not_attended'})
      }catch(error){
        const reason=text((error as Error)?.message)||'Provider delivery failed'
        await finishDelivery(admin,claim.row.id,'failed',null,reason)
        results.push({studentId:student.id,studentName:student.full_name,status:'failed',error:reason})
      }
    }

    return json({ok:true,status:'processed',examId:exam.id,examCode,students:results.length,results})
  }catch(error){
    console.error('academy-result-cron error',text((error as Error)?.message))
    return json({error:text((error as Error)?.message)||'Result mail dispatch failed'},400)
  }
})
