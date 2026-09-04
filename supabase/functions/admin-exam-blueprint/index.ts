import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'

function json(body: Record<string, unknown>, status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
function str(v:unknown){return String(v??'').trim()}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const authHeader=req.headers.get('Authorization')||''
  if(!authHeader.startsWith('Bearer '))return json({error:'Unauthorized'},401)
  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!
    const sec=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}})
    const {data:{user}}=await userClient.auth.getUser()
    if(!user)return json({error:'Unauthorized'},401)
    const {data:profile}=await userClient.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()
    if(!profile||profile.role!=='admin'||!profile.is_active)return json({error:'Admin access required'},403)
    const admin=createClient(url,sec,{auth:{persistSession:false}})
    const body=await req.json(),examId=str(body.examId)
    if(!examId)return json({error:'Exam ID is required'},400)

    const [examRes,accessRes,scopeRes,qRes,keyRes,groupRes,mapRes,assignRes,attemptRes,unitsRes,chaptersRes,topicsRes]=await Promise.all([
      admin.from('exams').select('id,title,subject,syllabus,duration_minutes,total_marks,negative_marking,instructions,status,is_published,result_published,audience_mode,created_at,updated_at').eq('id',examId).maybeSingle(),
      admin.from('exam_access').select('exam_code').eq('exam_id',examId).maybeSingle(),
      admin.from('exam_scope_items').select('id,unit_id,chapter_id,subtopic_id,sort_order').eq('exam_id',examId).order('sort_order'),
      admin.from('exam_questions').select('id,question_no,marks,negative_marks,difficulty,question_type,source_label,source_year').eq('exam_id',examId).order('question_no'),
      admin.from('exam_answer_keys').select('question_id'),
      admin.from('exam_mapping_groups').select('id,subtopic_id,coverage,selector_text,sort_order').eq('exam_id',examId).order('sort_order'),
      admin.from('exam_question_syllabus_map').select('question_id,mapping_group_id,subtopic_id').eq('exam_id',examId),
      admin.from('exam_student_assignments').select('student_id',{count:'exact',head:true}).eq('exam_id',examId).eq('is_assigned',true),
      admin.from('exam_attempts').select('submitted_at').eq('exam_id',examId).eq('status','submitted').not('submitted_at','is',null).order('submitted_at').limit(1),
      admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title'),
      admin.from('neet_syllabus_topics').select('id,unit_id,topic_title'),
      admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,status')
    ])
    const firstError=[examRes,accessRes,scopeRes,qRes,keyRes,groupRes,mapRes,assignRes,attemptRes,unitsRes,chaptersRes,topicsRes].find((r:any)=>r.error)
    if(firstError?.error)return json({error:firstError.error.message},400)
    if(!examRes.data)return json({error:'Exam not found'},404)

    const units=new Map((unitsRes.data||[]).map((x:any)=>[String(x.id),x]))
    const chapters=new Map((chaptersRes.data||[]).map((x:any)=>[String(x.id),x]))
    const topics=new Map((topicsRes.data||[]).map((x:any)=>[String(x.id),x]))
    const locate=(subtopicId:any)=>{
      const topic=topics.get(String(subtopicId)),chapter=topic?chapters.get(String(topic.chapter_id)):null,unit=chapter?units.get(String(chapter.unit_id)):null
      return {subject:unit?.subject||'',unitId:unit?.id||null,unitNo:unit?.unit_no??null,unitTitle:unit?.unit_title||'',chapterId:chapter?.id||null,chapterTitle:chapter?.topic_title||'',topicId:topic?.id||null,topicTitle:topic?.subtopic_title||''}
    }
    const coverage=(scopeRes.data||[]).map((s:any)=>{
      const unit=units.get(String(s.unit_id)),chapter=chapters.get(String(s.chapter_id)),topic=s.subtopic_id?topics.get(String(s.subtopic_id)):null
      return {subject:unit?.subject||'',unitId:s.unit_id,unitNo:unit?.unit_no??null,unitTitle:unit?.unit_title||'',chapterId:s.chapter_id,chapterTitle:chapter?.topic_title||'',scopeType:s.subtopic_id?'topic':'chapter',topicId:s.subtopic_id,topicTitle:topic?.subtopic_title||''}
    })
    const mapByQuestion=new Map((mapRes.data||[]).map((m:any)=>[String(m.question_id),m]))
    const questions=(qRes.data||[]).map((q:any)=>{const m=mapByQuestion.get(String(q.id));return {...q,...(m?locate(m.subtopic_id):{subject:'',unitTitle:'',chapterTitle:'',topicTitle:''}),subtopicId:m?.subtopic_id||null}})
    const mappings=(groupRes.data||[]).map((g:any)=>({...g,...locate(g.subtopic_id)}))
    const questionIds=new Set(questions.map((q:any)=>String(q.id)))
    const keyed=new Set((keyRes.data||[]).map((k:any)=>String(k.question_id)).filter((id:string)=>questionIds.has(id)))
    const mapped=new Set((mapRes.data||[]).map((m:any)=>String(m.question_id)).filter((id:string)=>questionIds.has(id)))
    const questionMarksTotal=questions.reduce((sum:number,q:any)=>sum+Number(q.marks||0),0),totalMarks=Number(examRes.data.total_marks||0)
    const marksMatch=Math.abs(questionMarksTotal-totalMarks)<1e-9
    const validation={totalQuestions:questions.length,mappedQuestions:mapped.size,keyedQuestions:keyed.size,questionMarksTotal,totalMarks,marksMatch,publishReady:questions.length>0&&mapped.size===questions.length&&keyed.size===questions.length&&marksMatch}

    return json({ok:true,exam:{...examRes.data,exam_code:accessRes.data?.exam_code||''},coverage,questions,mappings,validation,audience:{mode:examRes.data.audience_mode||'all',assignedCount:Number(assignRes.count||0)},conduct:{firstSubmittedAt:attemptRes.data?.[0]?.submitted_at||null}})
  }catch(e){return json({error:e instanceof Error?e.message:'Could not build Exam Blueprint'},400)}
})
