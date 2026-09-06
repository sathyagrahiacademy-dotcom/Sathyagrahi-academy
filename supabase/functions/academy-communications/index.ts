import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { ADMIN_ACTIONS, INTERNAL_ACTIONS, isInternalAuthorised, providerReadiness } from './auth-policy.mjs'
import { eventKey, indiaDateKey, maskRecipient, normalisePhone, SENDERS } from './communication-policy.mjs'
import { buildMorningMessage, buildExamMessage, buildResultMessage } from './message-builders.mjs'
import { sendResendEmail, sendMetaTemplate } from './provider-adapters.mjs'
import { loadStudentIntelligence } from '../exam-performance/student-intelligence-loader.mjs'
import { indiaClock, withinMorningWindow } from './morning-policy.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
const text=(value:unknown)=>String(value??'').trim()
const bool=(value:unknown)=>Boolean(value)

function readEnv(){
  return {
    RESEND_API_KEY:Deno.env.get('RESEND_API_KEY')||'',
    META_WHATSAPP_ACCESS_TOKEN:Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')||'',
    META_WHATSAPP_PHONE_NUMBER_ID:Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')||'',
    META_GRAPH_API_VERSION:Deno.env.get('META_GRAPH_API_VERSION')||'',
    WHATSAPP_TEMPLATE_MORNING_PLAN:Deno.env.get('WHATSAPP_TEMPLATE_MORNING_PLAN')||'',
    WHATSAPP_TEMPLATE_EXAM_PUBLISHED:Deno.env.get('WHATSAPP_TEMPLATE_EXAM_PUBLISHED')||'',
    WHATSAPP_TEMPLATE_RESULT_PUBLISHED:Deno.env.get('WHATSAPP_TEMPLATE_RESULT_PUBLISHED')||'',
    WHATSAPP_TEMPLATE_LANGUAGE:Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE')||'en',
    ACADEMY_COMMUNICATIONS_INTERNAL_KEY:Deno.env.get('ACADEMY_COMMUNICATIONS_INTERNAL_KEY')||'',
    SGA_SITE_URL:Deno.env.get('SGA_SITE_URL')||'https://sathyagrahiacademy.com'
  }
}

function publicSettings(row:any){
  return {
    emailEnabled:Boolean(row?.email_enabled),
    whatsappEnabled:Boolean(row?.whatsapp_enabled),
    morningPlanEnabled:Boolean(row?.morning_plan_enabled),
    examPublishedEnabled:Boolean(row?.exam_published_enabled),
    resultPerformanceEnabled:Boolean(row?.result_performance_enabled),
    morningSendTime:text(row?.morning_send_time).slice(0,5)||'07:00',
    timezone:text(row?.timezone)||'Asia/Kolkata',
    updatedAt:row?.updated_at||null
  }
}

async function getSettings(admin:any){
  const {data,error}=await admin.from('academy_communication_settings').select('*').eq('id',1).maybeSingle()
  if(error)throw new Error(error.message)
  if(data)return data
  const {data:created,error:createError}=await admin.from('academy_communication_settings').insert({id:1}).select('*').single()
  if(createError)throw new Error(createError.message)
  return created
}

async function loadStudent(admin:any,studentId:string){
  const {data,error}=await admin.from('profiles')
    .select('id,full_name,student_id,email,phone,role,is_active')
    .eq('id',studentId).eq('role','student').eq('is_active',true).maybeSingle()
  if(error)throw new Error(error.message)
  return data||null
}

function eventToggle(settings:any,eventType:string){
  if(eventType==='morning_plan')return Boolean(settings?.morning_plan_enabled)
  if(eventType==='exam_published')return Boolean(settings?.exam_published_enabled)
  if(eventType==='result_published')return Boolean(settings?.result_performance_enabled)
  return true
}
function channelToggle(settings:any,channel:string){
  return channel==='email'?Boolean(settings?.email_enabled):Boolean(settings?.whatsapp_enabled)
}
function providerName(channel:string){return channel==='email'?'resend':'meta_whatsapp'}
function templateName(eventType:string,env:any){
  if(eventType==='morning_plan')return text(env.WHATSAPP_TEMPLATE_MORNING_PLAN)
  if(eventType==='exam_published'||eventType==='test_whatsapp')return text(env.WHATSAPP_TEMPLATE_EXAM_PUBLISHED)
  if(eventType==='result_published')return text(env.WHATSAPP_TEMPLATE_RESULT_PUBLISHED)
  return ''
}

async function existingDelivery(admin:any,key:string,studentId:string,channel:string){
  const {data,error}=await admin.from('academy_communication_deliveries')
    .select('*').eq('event_key',key).eq('student_id',studentId).eq('channel',channel).maybeSingle()
  if(error)throw new Error(error.message)
  return data||null
}

async function createDelivery(admin:any,{eventType,key,studentId,channel,recipient,status='pending',reason=null,attemptCount=1}:{eventType:string,key:string,studentId:string,channel:string,recipient:string,status?:string,reason?:string|null,attemptCount?:number}){
  const now=new Date().toISOString()
  const row={
    event_type:eventType,event_key:key,student_id:studentId,channel,
    recipient_masked:maskRecipient(recipient,channel),provider:providerName(channel),status,
    attempt_count:attemptCount,failure_reason:reason,attempted_at:attemptCount?now:null,updated_at:now
  }
  const {data,error}=await admin.from('academy_communication_deliveries').insert(row).select('*').single()
  if(!error)return {row:data,existing:false}
  if(String(error.code)==='23505')return {row:await existingDelivery(admin,key,studentId,channel),existing:true}
  throw new Error(error.message)
}

async function prepareRetry(admin:any,row:any,recipient:string){
  if(row?.status!=='failed')throw new Error('Only failed deliveries can be retried')
  const now=new Date().toISOString()
  const attemptCount=Math.max(0,Number(row.attempt_count)||0)+1
  const {data,error}=await admin.from('academy_communication_deliveries').update({
    status:'pending',attempt_count:attemptCount,recipient_masked:maskRecipient(recipient,row.channel),
    failure_reason:null,provider_message_id:null,attempted_at:now,sent_at:null,updated_at:now
  }).eq('id',row.id).eq('status','failed').select('*').maybeSingle()
  if(error)throw new Error(error.message)
  if(!data)throw new Error('Delivery is no longer retryable')
  return data
}

async function finishDelivery(admin:any,id:string,status:string,{providerMessageId=null,failureReason=null}:{providerMessageId?:string|null,failureReason?:string|null}={}){
  const now=new Date().toISOString()
  const {error}=await admin.from('academy_communication_deliveries').update({
    status,provider_message_id:providerMessageId,failure_reason:failureReason,
    sent_at:status==='sent'?now:null,updated_at:now
  }).eq('id',id)
  if(error)throw new Error(error.message)
}

async function deliverChannel({admin,settings,env,eventType,key,student,message,channel,retryRow=null,respectSettings=true}:{admin:any,settings:any,env:any,eventType:string,key:string,student:any,message:any,channel:string,retryRow?:any,respectSettings?:boolean}){
  if(respectSettings&&(!eventToggle(settings,eventType)||!channelToggle(settings,channel)))return {channel,status:'disabled'}
  const recipient=channel==='email'?text(student?.email):normalisePhone(student?.phone)
  if(!recipient){
    if(retryRow)throw new Error('Student recipient is missing')
    const claimed=await createDelivery(admin,{eventType,key,studentId:student.id,channel,recipient:'',status:'skipped',reason:'Student recipient is missing',attemptCount:0})
    return {channel,status:claimed.row?.status||'skipped'}
  }

  let delivery:any
  if(retryRow){
    delivery=await prepareRetry(admin,retryRow,recipient)
  }else{
    const claimed=await createDelivery(admin,{eventType,key,studentId:student.id,channel,recipient})
    if(claimed.existing)return {channel,status:claimed.row?.status||'duplicate',duplicate:true}
    delivery=claimed.row
  }

  try{
    if(channel==='email'){
      if(!providerReadiness(env).email.configured)throw new Error('Email provider needs setup')
      const sent=await sendResendEmail({
        apiKey:env.RESEND_API_KEY,
        idempotencyKey:`${key}:${student.id}:email`,
        message:{...message,to:recipient,replyTo:message.from}
      })
      await finishDelivery(admin,delivery.id,'sent',{providerMessageId:sent.id})
      return {channel,status:'sent'}
    }

    if(!providerReadiness(env).whatsapp.configured)throw new Error('WhatsApp provider needs setup')
    const sent=await sendMetaTemplate({
      accessToken:env.META_WHATSAPP_ACCESS_TOKEN,
      apiVersion:env.META_GRAPH_API_VERSION,
      phoneNumberId:env.META_WHATSAPP_PHONE_NUMBER_ID,
      to:recipient,
      templateName:templateName(eventType,env),
      language:env.WHATSAPP_TEMPLATE_LANGUAGE,
      values:message.whatsappValues||[]
    })
    await finishDelivery(admin,delivery.id,'sent',{providerMessageId:sent.id})
    return {channel,status:'sent'}
  }catch(error){
    const reason=text((error as Error)?.message)||'Provider delivery failed'
    await finishDelivery(admin,delivery.id,'failed',{failureReason:reason})
    return {channel,status:'failed',error:reason}
  }
}

async function deliverStudent({admin,settings,env,eventType,key,student,message,retryRow=null,respectSettings=true}:{admin:any,settings:any,env:any,eventType:string,key:string,student:any,message:any,retryRow?:any,respectSettings?:boolean}){
  if(retryRow){
    return [await deliverChannel({admin,settings,env,eventType,key,student,message,channel:retryRow.channel,retryRow,respectSettings})]
  }
  const results=[]
  for(const channel of ['email','whatsapp'])results.push(await deliverChannel({admin,settings,env,eventType,key,student,message,channel,respectSettings}))
  return results
}

async function examAudience(admin:any,exam:any){
  const {data:students,error}=await admin.from('profiles')
    .select('id,full_name,student_id,email,phone').eq('role','student').eq('is_active',true).order('full_name')
  if(error)throw new Error(error.message)
  if(exam.audience_mode!=='selected')return students||[]
  const {data:assignments,error:assignmentError}=await admin.from('exam_student_assignments')
    .select('student_id').eq('exam_id',exam.id).eq('is_assigned',true)
  if(assignmentError)throw new Error(assignmentError.message)
  const allowed=new Set((assignments||[]).map((row:any)=>text(row.student_id)))
  return (students||[]).filter((row:any)=>allowed.has(text(row.id)))
}

function examCode(exam:any){
  const access=Array.isArray(exam?.exam_access)?exam.exam_access[0]:exam?.exam_access
  return text(access?.exam_code)
}

async function deliverExamEvent(admin:any,settings:any,env:any,examId:string,retryRow:any=null){
  const {data:exam,error}=await admin.from('exams')
    .select('id,title,subject,syllabus,exam_type,exam_date,duration_minutes,total_marks,audience_mode,is_published,exam_access(exam_code)')
    .eq('id',examId).maybeSingle()
  if(error)throw new Error(error.message)
  if(!exam||!exam.is_published)throw new Error('Published exam not found')
  const key=eventKey('exam_published',{examId:exam.id})
  if(retryRow){
    const student=await loadStudent(admin,text(retryRow.student_id))
    if(!student)throw new Error('Active student not found')
    const message=buildExamMessage({student,exam,examCode:examCode(exam),scopeSummary:exam.syllabus||exam.subject,siteUrl:env.SGA_SITE_URL})
    return deliverStudent({admin,settings,env,eventType:'exam_published',key,student,message,retryRow})
  }
  const students=await examAudience(admin,exam)
  const output=[]
  for(const student of students){
    const message=buildExamMessage({student,exam,examCode:examCode(exam),scopeSummary:exam.syllabus||exam.subject,siteUrl:env.SGA_SITE_URL})
    output.push({studentId:student.id,deliveries:await deliverStudent({admin,settings,env,eventType:'exam_published',key,student,message})})
  }
  return output
}

async function loadResultContext(admin:any,attemptId:string){
  const {data:attempt,error:attemptError}=await admin.from('exam_attempts')
    .select('id,exam_id,student_id,status,submitted_at').eq('id',attemptId).maybeSingle()
  if(attemptError)throw new Error(attemptError.message)
  if(!attempt)throw new Error('Exam attempt not found')
  const {data:result,error:resultError}=await admin.from('exam_results')
    .select('attempt_id,total_score,correct_count,wrong_count,unattempted_count,percentage,graded_at,is_published')
    .eq('attempt_id',attemptId).maybeSingle()
  if(resultError)throw new Error(resultError.message)
  if(!result||!result.is_published)throw new Error('Published result not found')
  const {data:exam,error:examError}=await admin.from('exams')
    .select('id,title,subject,total_marks').eq('id',attempt.exam_id).maybeSingle()
  if(examError)throw new Error(examError.message)
  if(!exam)throw new Error('Exam not found')
  const student=await loadStudent(admin,text(attempt.student_id))
  if(!student)throw new Error('Active student not found')
  const date=indiaDateKey(attempt.submitted_at||result.graded_at||new Date())
  const {data:studySessions,error:studyError}=await admin.from('student_study_sessions')
    .select('subject,chapter,topic,activity_type,minutes,questions_attempted,marked_completed,session_date')
    .eq('student_id',student.id).eq('session_date',date).order('created_at',{ascending:true})
  if(studyError)throw new Error(studyError.message)
  let intelligence:any={mentor:{}}
  try{intelligence=await loadStudentIntelligence(admin,student.id)}catch(error){console.error('communications intelligence load failed',text((error as Error)?.message))}
  return {attempt,result,exam,student,date,studySessions:studySessions||[],intelligence}
}

async function deliverResultEvent(admin:any,settings:any,env:any,attemptId:string,retryRow:any=null){
  const ctx=await loadResultContext(admin,attemptId)
  const key=eventKey('result_published',{attemptId:ctx.attempt.id})
  const message=buildResultMessage({student:ctx.student,date:ctx.date,exam:ctx.exam,result:ctx.result,studySessions:ctx.studySessions,intelligence:ctx.intelligence,siteUrl:env.SGA_SITE_URL})
  return deliverStudent({admin,settings,env,eventType:'result_published',key,student:ctx.student,message,retryRow})
}

async function loadMorningTasks(admin:any,studentId:string,date:string){
  const {data,error}=await admin.from('preparation_tasks')
    .select('id,student_id,subject,chapter,topic,task_type,target_date,target_minutes,priority,status,created_at')
    .eq('student_id',studentId).eq('target_date',date).eq('status','pending').order('created_at',{ascending:true})
  if(error)throw new Error(error.message)
  return data||[]
}

async function deliverMorningStudent(admin:any,settings:any,env:any,student:any,date:string,retryRow:any=null){
  const tasks=await loadMorningTasks(admin,student.id,date)
  if(!tasks.length){
    if(retryRow)throw new Error('No pending morning plan tasks found for this student and date')
    return {studentId:student.id,status:'no_tasks',deliveries:[]}
  }
  const key=eventKey('morning_plan',{studentId:student.id,date})
  const message=buildMorningMessage({student,date,tasks,siteUrl:env.SGA_SITE_URL})
  return {studentId:student.id,status:'processed',deliveries:await deliverStudent({admin,settings,env,eventType:'morning_plan',key,student,message,retryRow})}
}

async function dispatchMorning(admin:any,settings:any,env:any,nowValue:any=new Date()){
  if(!settings?.morning_plan_enabled)return {status:'disabled',reason:'Morning Plan is disabled'}
  const clock=indiaClock(nowValue)
  if(!clock.date||!clock.time)throw new Error('Could not resolve India date and time')
  const configured=text(settings?.morning_send_time).slice(0,5)||'07:00'
  if(!withinMorningWindow(clock.time,configured,5))return {status:'outside_window',date:clock.date,time:clock.time,configuredTime:configured}

  const {data:tasks,error:taskError}=await admin.from('preparation_tasks')
    .select('student_id,target_date,status').eq('target_date',clock.date).eq('status','pending')
  if(taskError)throw new Error(taskError.message)
  const studentIds=[...new Set((tasks||[]).map((row:any)=>text(row.student_id)).filter(Boolean))]
  if(!studentIds.length)return {status:'no_tasks',date:clock.date,time:clock.time,students:0,results:[]}

  const {data:students,error:studentError}=await admin.from('profiles')
    .select('id,full_name,student_id,email,phone').eq('role','student').eq('is_active',true).in('id',studentIds).order('full_name')
  if(studentError)throw new Error(studentError.message)
  const results=[]
  for(const student of students||[])results.push(await deliverMorningStudent(admin,settings,env,student,clock.date))
  return {status:'processed',date:clock.date,time:clock.time,students:results.length,results}
}

async function safeStatus(admin:any,settings:any,env:any){
  const [deliveriesRes,studentsRes]=await Promise.all([
    admin.from('academy_communication_deliveries').select('id,event_type,event_key,student_id,channel,recipient_masked,provider,status,attempt_count,failure_reason,attempted_at,sent_at,created_at,updated_at').order('created_at',{ascending:false}).limit(50),
    admin.from('profiles').select('id,full_name,student_id,email,phone').eq('role','student').eq('is_active',true).order('full_name')
  ])
  if(deliveriesRes.error)throw new Error(deliveriesRes.error.message)
  if(studentsRes.error)throw new Error(studentsRes.error.message)
  const students=studentsRes.data||[]
  const byId=new Map(students.map((row:any)=>[text(row.id),row]))
  return {
    ok:true,
    settings:publicSettings(settings),
    providers:providerReadiness(env),
    senders:SENDERS,
    students:students.map((row:any)=>({id:row.id,fullName:row.full_name||'Student',studentCode:row.student_id||'',hasEmail:Boolean(text(row.email)),hasPhone:Boolean(normalisePhone(row.phone))})),
    deliveries:(deliveriesRes.data||[]).map((row:any)=>({
      ...row,student:{fullName:byId.get(text(row.student_id))?.full_name||'Student',studentCode:byId.get(text(row.student_id))?.student_id||''}
    }))
  }
}

async function saveSettings(admin:any,userId:string,body:any){
  const input=body?.settings||body||{}
  const time=text(input.morningSendTime||input.morning_send_time)
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Morning send time must be HH:MM')
  const payload={
    email_enabled:bool(input.emailEnabled),
    whatsapp_enabled:bool(input.whatsappEnabled),
    morning_plan_enabled:bool(input.morningPlanEnabled),
    exam_published_enabled:bool(input.examPublishedEnabled),
    result_performance_enabled:bool(input.resultPerformanceEnabled),
    morning_send_time:`${time}:00`,timezone:'Asia/Kolkata',updated_by:userId,updated_at:new Date().toISOString()
  }
  const {data,error}=await admin.from('academy_communication_settings').update(payload).eq('id',1).select('*').single()
  if(error)throw new Error(error.message)
  return publicSettings(data)
}

async function testDelivery(admin:any,settings:any,env:any,studentId:string,channel:string){
  const student=await loadStudent(admin,studentId)
  if(!student)throw new Error('Active student not found')
  const now=new Date(),date=indiaDateKey(now)
  const unique=`${channel==='email'?'test_email':'test_whatsapp'}:${student.id}:${crypto.randomUUID()}`
  if(channel==='email'){
    const message=buildMorningMessage({student,date,tasks:[{subject:'Academy',chapter:'Communications',topic:'Test email',task_type:'System Test'}],siteUrl:env.SGA_SITE_URL})
    return [await deliverChannel({admin,settings,env,eventType:'test_email',key:unique,student,message:{...message,from:SENDERS.morning_plan,subject:'Sathyagrahi Academy — Test Email'},channel:'email',respectSettings:false})]
  }
  const sampleExam={title:'Academy Communication Test',exam_date:date,duration_minutes:1,total_marks:0,subject:'System'}
  const message=buildExamMessage({student,exam:sampleExam,examCode:'TEST',scopeSummary:'WhatsApp connectivity test',siteUrl:env.SGA_SITE_URL})
  // Reuse the approved Exam Published utility-template shape for connectivity testing.
  const testEnv={...env,WHATSAPP_TEMPLATE_EXAM_PUBLISHED:env.WHATSAPP_TEMPLATE_EXAM_PUBLISHED}
  return [await deliverChannel({admin,settings,env:testEnv,eventType:'test_whatsapp',key:unique,student,message,channel:'whatsapp',respectSettings:false})]
}

async function retryDelivery(admin:any,settings:any,env:any,deliveryId:string){
  const {data:row,error}=await admin.from('academy_communication_deliveries').select('*').eq('id',deliveryId).maybeSingle()
  if(error)throw new Error(error.message)
  if(!row)throw new Error('Delivery not found')
  if(row.status!=='failed')throw new Error('Only failed deliveries can be retried')
  if(row.event_type==='exam_published'){
    const examId=text(row.event_key).replace(/^exam_published:/,'')
    return deliverExamEvent(admin,settings,env,examId,row)
  }
  if(row.event_type==='result_published'){
    const attemptId=text(row.event_key).replace(/^result_published:/,'')
    return deliverResultEvent(admin,settings,env,attemptId,row)
  }
  if(row.event_type==='morning_plan'){
  const match=/^morning_plan:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(text(row.event_key))
  if(!match)throw new Error('Morning delivery key is invalid')
  const student=await loadStudent(admin,text(row.student_id))
  if(!student)throw new Error('Active student not found')
  if(text(student.id)!==match[1])throw new Error('Morning delivery student does not match event key')
  return deliverMorningStudent(admin,settings,env,student,match[2],row)
}
  throw new Error('This delivery type cannot be retried from the log')
}

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const body=await req.json().catch(()=>({}))
    const action=text(body?.action)
    if(!ADMIN_ACTIONS.has(action)&&!INTERNAL_ACTIONS.has(action))return json({error:'Unsupported action'},400)

    const env=readEnv()
    const url=Deno.env.get('SUPABASE_URL')!
    const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(url,sec,{auth:{persistSession:false}})
    let adminUserId=''

    if(INTERNAL_ACTIONS.has(action)){
      const provided=req.headers.get('x-sga-internal-key')||''
      if(!isInternalAuthorised({provided,expected:env.ACADEMY_COMMUNICATIONS_INTERNAL_KEY}))return json({error:'Unauthorized internal request'},401)
    }else{
      const authHeader=req.headers.get('Authorization')||''
      if(!authHeader.startsWith('Bearer '))return json({error:'Unauthorized'},401)
      const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}})
      const {data:{user}}=await userClient.auth.getUser()
      if(!user)return json({error:'Unauthorized'},401)
      const {data:profile}=await userClient.from('profiles').select('role,is_active').eq('id',user.id).single()
      if(!profile||profile.role!=='admin'||!profile.is_active)return json({error:'Admin access required'},403)
      adminUserId=user.id
    }

    const settings=await getSettings(admin)

    if(action==='status')return json(await safeStatus(admin,settings,env))
    if(action==='save_settings')return json({ok:true,settings:await saveSettings(admin,adminUserId,body)})
    if(action==='test_email')return json({ok:true,deliveries:await testDelivery(admin,settings,env,text(body.studentId),'email')})
    if(action==='test_whatsapp')return json({ok:true,deliveries:await testDelivery(admin,settings,env,text(body.studentId),'whatsapp')})
    if(action==='retry_delivery')return json({ok:true,deliveries:await retryDelivery(admin,settings,env,text(body.deliveryId))})
    if(action==='exam_published')return json({ok:true,deliveries:await deliverExamEvent(admin,settings,env,text(body.examId))})
    if(action==='result_published')return json({ok:true,deliveries:await deliverResultEvent(admin,settings,env,text(body.attemptId))})
    if(action==='morning_dispatch')return json({ok:true,dispatch:await dispatchMorning(admin,settings,env,body.now||new Date())})
    return json({error:'Unsupported action'},400)
  }catch(error){
    console.error('academy-communications error',text((error as Error)?.message))
    return json({error:text((error as Error)?.message)||'Communication request failed'},400)
  }
})