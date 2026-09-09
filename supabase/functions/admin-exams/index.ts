import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { normaliseAudience, nextMaxAttempts } from './audience-policy.mjs'
import { normaliseExamScopeDraftV2, canSaveExamScope, buildExamScopeSummary } from './exam-scope-logic.mjs'
import { validateExamMapping } from '../_shared/exam-mapping-logic.mjs'
import { normaliseExamType, templateForExamType } from '../_shared/exam-intelligence-policy.mjs'
import { canPublishExam } from './publish-validation.mjs'
import { buildExamControlItem, buildControlCenterSummary } from './control-center-policy.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function hashPassword(password: string) {
  const enc = new TextEncoder().encode(password)
  return crypto.subtle.digest('SHA-256', enc).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
}
function normaliseIsoExamDate(value: unknown) {
  const text=String(value??'').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const d=new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==text) return null
  return text
}
function indiaToday() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||''
  return `${get('year')}-${get('month')}-${get('day')}`
}
async function bestEffortCommunicate(action: string, payload: Record<string, unknown>) {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('ACADEMY_COMMUNICATIONS_INTERNAL_KEY') || ''
  if (!url || !key) return { ok:false, skipped:true, reason:'Communications internal delivery is not configured' }
  try {
    const response = await fetch(`${url}/functions/v1/academy-communications`, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-sga-internal-key':key},
      body:JSON.stringify({action,...payload})
    })
    const data = await response.json().catch(()=>({}))
    if (!response.ok) return { ok:false, error:String(data?.error||'Communication request failed') }
    return { ok:true, response:data }
  } catch (error) {
    console.error('best-effort communication failed', error instanceof Error ? error.message : String(error))
    return { ok:false, error:error instanceof Error ? error.message : 'Communication request failed' }
  }
}
async function activeStudents(admin: any) {
  const { data, error } = await admin.from('profiles').select('id,full_name,student_id').eq('role','student').eq('is_active',true).order('full_name')
  if (error) throw new Error(error.message)
  return data || []
}
async function assignmentMap(admin: any, examId: string) {
  const { data, error } = await admin.from('exam_student_assignments').select('student_id,is_assigned,max_attempts').eq('exam_id',examId)
  if (error) throw new Error(error.message)
  return new Map((data || []).map((r: any) => [String(r.student_id), r]))
}
async function applyAudience(admin: any, examId: string, mode: string, studentIds: unknown) {
  const norm = normaliseAudience(mode, studentIds)
  if (!norm.ok) return norm
  const students = await activeStudents(admin)
  const activeIds = new Set(students.map((s:any)=>String(s.id)))
  const targetIds = norm.mode === 'all' ? [...activeIds] : norm.studentIds
  if (targetIds.some((id:string)=>!activeIds.has(id))) return { ok:false, error:'One or more selected students are not active' }
  const existing = await assignmentMap(admin, examId)
  const now = new Date().toISOString()
  const { error: offErr } = await admin.from('exam_student_assignments').update({is_assigned:false,updated_at:now}).eq('exam_id',examId)
  if (offErr) return { ok:false, error:offErr.message }
  if (targetIds.length) {
    const rows = targetIds.map((studentId:string)=>({exam_id:examId,student_id:studentId,is_assigned:true,max_attempts:Math.max(1,Number(existing.get(studentId)?.max_attempts)||1),updated_at:now}))
    const { error: upErr } = await admin.from('exam_student_assignments').upsert(rows,{onConflict:'exam_id,student_id'})
    if (upErr) return { ok:false, error:upErr.message }
  }
  const { error: examErr } = await admin.from('exams').update({audience_mode:norm.mode}).eq('id',examId)
  if (examErr) return { ok:false, error:examErr.message }
  return { ok:true, mode:norm.mode, assignedCount:targetIds.length }
}
async function ensureEligibleAssignment(admin:any, examId:string, studentId:string) {
  const { data: exam } = await admin.from('exams').select('id,audience_mode').eq('id',examId).maybeSingle()
  if (!exam) return { ok:false, error:'Exam not found' }
  const { data: student } = await admin.from('profiles').select('id').eq('id',studentId).eq('role','student').eq('is_active',true).maybeSingle()
  if (!student) return { ok:false, error:'Active student not found' }
  const { data: a } = await admin.from('exam_student_assignments').select('student_id,is_assigned,max_attempts').eq('exam_id',examId).eq('student_id',studentId).maybeSingle()
  if (exam.audience_mode === 'selected' && !a?.is_assigned) return { ok:false, error:'Student is not assigned to this exam' }
  return { ok:true, assignment:a || null }
}

async function loadScopeTree(admin:any) {
  const [unitsRes, chaptersRes, subtopicsRes] = await Promise.all([
    admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('subject').order('sort_order').order('unit_no'),
    admin.from('neet_syllabus_topics').select('id,unit_id,topic_title,sort_order').order('unit_id').order('sort_order').order('id'),
    admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,sort_order,status,source').neq('status','disabled').order('chapter_id').order('sort_order').order('id')
  ])
  if (unitsRes.error) throw new Error(unitsRes.error.message)
  if (chaptersRes.error) throw new Error(chaptersRes.error.message)
  if (subtopicsRes.error) throw new Error(subtopicsRes.error.message)
  const subtopicsByChapter = new Map<string,any[]>()
  for (const row of subtopicsRes.data || []) {
    const key = String(row.chapter_id)
    if (!subtopicsByChapter.has(key)) subtopicsByChapter.set(key,[])
    subtopicsByChapter.get(key)!.push(row)
  }
  const chaptersByUnit = new Map<string,any[]>()
  for (const row of chaptersRes.data || []) {
    const key = String(row.unit_id)
    if (!chaptersByUnit.has(key)) chaptersByUnit.set(key,[])
    chaptersByUnit.get(key)!.push({...row,subtopics:subtopicsByChapter.get(String(row.id)) || []})
  }
  const syllabus = (unitsRes.data || []).map((row:any)=>({...row,chapters:chaptersByUnit.get(String(row.id)) || []}))
  const lookup = {units:new Map<any,any>(),chapters:new Map<any,any>(),subtopics:new Map<any,any>()}
  for (const unit of syllabus) {
    lookup.units.set(unit.id,unit); lookup.units.set(String(unit.id),unit)
    for (const chapter of unit.chapters || []) {
      lookup.chapters.set(chapter.id,chapter); lookup.chapters.set(String(chapter.id),chapter)
      for (const subtopic of chapter.subtopics || []) {
        lookup.subtopics.set(subtopic.id,subtopic); lookup.subtopics.set(String(subtopic.id),subtopic)
      }
    }
  }
  return {syllabus,lookup}
}

function hydrateLegacyScopeInput(items:any[], lookup:any) {
  return (Array.isArray(items)?items:[]).map((raw:any)=>{
    const unit=lookup.units.get(raw?.unitId)||lookup.units.get(String(raw?.unitId))
    const subtopic=raw?.subtopicId==null||raw?.subtopicId===''?null:(lookup.subtopics.get(raw.subtopicId)||lookup.subtopics.get(String(raw.subtopicId)))
    return {...raw,subject:String(raw?.subject||unit?.subject||''),scopeType:String(raw?.scopeType||(subtopic?'topic':'chapter')),topicName:String(raw?.topicName||subtopic?.subtopic_title||'')}
  })
}
function validateScopeDraftAgainstTree(items:any[], lookup:any) {
  for (const item of items) {
    const unit=lookup.units.get(item.unitId)||lookup.units.get(String(item.unitId))
    if (!unit || unit.subject !== item.subject) return {ok:false,error:'Selected Unit does not belong to selected Subject'}
    const chapter=lookup.chapters.get(item.chapterId)||lookup.chapters.get(String(item.chapterId))
    if (!chapter || Number(chapter.unit_id)!==Number(item.unitId)) return {ok:false,error:'Selected Chapter does not belong to selected Unit'}
    if (item.subtopicId!=null) {
      const subtopic=lookup.subtopics.get(item.subtopicId)||lookup.subtopics.get(String(item.subtopicId))
      if (!subtopic || Number(subtopic.chapter_id)!==Number(item.chapterId)) return {ok:false,error:'Selected Topic does not belong to selected Chapter'}
    }
  }
  return {ok:true}
}
function enrichScopeRows(rows:any[], lookup:any) {
  return (rows||[]).map((row:any)=>{
    const unit=lookup.units.get(row.unit_id)||lookup.units.get(String(row.unit_id))
    const subtopic=row.subtopic_id==null?null:(lookup.subtopics.get(row.subtopic_id)||lookup.subtopics.get(String(row.subtopic_id)))
    return {id:row.id,subject:unit?.subject||'',unitId:row.unit_id,chapterId:row.chapter_id,scopeType:row.subtopic_id==null?'chapter':'topic',topicName:subtopic?.subtopic_title||'',subtopicId:row.subtopic_id,subtopicTitle:subtopic?.subtopic_title||'',sortOrder:row.sort_order}
  })
}

async function loadPublishValidation(admin: any, examId: string) {
  const { data: exam, error: examErr } = await admin.from('exams').select('id,total_marks').eq('id', examId).maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!exam) throw new Error('Exam not found')
  const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,exam_id,question_no,marks').eq('exam_id', examId).order('question_no')
  if (qErr) throw new Error(qErr.message)
  const questionIds = (questions || []).map((q:any)=>q.id)
  let answerKeys:any[] = []
  if (questionIds.length) {
    const r = await admin.from('exam_answer_keys').select('question_id,correct_option').in('question_id', questionIds)
    if (r.error) throw new Error(r.error.message)
    answerKeys = r.data || []
  }
  const { data: mappingRowsRaw, error: mapErr } = await admin.from('exam_question_syllabus_map').select('question_id,exam_id,subtopic_id').eq('exam_id', examId)
  if (mapErr) throw new Error(mapErr.message)
  const questionNo = new Map((questions || []).map((q:any)=>[String(q.id),q.question_no]))
  const mappingRows = (mappingRowsRaw || []).map((row:any)=>({...row,question_no:questionNo.get(String(row.question_id))}))
  const { data: approvedRows, error: subErr } = await admin.from('neet_syllabus_subtopics').select('id').eq('status','approved')
  if (subErr) throw new Error(subErr.message)
  return validateExamMapping({questions:questions || [],answerKeys,mappingRows,approvedSubtopicIds:(approvedRows || []).map((row:any)=>row.id),totalMarks:exam.total_marks})
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const pub = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || Deno.env.get('SUPABASE_ANON_KEY')!
    const sec = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, pub, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await userClient.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin' || !profile.is_active) return json({ error: 'Admin access required' }, 403)
    const admin = createClient(url, sec, { auth: { persistSession: false } })
    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'control_center') {
      const examsRes=await admin.from('exams').select('id,title,exam_type,exam_date,batch_no,expected_questions,is_published,result_published,status,result_publish_mode,result_publish_at,new_starts_closed_at,blueprint_approved_at,archived_at,exam_access(exam_code)').order('created_at',{ascending:false})
      if (examsRes.error) return json({error:examsRes.error.message},400)
      const [assignmentsRes,attemptsRes,resultsRes]=await Promise.all([
        admin.from('exam_student_assignments').select('exam_id,student_id,is_assigned').eq('is_assigned',true),
        admin.from('exam_attempts').select('id,exam_id,status,submitted_at'),
        admin.from('exam_results').select('attempt_id,is_published')
      ])
      if (assignmentsRes.error) return json({error:assignmentsRes.error.message},400)
      if (attemptsRes.error) return json({error:attemptsRes.error.message},400)
      if (resultsRes.error) return json({error:resultsRes.error.message},400)

      const assignmentsByExam=new Map<string,number>()
      for (const row of assignmentsRes.data||[]) {
        const key=String(row.exam_id)
        assignmentsByExam.set(key,(assignmentsByExam.get(key)||0)+1)
      }
      const attemptsByExam=new Map<string,any[]>()
      const attemptToExam=new Map<string,string>()
      for (const row of attemptsRes.data||[]) {
        const key=String(row.exam_id)
        if (!attemptsByExam.has(key)) attemptsByExam.set(key,[])
        attemptsByExam.get(key)!.push(row)
        attemptToExam.set(String(row.id),key)
      }
      const resultsByExam=new Map<string,any[]>()
      for (const row of resultsRes.data||[]) {
        const examId=attemptToExam.get(String(row.attempt_id))
        if (!examId) continue
        if (!resultsByExam.has(examId)) resultsByExam.set(examId,[])
        resultsByExam.get(examId)!.push(row)
      }

      const items=await Promise.all((examsRes.data||[]).map(async (exam:any)=>{
        const examId=String(exam.id)
        const validation=await loadPublishValidation(admin,examId)
        const attempts=attemptsByExam.get(examId)||[]
        const results=resultsByExam.get(examId)||[]
        const totalQuestions=Number(validation?.totalQuestions||0)
        const missingKeys=Array.isArray(validation?.answerKeyMissingQuestionNos)?validation.answerKeyMissingQuestionNos.length:0
        const access=Array.isArray(exam.exam_access)?exam.exam_access[0]:exam.exam_access
        return buildExamControlItem({
          id:exam.id,
          title:exam.title,
          examType:exam.exam_type,
          examDate:exam.exam_date,
          batchNo:exam.batch_no,
          examCode:access?.exam_code||null,
          isPublished:Boolean(exam.is_published),
          resultPublished:Boolean(exam.result_published),
          newStartsClosedAt:exam.new_starts_closed_at,
          archivedAt:exam.archived_at,
          legacyCompleted:exam.status==='completed',
          expectedQuestions:exam.expected_questions,
          questionCount:totalQuestions,
          mappedQuestions:Number(validation?.mappedQuestions||0),
          keyedQuestions:Math.max(0,totalQuestions-missingKeys),
          blueprintApproved:Boolean(exam.blueprint_approved_at),
          assignedCount:assignmentsByExam.get(examId)||0,
          activeCount:attempts.filter((a:any)=>a.status==='in_progress').length,
          submittedCount:attempts.filter((a:any)=>a.status==='submitted'&&a.submitted_at).length,
          readyResultCount:results.filter((r:any)=>!r.is_published).length,
          publishedResultCount:results.filter((r:any)=>r.is_published).length,
          resultPublishMode:exam.result_publish_mode||'manual'
        })
      }))
      const today=indiaToday()
      const summary=buildControlCenterSummary(items,{today})
      return json({ok:true,today,summary,exams:items})
    }

    if (action === 'scope_tree') {
      const { syllabus } = await loadScopeTree(admin)
      return json({ok:true,syllabus})
    }
    if (action === 'get_scope') {
      const examId=String(body.examId||'')
      const {data:exam,error:examError}=await admin.from('exams').select('id,syllabus').eq('id',examId).maybeSingle()
      if (examError) return json({error:examError.message},400)
      if (!exam) return json({error:'Exam not found'},404)
      const {data:scopeRows,error:scopeError}=await admin.from('exam_scope_items').select('id,unit_id,chapter_id,subtopic_id,sort_order').eq('exam_id',examId).order('sort_order').order('id')
      if (scopeError) return json({error:scopeError.message},400)
      const {lookup}=await loadScopeTree(admin)
      return json({ok:true,scopeItems:enrichScopeRows(scopeRows||[],lookup),legacySyllabus:exam.syllabus||''})
    }
    if (action === 'create' || action === 'update') {
      const examId=String(body.examId||'')
      const title=String(body.title||'').trim()
      const subject=String(body.subject||'NEET')
      const requestedExamType=normaliseExamType(body.examType)
      const requestedExamDate=normaliseIsoExamDate(body.examDate)
      const legacyDurationMinutes=Number(body.durationMinutes||0)
      const legacyTotalMarks=Number(body.totalMarks||0)
      const legacyNegativeMarking=Boolean(body.negativeMarking)
      const instructions=String(body.instructions||'').trim()
      const legacyExamCode=String(body.legacyExamCode||body.examCode||'').trim().toUpperCase()
      const examPassword=String(body.examPassword||'')
      if (title.length<3) return json({error:'Enter exam title'},400)
      if (!['Physics','Chemistry','Biology','NEET','Mixed'].includes(subject)) return json({error:'Invalid subject'},400)
      if (action==='create'&&examPassword.length<4) return json({error:'Exam password must be at least 4 characters'},400)
      if (action==='update'&&examPassword&&examPassword.length<4) return json({error:'New password must be at least 4 characters'},400)

      let existing:any=null,hadStructuredScope=false
      if (action==='update') {
        if (!examId) return json({error:'Exam ID is required'},400)
        const existingRes=await admin.from('exams').select('id,is_published,status,syllabus,exam_type,exam_date,expected_questions,duration_minutes,total_marks,negative_marking').eq('id',examId).maybeSingle()
        if (existingRes.error) return json({error:existingRes.error.message},400)
        existing=existingRes.data
        if (!existing) return json({error:'Exam not found'},404)
        const countRes=await admin.from('exam_scope_items').select('id',{count:'exact',head:true}).eq('exam_id',examId)
        if (countRes.error) return json({error:countRes.error.message},400)
        hadStructuredScope=Number(countRes.count||0)>0
      }

      const isLegacyUpdate=action==='update'&&!existing?.exam_type
      const isLegacyCreate=action==='create'&&!requestedExamType&&!requestedExamDate&&Boolean(String(body.examCode||'').trim())
      let examType:string|null=null,examDate:string|null=null,template:any=null

      if (action==='create'&&!isLegacyCreate) {
        if (!requestedExamType) return json({error:'Select Exam Type'},400)
        if (!requestedExamDate) return json({error:'Enter valid Exam Date'},400)
        examType=requestedExamType
        examDate=requestedExamDate
        template=templateForExamType(examType)
        if ((examType==='unit'||examType==='monthly')&&subject!=='NEET') return json({error:'Unit and Monthly exams must use NEET subject distribution'},400)
      } else if (action==='update'&&existing?.exam_type) {
        const storedType=normaliseExamType(existing.exam_type)
        if (!storedType) return json({error:'Stored official Exam Type is invalid'},409)
        if (body.examType!=null && requestedExamType!==storedType) return json({error:'Official Exam Type cannot be changed'},409)
        const storedDate=String(existing.exam_date||'')
        if (body.examDate!=null && requestedExamDate!==storedDate) return json({error:'Official Exam Date cannot be changed'},409)
        examType=storedType
        examDate=storedDate
        template=templateForExamType(examType)
        if ((examType==='unit'||examType==='monthly')&&subject!=='NEET') return json({error:'Unit and Monthly exams must use NEET subject distribution'},400)
      } else {
        if (!Number.isFinite(legacyDurationMinutes)||legacyDurationMinutes<=0) return json({error:'Enter valid duration'},400)
        if (!Number.isFinite(legacyTotalMarks)||legacyTotalMarks<=0) return json({error:'Enter total marks'},400)
        if (!/^[A-Z0-9-]{4,20}$/.test(legacyExamCode)) return json({error:'Legacy Exam Code must be 4-20 letters/numbers'},400)
      }

      const {lookup}=await loadScopeTree(admin)
      const hydrated=hydrateLegacyScopeInput(body.scopeItems||[],lookup)
      const scopeNorm=normaliseExamScopeDraftV2(hydrated)
      if (!scopeNorm.ok) return json({error:scopeNorm.error},400)
      const scopeGate=canSaveExamScope({action,hadStructuredScope,items:scopeNorm.items})
      if (!scopeGate.ok) return json({error:scopeGate.error},400)
      const hierarchyCheck=validateScopeDraftAgainstTree(scopeNorm.items,lookup)
      if (!hierarchyCheck.ok) return json({error:hierarchyCheck.error},400)

      if (action==='create') {
        if (isLegacyCreate) {
          const {data:exam,error:examError}=await admin.from('exams').insert({title,subject,syllabus:null,scheduled_start:null,scheduled_end:null,duration_minutes:legacyDurationMinutes,total_marks:legacyTotalMarks,negative_marking:legacyNegativeMarking,instructions:instructions||null,status:'draft',is_published:false,result_published:false,audience_mode:'all',created_by:user.id}).select('id').single()
          if (examError||!exam) return json({error:examError?.message||'Could not create legacy exam'},400)
          const passwordHash=await hashPassword(examPassword)
          const {error:accessError}=await admin.from('exam_access').insert({exam_id:exam.id,exam_code:legacyExamCode,password_hash:passwordHash})
          if (accessError) {await admin.from('exams').delete().eq('id',exam.id);return json({error:accessError.message||'Exam access setup failed'},400)}
          const {data:scopeData,error:scopeError}=await admin.rpc('replace_exam_scope_items_v2',{p_exam_id:exam.id,p_items:scopeNorm.items,p_created_by:user.id})
          if (scopeError) {await admin.from('exams').delete().eq('id',exam.id);return json({error:scopeError.message||'Exam syllabus scope setup failed'},400)}
          const {lookup:resolvedLookup}=await loadScopeTree(admin)
          const resolvedItems=Array.isArray(scopeData?.items)?scopeData.items:[]
          const syllabusSummary=buildExamScopeSummary(resolvedItems,resolvedLookup)
          if (!syllabusSummary) {await admin.from('exams').delete().eq('id',exam.id);return json({error:'Could not build syllabus scope summary'},400)}
          const sumUpdate=await admin.from('exams').update({syllabus:syllabusSummary}).eq('id',exam.id)
          if (sumUpdate.error) {await admin.from('exams').delete().eq('id',exam.id);return json({error:sumUpdate.error.message},400)}
          return json({ok:true,examId:exam.id,examCode:legacyExamCode,scopeItems:resolvedItems,legacy:true})
        }

        const {data:exam,error:examError}=await admin.from('exams').insert({title,subject,syllabus:null,exam_type:examType,exam_date:examDate,expected_questions:template.questions,scheduled_start:null,scheduled_end:null,duration_minutes:template.durationMinutes,total_marks:template.totalMarks,negative_marking:template.negativeMarking,instructions:instructions||null,status:'draft',is_published:false,result_published:false,audience_mode:'all',created_by:user.id}).select('id').single()
        if (examError||!exam) return json({error:examError?.message||'Could not create exam'},400)
        const codeRes=await admin.rpc('allocate_exam_code',{p_exam_type:examType,p_exam_date:examDate})
        if (codeRes.error||!codeRes.data) {await admin.from('exams').delete().eq('id',exam.id);return json({error:codeRes.error?.message||'Could not generate Exam Code'},400)}
        const examCode=String(codeRes.data)
        const passwordHash=await hashPassword(examPassword)
        const {error:accessError}=await admin.from('exam_access').insert({exam_id:exam.id,exam_code:examCode,password_hash:passwordHash})
        if (accessError) {await admin.from('exams').delete().eq('id',exam.id);return json({error:accessError.message||'Exam access setup failed'},400)}
        const {data:scopeData,error:scopeError}=await admin.rpc('replace_exam_scope_items_v2',{p_exam_id:exam.id,p_items:scopeNorm.items,p_created_by:user.id})
        if (scopeError) {await admin.from('exams').delete().eq('id',exam.id);return json({error:scopeError.message||'Exam syllabus scope setup failed'},400)}
        const {lookup:resolvedLookup}=await loadScopeTree(admin)
        const resolvedItems=Array.isArray(scopeData?.items)?scopeData.items:[]
        const syllabusSummary=buildExamScopeSummary(resolvedItems,resolvedLookup)
        if (!syllabusSummary) {await admin.from('exams').delete().eq('id',exam.id);return json({error:'Could not build syllabus scope summary'},400)}
        const sumUpdate=await admin.from('exams').update({syllabus:syllabusSummary}).eq('id',exam.id)
        if (sumUpdate.error) {await admin.from('exams').delete().eq('id',exam.id);return json({error:sumUpdate.error.message},400)}
        return json({ok:true,examId:exam.id,examCode,scopeItems:resolvedItems})
      }

      const nextStatus=existing.is_published?'active':(existing.status==='completed'?'completed':'draft')
      const examUpdate=existing.exam_type
        ? {title,subject,scheduled_start:null,scheduled_end:null,duration_minutes:template.durationMinutes,total_marks:template.totalMarks,negative_marking:template.negativeMarking,instructions:instructions||null,status:nextStatus}
        : {title,subject,scheduled_start:null,scheduled_end:null,duration_minutes:legacyDurationMinutes,total_marks:legacyTotalMarks,negative_marking:legacyNegativeMarking,instructions:instructions||null,status:nextStatus}
      const {error:examError}=await admin.from('exams').update(examUpdate).eq('id',examId)
      if (examError) return json({error:examError.message},400)
      const accessUpdate:any={}
      if (isLegacyUpdate) accessUpdate.exam_code=legacyExamCode
      if (examPassword) accessUpdate.password_hash=await hashPassword(examPassword)
      if (Object.keys(accessUpdate).length) {
        const {error:accessError}=await admin.from('exam_access').update(accessUpdate).eq('exam_id',examId)
        if (accessError) return json({error:accessError.message},400)
      }
      if (hadStructuredScope||scopeNorm.items.length) {
        const {data:scopeData,error:scopeError}=await admin.rpc('replace_exam_scope_items_v2',{p_exam_id:examId,p_items:scopeNorm.items,p_created_by:user.id})
        if (scopeError) return json({error:scopeError.message||'Could not update exam syllabus scope'},400)
        const {lookup:resolvedLookup}=await loadScopeTree(admin)
        const resolvedItems=Array.isArray(scopeData?.items)?scopeData.items:[]
        const syllabusSummary=buildExamScopeSummary(resolvedItems,resolvedLookup)
        if (!syllabusSummary) return json({error:'Could not build syllabus scope summary'},400)
        const sumUpdate=await admin.from('exams').update({syllabus:syllabusSummary}).eq('id',examId)
        if (sumUpdate.error) return json({error:sumUpdate.error.message},400)
        return json({ok:true,scopeItems:resolvedItems})
      }
      return json({ok:true})
    }

    if (action === 'students') {
      const examId=String(body.examId||'')
      const {data:exam}=await admin.from('exams').select('id,audience_mode').eq('id',examId).maybeSingle()
      if (!exam) return json({error:'Exam not found'},404)
      const students=await activeStudents(admin),assignments=await assignmentMap(admin,examId)
      return json({ok:true,audienceMode:exam.audience_mode,students:students.map((s:any)=>({...s,assigned:Boolean(assignments.get(String(s.id))?.is_assigned),max_attempts:Math.max(1,Number(assignments.get(String(s.id))?.max_attempts)||1)}))})
    }
    if (action === 'publish') {
      const examId=String(body.examId||'')
      const mappingValidation=await loadPublishValidation(admin,examId)
      const gate=canPublishExam({mappingValidation})
      if (!gate.ok) return json({error:gate.error,validation:gate.validation},409)
      if (body.audienceMode!=null) {
        const applied=await applyAudience(admin,examId,String(body.audienceMode),body.studentIds)
        if (!applied.ok) return json({error:applied.error},400)
      } else {
        const {data:exam}=await admin.from('exams').select('audience_mode').eq('id',examId).maybeSingle()
        if (!exam) return json({error:'Exam not found'},404)
        if (exam.audience_mode==='all') {const applied=await applyAudience(admin,examId,'all',[]);if(!applied.ok)return json({error:applied.error},400)}
      }
      const {error}=await admin.from('exams').update({is_published:true,status:'active',scheduled_start:null,scheduled_end:null}).eq('id',examId)
      if (error) return json({error:error.message},400)
      const communication=await bestEffortCommunicate('exam_published',{examId})
      return json({ok:true,communication})
    }
    if (action === 'publish_result') {
    const attemptId=String(body.attemptId||'')
    if (!attemptId) return json({error:'Attempt ID is required'},400)
    const {data:attempt,error:attemptError}=await admin.from('exam_attempts').select('id,exam_id,student_id').eq('id',attemptId).maybeSingle()
    if (attemptError) return json({error:attemptError.message},400)
    if (!attempt) return json({error:'Attempt not found'},404)
    const {data:result,error:resultError}=await admin.from('exam_results').select('attempt_id').eq('attempt_id',attemptId).maybeSingle()
    if (resultError) return json({error:resultError.message},400)
    if (!result) return json({error:'Result not found'},404)
    const resultUpdate=await admin.from('exam_results').update({is_published:true}).eq('attempt_id',attemptId)
    if (resultUpdate.error) return json({error:resultUpdate.error.message},400)
    const examUpdate=await admin.from('exams').update({result_published:true}).eq('id',attempt.exam_id)
    if (examUpdate.error) return json({error:examUpdate.error.message},400)
    const communication=await bestEffortCommunicate('result_published',{attemptId})
    return json({ok:true,communication})
  }
  if (action === 'set_audience') {
      const examId=String(body.examId||''),applied=await applyAudience(admin,examId,String(body.audienceMode||''),body.studentIds)
      if (!applied.ok) return json({error:applied.error},400)
      return json({ok:true,assignedCount:applied.assignedCount,audienceMode:applied.mode})
    }
    if (action === 'unpublish') {
      const {error}=await admin.from('exams').update({is_published:false,status:'draft',scheduled_start:null,scheduled_end:null}).eq('id',String(body.examId||''))
      if (error) return json({error:error.message},400); return json({ok:true})
    }
    if (action === 'complete') {
      const {error}=await admin.from('exams').update({status:'completed',is_published:false}).eq('id',String(body.examId||''))
      if (error) return json({error:error.message},400); return json({ok:true})
    }
    if (action === 'reexam_student') {
      const examId=String(body.examId||''),studentId=String(body.studentId||''),eligible=await ensureEligibleAssignment(admin,examId,studentId)
      if (!eligible.ok) return json({error:eligible.error},400)
      const maxAttempts=nextMaxAttempts(eligible.assignment?.max_attempts)
      const {error}=await admin.from('exam_student_assignments').upsert({exam_id:examId,student_id:studentId,is_assigned:true,max_attempts:maxAttempts,updated_at:new Date().toISOString()},{onConflict:'exam_id,student_id'})
      if (error) return json({error:error.message},400); return json({ok:true,maxAttempts})
    }
    if (action === 'reexam_all') {
      const examId=String(body.examId||''),{data:exam}=await admin.from('exams').select('id,audience_mode').eq('id',String(body.examId||'')).maybeSingle()
      if (!exam) return json({error:'Exam not found'},404)
      const students=await activeStudents(admin),assignments=await assignmentMap(admin,examId)
      const target=exam.audience_mode==='all'?students.map((s:any)=>String(s.id)):students.map((s:any)=>String(s.id)).filter((id:string)=>assignments.get(id)?.is_assigned)
      if (!target.length) return json({error:'No assigned students found'},409)
      const rows=target.map((studentId:string)=>({exam_id:examId,student_id:studentId,is_assigned:true,max_attempts:nextMaxAttempts(assignments.get(studentId)?.max_attempts),updated_at:new Date().toISOString()}))
      const {error}=await admin.from('exam_student_assignments').upsert(rows,{onConflict:'exam_id,student_id'})
      if (error) return json({error:error.message},400); return json({ok:true,affected:rows.length})
    }
    if (action === 'reset_attempt') {
      const attemptId=String(body.attemptId||''),{data:attempt}=await admin.from('exam_attempts').select('id,exam_id,student_id').eq('id',attemptId).maybeSingle()
      if (!attempt) return json({error:'Attempt not found'},404)
      const {error}=await admin.from('exam_attempts').delete().eq('id',attemptId)
      if (error) return json({error:error.message},400); return json({ok:true,examId:attempt.exam_id,studentId:attempt.student_id})
    }
    if (action === 'reset_student') {
      const examId=String(body.examId||''),studentId=String(body.studentId||''),eligible=await ensureEligibleAssignment(admin,examId,studentId)
      if (!eligible.ok) return json({error:eligible.error},400)
      const {error:delErr}=await admin.from('exam_attempts').delete().eq('exam_id',examId).eq('student_id',studentId)
      if (delErr) return json({error:delErr.message},400)
      const {error:aErr}=await admin.from('exam_student_assignments').upsert({exam_id:examId,student_id:studentId,is_assigned:true,max_attempts:1,updated_at:new Date().toISOString()},{onConflict:'exam_id,student_id'})
      if (aErr) return json({error:aErr.message},400); return json({ok:true})
    }
    if (action === 'reset_all') {
      const examId=String(body.examId||''),{error:delErr}=await admin.from('exam_attempts').delete().eq('exam_id',String(body.examId||''))
      if (delErr) return json({error:delErr.message},400)
      const {error:aErr}=await admin.from('exam_student_assignments').update({max_attempts:1,updated_at:new Date().toISOString()}).eq('exam_id',examId)
      if (aErr) return json({error:aErr.message},400)
      await admin.from('exams').update({result_published:false}).eq('id',examId); return json({ok:true})
    }
    if (action === 'delete') {
      const examId=String(body.examId||''),confirmCode=String(body.confirmCode||'').trim().toUpperCase()
      const {data:access}=await admin.from('exam_access').select('exam_code').eq('exam_id',examId).maybeSingle()
      if (!access) return json({error:'Exam access record not found'},404)
      if (!confirmCode||confirmCode!==String(access.exam_code).toUpperCase()) return json({error:'Type the exact Exam Code to delete this exam'},409)
      const {error}=await admin.from('exams').delete().eq('id',examId)
      if (error) return json({error:error.message},400); return json({ok:true})
    }
    return json({error:'Unknown action'},400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Exam operation failed. Please try again.' }, 400)
  }
})
