import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { canReadPerformance } from './visibility-policy.mjs'
import { validateExamMapping } from '../_shared/exam-mapping-logic.mjs'
import { buildScopePerformance } from '../student-exam-attempt/performance-logic.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
const text = (v: unknown) => String(v ?? '').trim()
const uniq = (values: unknown[]) => [...new Set(values.map(v => text(v)).filter(Boolean))]

async function enrichRows(admin: any, rows: any[]) {
  const studentIds = uniq(rows.map(r => r.student_id))
  const examIds = uniq(rows.map(r => r.exam_id))
  const unitIds = uniq(rows.map(r => r.unit_id))
  const chapterIds = uniq(rows.map(r => r.chapter_id))
  const subtopicIds = uniq(rows.map(r => r.subtopic_id))

  const [studentsR, examsR, unitsR, chaptersR, subtopicsR] = await Promise.all([
    studentIds.length ? admin.from('profiles').select('id,full_name,student_id').in('id', studentIds) : Promise.resolve({ data: [], error: null }),
    examIds.length ? admin.from('exams').select('id,title,subject,total_marks').in('id', examIds) : Promise.resolve({ data: [], error: null }),
    unitIds.length ? admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title').in('id', unitIds) : Promise.resolve({ data: [], error: null }),
    chapterIds.length ? admin.from('neet_syllabus_topics').select('id,unit_id,topic_title').in('id', chapterIds) : Promise.resolve({ data: [], error: null }),
    subtopicIds.length ? admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title').in('id', subtopicIds) : Promise.resolve({ data: [], error: null })
  ])
  const err = studentsR.error || examsR.error || unitsR.error || chaptersR.error || subtopicsR.error
  if (err) throw new Error(err.message)

  const by = (list: any[]) => new Map((list || []).map(row => [text(row.id), row]))
  const students = by(studentsR.data || []), exams = by(examsR.data || []), units = by(unitsR.data || []), chapters = by(chaptersR.data || []), subtopics = by(subtopicsR.data || [])
  return rows.map(row => {
    const student = students.get(text(row.student_id)) || {}
    const exam = exams.get(text(row.exam_id)) || {}
    const unit = units.get(text(row.unit_id)) || {}
    const chapter = chapters.get(text(row.chapter_id)) || {}
    const subtopic = subtopics.get(text(row.subtopic_id)) || {}
    return {
      ...row,
      student_name: student.full_name || null,
      student_code: student.student_id || null,
      exam_title: exam.title || null,
      subject: unit.subject || exam.subject || null,
      exam_total_marks: exam.total_marks ?? null,
      unit_no: unit.unit_no ?? null,
      unit_title: unit.unit_title || null,
      chapter_title: chapter.topic_title || null,
      subtopic_title: subtopic.subtopic_title || null
    }
  })
}

function applyFilters(rows: any[], filters: any = {}) {
  const pairs = [
    ['studentId','student_id'], ['subject','subject'], ['unitId','unit_id'], ['chapterId','chapter_id'],
    ['subtopicId','subtopic_id'], ['examId','exam_id'], ['coverage','coverage'], ['scopeLevel','scope_level']
  ]
  return rows.filter(row => pairs.every(([fk, rk]) => {
    const wanted = text(filters?.[fk])
    if (!wanted || wanted.toLowerCase() === 'all') return true
    return text(row?.[rk]).toLowerCase() === wanted.toLowerCase()
  }))
}

async function loadRebuildInputs(admin: any, examId: string) {
  const { data: exam, error: examErr } = await admin.from('exams').select('id,total_marks,negative_marking').eq('id', examId).maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!exam) throw new Error('Exam not found')
  const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,exam_id,question_no,marks,negative_marks').eq('exam_id', examId).order('question_no')
  if (qErr) throw new Error(qErr.message)
  const questionIds = (questions || []).map((q:any)=>q.id)
  let keys:any[] = []
  if (questionIds.length) {
    const r = await admin.from('exam_answer_keys').select('question_id,correct_option').in('question_id', questionIds)
    if (r.error) throw new Error(r.error.message)
    keys = r.data || []
  }
  const { data: mappings, error: mErr } = await admin.from('exam_question_syllabus_map').select('question_id,exam_id,mapping_group_id,subtopic_id').eq('exam_id', examId)
  if (mErr) throw new Error(mErr.message)
  const subtopicIds = uniq((mappings || []).map((m:any)=>m.subtopic_id))
  let subtopics:any[] = []
  if (subtopicIds.length) {
    const r = await admin.from('neet_syllabus_subtopics').select('id,chapter_id,status').in('id', subtopicIds)
    if (r.error) throw new Error(r.error.message)
    subtopics = r.data || []
  }
  const validation = validateExamMapping({
    questions: questions || [],
    answerKeys: keys,
    mappingRows: mappings || [],
    approvedSubtopicIds: subtopics.filter((s:any)=>s.status === 'approved').map((s:any)=>s.id),
    totalMarks: exam.total_marks
  })
  if (!validation.ok) {
    const e:any = new Error('Exam syllabus mapping is not valid for rebuild')
    e.validation = validation
    throw e
  }
  const groupIds = uniq((mappings || []).map((m:any)=>m.mapping_group_id))
  let groups:any[] = []
  if (groupIds.length) {
    const r = await admin.from('exam_mapping_groups').select('id,subtopic_id,coverage').in('id', groupIds)
    if (r.error) throw new Error(r.error.message)
    groups = r.data || []
  }
  const chapterIds = uniq(subtopics.map((s:any)=>s.chapter_id))
  let chapters:any[] = []
  if (chapterIds.length) {
    const r = await admin.from('neet_syllabus_topics').select('id,unit_id').in('id', chapterIds)
    if (r.error) throw new Error(r.error.message)
    chapters = r.data || []
  }
  const unitIds = uniq(chapters.map((c:any)=>c.unit_id))
  let units:any[] = []
  if (unitIds.length) {
    const r = await admin.from('neet_syllabus_units').select('id').in('id', unitIds)
    if (r.error) throw new Error(r.error.message)
    units = r.data || []
  }
  let approved:any[] = []
  if (chapterIds.length) {
    const r = await admin.from('neet_syllabus_subtopics').select('id,chapter_id').in('chapter_id', chapterIds).eq('status','approved')
    if (r.error) throw new Error(r.error.message)
    approved = r.data || []
  }
  const approvedSubtopicsByChapter: Record<string, number[]> = {}
  for (const row of approved) {
    const key = text(row.chapter_id)
    if (!approvedSubtopicsByChapter[key]) approvedSubtopicsByChapter[key] = []
    approvedSubtopicsByChapter[key].push(Number(row.id))
  }
  return { exam, questions:questions || [], keys, mappings:mappings || [], groups, subtopics, chapters, units, approvedSubtopicsByChapter, validation }
}

async function rebuildExam(admin: any, examId: string) {
  const input = await loadRebuildInputs(admin, examId)
  const { data: attempts, error: attemptsErr } = await admin.from('exam_attempts').select('id,exam_id,student_id,status,submitted_at,attempt_no').eq('exam_id', examId).in('status',['submitted','auto_submitted','graded']).order('submitted_at')
  if (attemptsErr) throw new Error(attemptsErr.message)
  const rows:any[] = []
  for (const attempt of attempts || []) {
    const { data: responses, error } = await admin.from('exam_responses').select('question_id,selected_option').eq('attempt_id', attempt.id)
    if (error) throw new Error(error.message)
    const built = buildScopePerformance({
      attemptId:attempt.id, examId, studentId:attempt.student_id,
      questions:input.questions, answerKeys:input.keys, responses:responses || [],
      mappings:input.mappings, mappingGroups:input.groups, subtopics:input.subtopics,
      chapters:input.chapters, units:input.units, approvedSubtopicsByChapter:input.approvedSubtopicsByChapter,
      negativeMarking:Boolean(input.exam.negative_marking)
    })
    if (!built.rows.length) throw new Error(`Could not rebuild syllabus performance for attempt ${attempt.id}`)
    rows.push(...built.rows)
  }
  const { data: existing, error: existingErr } = await admin.from('exam_scope_performance').select('*').eq('exam_id', examId)
  if (existingErr) throw new Error(existingErr.message)
  const { error: deleteErr } = await admin.from('exam_scope_performance').delete().eq('exam_id', examId)
  if (deleteErr) throw new Error(deleteErr.message)
  if (rows.length) {
    const { error: insertErr } = await admin.from('exam_scope_performance').insert(rows)
    if (insertErr) {
      if ((existing || []).length) await admin.from('exam_scope_performance').insert(existing)
      throw new Error(`Performance rebuild failed: ${insertErr.message}`)
    }
  }
  return { attempts:(attempts || []).length, rows:rows.length, validation:input.validation }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error:'Method not allowed' },405)
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error:'Unauthorized' },401)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const pub = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || Deno.env.get('SUPABASE_ANON_KEY')!
    const sec = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}})
    const { data:{ user } } = await userClient.auth.getUser()
    if (!user) return json({error:'Unauthorized'},401)
    const { data:profile } = await userClient.from('profiles').select('role,is_active').eq('id',user.id).single()
    if (!profile || !profile.is_active || !['admin','student'].includes(profile.role)) return json({error:'Access denied'},403)
    const admin = createClient(url,sec,{auth:{persistSession:false}})
    const body = await req.json()
    const action = text(body.action)

    if (action === 'admin_list') {
      if (profile.role !== 'admin') return json({error:'Admin access required'},403)
      const { data, error } = await admin.from('exam_scope_performance_sequenced').select('*').order('submitted_at',{ascending:true})
      if (error) return json({error:error.message},400)
      const enriched = await enrichRows(admin,data || [])
      return json({ok:true,rows:applyFilters(enriched,body.filters || {})})
    }

    if (action === 'student_list') {
      if (profile.role !== 'student') return json({error:'Student access required'},403)
      const { data, error } = await admin.from('exam_scope_performance_sequenced').select('*').eq('student_id',user.id).order('submitted_at',{ascending:true})
      if (error) return json({error:error.message},400)
      const attemptIds = uniq((data || []).map((r:any)=>r.attempt_id))
      let publishedResults:any[] = []
      if (attemptIds.length) {
        const r = await admin.from('exam_results').select('attempt_id,is_published').in('attempt_id',attemptIds).eq('is_published',true)
        if (r.error) return json({error:r.error.message},400)
        publishedResults = r.data || []
      }
      const published = new Set(publishedResults.map((r:any)=>text(r.attempt_id)))
      const visible = (data || []).filter((row:any)=>canReadPerformance({requesterRole:'student',requesterId:user.id,rowStudentId:row.student_id,resultPublished:published.has(text(row.attempt_id))}))
      const enriched = await enrichRows(admin,visible)
      return json({ok:true,rows:applyFilters(enriched,{subject:body.subject})})
    }

    if (action === 'rebuild_exam') {
      if (profile.role !== 'admin') return json({error:'Admin access required'},403)
      const examId = text(body.examId)
      if (!examId) return json({error:'Exam ID is required'},400)
      try {
        const rebuilt = await rebuildExam(admin,examId)
        return json({ok:true,...rebuilt})
      } catch (e:any) {
        return json({error:e?.message || 'Could not rebuild performance',validation:e?.validation || null},409)
      }
    }

    return json({error:'Unknown action'},400)
  } catch (e) {
    return json({error:e instanceof Error ? e.message : 'Performance operation failed'},400)
  }
})
