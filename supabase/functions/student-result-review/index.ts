import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'

function json(body: unknown, status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)

  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const auth=req.headers.get('Authorization')||''
    if(!auth.startsWith('Bearer ')) return json({error:'Unauthorized'},401)

    const userClient=createClient(url,pub,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
    const {data:{user}}=await userClient.auth.getUser()
    if(!user) return json({error:'Unauthorized'},401)

    const {attemptId}=await req.json()
    if(!attemptId) return json({error:'Attempt is required'},400)

    const admin=createClient(url,sec,{auth:{persistSession:false}})
    const {data:attempt,error:aErr}=await admin.from('exam_attempts')
      .select('id,exam_id,student_id,status,submitted_at,exams(title,subject,syllabus,total_marks,duration_minutes),profiles(full_name,student_id)')
      .eq('id',attemptId).maybeSingle()
    if(aErr||!attempt) return json({error:'Attempt not found'},404)
    if(attempt.student_id!==user.id) return json({error:'Access denied'},403)

    const {data:result,error:rErr}=await admin.from('exam_results')
      .select('total_score,correct_count,wrong_count,unattempted_count,percentage,rank,graded_at,is_published')
      .eq('attempt_id',attemptId).maybeSingle()
    if(rErr||!result) return json({error:'Result not available'},404)
    if(!result.is_published) return json({error:'Result has not been published yet'},403)

    // Answer keys are intentionally loaded only after ownership and result-visibility checks above.
    const {data:qs,error:qErr}=await admin.from('exam_questions')
      .select('id,question_no,question_text,option_a,option_b,option_c,option_d,marks,negative_marks,difficulty,question_type,bank_question_id')
      .eq('exam_id',attempt.exam_id).order('question_no')
    if(qErr) return json({error:qErr.message},400)
    const qids=(qs||[]).map((q:any)=>q.id)

    const [responseRes,keyRes,mapRes,activityRes]=await Promise.all([
      admin.from('exam_responses').select('question_id,selected_option,marked_for_review').eq('attempt_id',attemptId),
      qids.length
        ? admin.from('exam_answer_keys').select('question_id,correct_option,explanation').in('question_id',qids)
        : Promise.resolve({data:[],error:null}),
      qids.length
        ? admin.from('exam_question_syllabus_map').select('question_id,subtopic_id').eq('exam_id',attempt.exam_id).in('question_id',qids)
        : Promise.resolve({data:[],error:null}),
      qids.length
        ? admin.from('exam_question_activity').select('question_id,active_seconds,visit_count,answer_change_count').eq('attempt_id',attemptId).in('question_id',qids)
        : Promise.resolve({data:[],error:null})
    ])

    const dataError=responseRes.error||keyRes.error||mapRes.error||activityRes.error
    if(dataError) return json({error:dataError.message||'Could not load answer review'},400)

    const subtopicIds=[...new Set((mapRes.data||[]).map((m:any)=>String(m.subtopic_id)).filter(Boolean))]
    const subtopicRes=subtopicIds.length
      ? await admin.from('neet_syllabus_subtopics').select('id,subtopic_title').in('id',subtopicIds)
      : {data:[],error:null}
    if(subtopicRes.error) return json({error:subtopicRes.error.message},400)

    const responseMap=new Map((responseRes.data||[]).map((r:any)=>[String(r.question_id),r]))
    const keyMap=new Map((keyRes.data||[]).map((k:any)=>[String(k.question_id),k]))
    const activityMap=new Map((activityRes.data||[]).map((a:any)=>[String(a.question_id),a]))
    const subtopicMap=new Map((subtopicRes.data||[]).map((s:any)=>[String(s.id),s.subtopic_title]))
    const questionTopicMap=new Map<string,string>()
    for(const mapping of mapRes.data||[]){
      const qid=String((mapping as any).question_id)
      if(questionTopicMap.has(qid)) continue
      const title=subtopicMap.get(String((mapping as any).subtopic_id))
      if(title) questionTopicMap.set(qid,String(title))
    }

    const questions=(qs||[]).map((q:any)=>{
      const id=String(q.id)
      const response=responseMap.get(id)
      const key=keyMap.get(id)
      const activity=activityMap.get(id)
      const selected=response?.selected_option||null
      const correct=key?.correct_option||null
      return {
        ...q,
        selected_option:selected,
        correct_option:correct,
        explanation:key?.explanation||'',
        is_correct:Boolean(selected&&correct&&selected===correct),
        is_unattempted:!selected,
        topic:questionTopicMap.get(id)||'Unmapped',
        active_seconds:Number(activity?.active_seconds||0),
        visit_count:Number(activity?.visit_count||0),
        answer_change_count:Number(activity?.answer_change_count||0)
      }
    })

    return json({ok:true,attempt,result,questions})
  }catch(e){
    return json({error:e instanceof Error?e.message:'Unable to load result review'},400)
  }
})
