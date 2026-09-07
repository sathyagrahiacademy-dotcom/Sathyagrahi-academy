import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildMorningMessage } from './morning-message.mjs'
import { sendResendEmail } from './resend.mjs'
import { maskRecipient, SENDERS } from './policy.mjs'
import { indiaClock, withinMorningWindow } from './time.mjs'

const text=(value:unknown)=>String(value??'').trim()
const roman=(stage:string)=>({R1:'I',R2:'II',R3:'III',R4:'IV'}[stage]||stage)

function json(body:Record<string,unknown>,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
}

function tasksFromPlan(rows:any[]){
  const order={Biology:1,Chemistry:2,Physics:3} as Record<string,number>
  return [...rows].sort((a,b)=>(order[a.subject]||9)-(order[b.subject]||9)||String(a.event_type).localeCompare(String(b.event_type))).map(row=>{
    if(row.event_type==='study'){
      return {
        subject:row.subject,
        chapter:row.chapter,
        topic:`Day ${Number(row.day_no)||1} of ${Number(row.total_days)||1}`,
        task_type:'Study',
        target_minutes:Number(row.planned_minutes)||240,
        priority:''
      }
    }
    return {
      subject:row.subject,
      chapter:row.chapter,
      topic:`Revision - ${roman(text(row.revision_stage))}`,
      task_type:'Revision',
      target_minutes:0,
      priority:''
    }
  })
}

async function claimDelivery(admin:any,student:any,date:string){
  const key=`morning_plan:${student.id}:${date}`
  const now=new Date().toISOString()
  const {data,error}=await admin.from('academy_communication_deliveries').insert({
    event_type:'morning_plan',event_key:key,student_id:student.id,channel:'email',
    recipient_masked:maskRecipient(student.email,'email'),provider:'resend',status:'pending',
    attempt_count:1,attempted_at:now,updated_at:now
  }).select('id,event_key').single()
  if(!error)return {claimed:true,row:data,key}
  if(String(error.code)==='23505')return {claimed:false,row:null,key}
  throw new Error(error.message)
}

async function finishDelivery(admin:any,id:string,status:string,providerMessageId:string|null=null,failureReason:string|null=null){
  const now=new Date().toISOString()
  const {error}=await admin.from('academy_communication_deliveries').update({
    status,provider_message_id:providerMessageId,failure_reason:failureReason,
    sent_at:status==='sent'?now:null,updated_at:now
  }).eq('id',id)
  if(error)throw new Error(error.message)
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const url=Deno.env.get('SUPABASE_URL')||''
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
    const resend=Deno.env.get('RESEND_API_KEY')||''
    if(!url||!sec||!resend)throw new Error('Morning email provider or Supabase service configuration is missing')
    const admin=createClient(url,sec,{auth:{persistSession:false}})

    const provided=req.headers.get('x-sga-cron-key')||''
    const {data:authorised,error:authError}=await admin.rpc('verify_academy_morning_cron_key',{p_key:provided})
    if(authError)throw new Error(authError.message)
    if(!authorised)return json({error:'Unauthorized cron request'},401)

    const body=await req.json().catch(()=>({}))
    const nowValue=body?.now||new Date()
    const clock=indiaClock(nowValue)
    const {data:settings,error:settingsError}=await admin.from('academy_communication_settings').select('*').eq('id',1).single()
    if(settingsError)throw new Error(settingsError.message)
    if(!settings?.email_enabled)return json({ok:true,status:'disabled',reason:'Email is disabled'})
    if(!settings?.morning_plan_enabled)return json({ok:true,status:'disabled',reason:'Morning Plan is disabled'})
    const configured=text(settings?.morning_send_time).slice(0,5)||'07:00'
    if(!withinMorningWindow(clock.time,configured,5))return json({ok:true,status:'outside_window',date:clock.date,time:clock.time,configuredTime:configured})

    const {data:plan,error:planError}=await admin.from('academy_daily_study_plan').select('*').eq('plan_date',clock.date)
    if(planError)throw new Error(planError.message)
    const rows=plan||[]
    if(!rows.length)return json({ok:true,status:'no_plan',date:clock.date,students:0})
    const tasks=tasksFromPlan(rows)

    const {data:students,error:studentError}=await admin.from('profiles')
      .select('id,full_name,student_id,email').eq('role','student').eq('is_active',true).order('full_name')
    if(studentError)throw new Error(studentError.message)

    const results=[]
    for(const student of students||[]){
      if(!text(student.email)){
        results.push({studentId:student.id,status:'missing_email'})
        continue
      }
      const claim=await claimDelivery(admin,student,clock.date)
      if(!claim.claimed){
        results.push({studentId:student.id,status:'duplicate'})
        continue
      }
      try{
        const message=buildMorningMessage({student,date:clock.date,tasks,siteUrl:Deno.env.get('SGA_SITE_URL')||'https://sathyagrahiacademy.com'})
        const sent=await sendResendEmail({
          apiKey:resend,
          idempotencyKey:`${claim.key}:${student.id}:email`,
          message:{...message,from:SENDERS.morning_plan,to:student.email,replyTo:SENDERS.morning_plan}
        })
        await finishDelivery(admin,claim.row.id,'sent',sent.id,null)
        results.push({studentId:student.id,status:'sent'})
      }catch(error){
        const reason=text((error as Error)?.message)||'Provider delivery failed'
        await finishDelivery(admin,claim.row.id,'failed',null,reason)
        results.push({studentId:student.id,status:'failed',error:reason})
      }
    }
    return json({ok:true,status:'processed',date:clock.date,time:clock.time,students:results.length,results})
  }catch(error){
    console.error('academy-morning-cron error',text((error as Error)?.message))
    return json({error:text((error as Error)?.message)||'Morning cron failed'},400)
  }
})
