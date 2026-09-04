import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { buildSyllabusLookup, validateImportQuestions } from './import-policy.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function text(v: unknown){ return String(v ?? '').trim() }
async function loadTree(admin:any){
  const [u,c,s]=await Promise.all([
    admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('subject').order('sort_order'),
    admin.from('neet_syllabus_topics').select('id,unit_id,topic_title,sort_order').order('unit_id').order('sort_order'),
    admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,status,sort_order').order('chapter_id').order('sort_order')
  ])
  if(u.error) throw new Error(u.error.message); if(c.error) throw new Error(c.error.message); if(s.error) throw new Error(s.error.message)
  return {units:u.data||[],chapters:c.data||[],subtopics:s.data||[]}
}

Deno.serve(async (req: Request) => {
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
    const {data:profile}=await userClient.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()
    if(!profile||profile.role!=='admin'||!profile.is_active) return json({error:'Admin access required'},403)
    const admin=createClient(url,sec,{auth:{persistSession:false}})
    const body=await req.json(); const action=text(body.action)

    if(action==='list'){
      const {data:rows,error}=await admin.from('question_bank_questions')
        .select('id,subject,unit_id,chapter_id,subtopic_id,question_text,default_marks,default_negative_marks,difficulty,question_type,source_label,source_year,created_at')
        .eq('is_active',true).order('created_at',{ascending:false}).limit(5000)
      if(error) return json({error:error.message},400)
      const tree=await loadTree(admin)
      const units=new Map(tree.units.map((x:any)=>[String(x.id),x]))
      const chapters=new Map(tree.chapters.map((x:any)=>[String(x.id),x]))
      const topics=new Map(tree.subtopics.map((x:any)=>[String(x.id),x]))
      const questions=(rows||[]).map((q:any)=>({
        ...q,
        unitTitle:units.get(String(q.unit_id))?.unit_title||'',
        unitNo:units.get(String(q.unit_id))?.unit_no??null,
        chapterTitle:chapters.get(String(q.chapter_id))?.topic_title||'',
        topicTitle:topics.get(String(q.subtopic_id))?.subtopic_title||''
      }))
      return json({ok:true,questions})
    }

    if(action==='bulk_import'){
      const examId=text(body.examId), raw=Array.isArray(body.questions)?body.questions:[]
      if(!examId) return json({error:'Exam ID is required'},400)
      if(!raw.length) return json({error:'No questions supplied'},400)
      if(raw.length>250) return json({error:'Maximum 250 questions per import'},400)
      const tree=await loadTree(admin), lookup=buildSyllabusLookup(tree)
      const validation=validateImportQuestions(lookup,raw)
      if(!validation.ok) return json({error:'Import needs review before anything is saved.',errors:validation.errors.slice(0,100)},400)
      const {data,error}=await admin.rpc('import_exam_questions_to_bank',{p_exam_id:examId,p_items:validation.items,p_created_by:user.id})
      if(error) return json({error:error.message},400)
      return json({ok:true,...(data||{})})
    }

    if(action==='add_to_exam'){
      const examId=text(body.examId), bankIds=[...new Set((Array.isArray(body.bankIds)?body.bankIds:[]).map((x:any)=>text(x)).filter(Boolean))]
      if(!examId||!bankIds.length) return json({error:'Target exam and selected questions are required'},400)
      const {data,error}=await admin.rpc('add_bank_questions_to_exam',{p_exam_id:examId,p_bank_ids:bankIds,p_created_by:user.id})
      if(error) return json({error:error.message},400)
      return json({ok:true,...(data||{})})
    }

    if(action==='sync_exam'){
      const examId=text(body.examId); if(!examId) return json({error:'Exam ID is required'},400)
      const {data:maps,error:mapError}=await admin.from('exam_question_syllabus_map').select('question_id,subtopic_id').eq('exam_id',examId)
      if(mapError) return json({error:mapError.message},400)
      const groups=new Map<string,string[]>()
      for(const row of maps||[]){ const key=String(row.subtopic_id); if(!groups.has(key))groups.set(key,[]); groups.get(key)!.push(String(row.question_id)) }
      let synced=0
      for(const [subtopicId,ids] of groups){
        const {data,error}=await admin.rpc('sync_exam_questions_to_bank',{p_exam_id:examId,p_question_ids:ids,p_subtopic_id:Number(subtopicId),p_created_by:user.id})
        if(error) return json({error:error.message},400)
        synced+=Number(data?.synced||0)
      }
      return json({ok:true,synced})
    }

    return json({error:'Unknown action'},400)
  }catch(e){ return json({error:e instanceof Error?e.message:'Question Bank operation failed'},400) }
})
