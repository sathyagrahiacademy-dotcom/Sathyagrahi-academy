import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { validateSnapshotCoverage } from './sync-logic.mjs'
import { decideAttempt } from './attempt-policy.mjs'

const FINAL_SYNC_GRACE_MS = 15_000

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function gradeAttempt(admin: any, attempt: any, isAuto: boolean) {
  const { data: exam } = await admin.from('exams').select('duration_minutes,total_marks').eq('id', attempt.exam_id).single()
  const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,marks,negative_marks').eq('exam_id', attempt.exam_id)
  if (qErr || !questions?.length) throw new Error('No questions found for this exam')

  const ids = questions.map((q: any) => q.id)
  const [{ data: keys }, { data: responses }] = await Promise.all([
    admin.from('exam_answer_keys').select('question_id,correct_option').in('question_id', ids),
    admin.from('exam_responses').select('question_id,selected_option').eq('attempt_id', attempt.id)
  ])

  const keyMap = new Map((keys || []).map((k: any) => [k.question_id, k.correct_option]))
  const resMap = new Map((responses || []).map((r: any) => [r.question_id, r.selected_option]))
  let score = 0, correct = 0, wrong = 0, unattempted = 0

  for (const q of questions) {
    const selected = resMap.get(q.id)
    if (!selected) { unattempted++; continue }
    if (selected === keyMap.get(q.id)) { correct++; score += Number(q.marks || 0) }
    else { wrong++; score -= Number(q.negative_marks || 0) }
  }

  const maxMarks = Number(exam?.total_marks || 0)
  const percentage = maxMarks > 0 ? (score / maxMarks) * 100 : 0
  const status = isAuto ? 'auto_submitted' : 'submitted'
  const submittedAt = new Date().toISOString()

  const { error: aErr } = await admin.from('exam_attempts').update({ status, submitted_at: submittedAt }).eq('id', attempt.id)
  if (aErr) throw new Error(aErr.message)

  const summary = { total_score: score, correct_count: correct, wrong_count: wrong, unattempted_count: unattempted, percentage }
  const { error: rErr } = await admin.from('exam_results').upsert({
    attempt_id: attempt.id,
    ...summary,
    is_published: false,
    graded_at: submittedAt
  })
  if (rErr) throw new Error(rErr.message)

  return { status, summary }
}

async function syncCompleteSnapshot(admin: any, attempt: any, snapshot: unknown) {
  const { data: questions, error: qErr } = await admin.from('exam_questions').select('id').eq('exam_id', attempt.exam_id).order('question_no')
  if (qErr || !questions?.length) return { ok: false, error: 'No questions found for this exam' }

  const ids = questions.map((q: any) => String(q.id))
  const validation = validateSnapshotCoverage(ids, snapshot)
  if (!validation.ok) return { ok: false, error: validation.error }

  const savedAt = new Date().toISOString()
  const rows = validation.rows.map((r: any) => ({
    attempt_id: attempt.id,
    question_id: r.question_id,
    selected_option: r.selected_option,
    marked_for_review: r.marked_for_review,
    saved_at: savedAt
  }))
  const { error: upsertErr } = await admin.from('exam_responses').upsert(rows, { onConflict: 'attempt_id,question_id' })
  if (upsertErr) return { ok: false, error: upsertErr.message }

  const { count, error: countErr } = await admin.from('exam_responses').select('question_id', { count: 'exact', head: true }).eq('attempt_id', attempt.id)
  if (countErr) return { ok: false, error: countErr.message }
  if (Number(count || 0) !== ids.length) return { ok: false, error: 'Answer synchronization could not be verified. Please retry submission.' }
  return { ok: true }
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
    if (!user) return json({ error: 'Student login required' }, 401)
    const { data: profile } = await userClient.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!profile || profile.role !== 'student' || !profile.is_active) return json({ error: 'Student access required' }, 403)

    const admin = createClient(url, sec, { auth: { persistSession: false } })
    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'start') {
      const examId = String(body.examId || '')
      const { data: exam } = await admin.from('exams').select('id,title,subject,syllabus,duration_minutes,total_marks,negative_marking,instructions,is_published,status,audience_mode').eq('id', examId).maybeSingle()
      if (!exam || !exam.is_published || exam.status === 'completed') return json({ error: 'This exam is not currently available' }, 403)

      let { data: assignment } = await admin.from('exam_student_assignments').select('student_id,is_assigned,max_attempts').eq('exam_id',examId).eq('student_id',user.id).maybeSingle()
      if (exam.audience_mode === 'selected' && !assignment?.is_assigned) return json({ error:'This exam is not assigned to you' },403)
      if (exam.audience_mode === 'all' && (!assignment || !assignment.is_assigned)) {
        const res = await admin.from('exam_student_assignments').upsert({exam_id:examId,student_id:user.id,is_assigned:true,max_attempts:Math.max(1,Number(assignment?.max_attempts)||1),updated_at:new Date().toISOString()},{onConflict:'exam_id,student_id'}).select('student_id,is_assigned,max_attempts').single()
        if (res.error || !res.data) return json({error:res.error?.message||'Could not prepare exam access'},400)
        assignment = res.data
      }

      const { data: attempts, error: attemptsErr } = await admin.from('exam_attempts').select('id,student_id,exam_id,attempt_no,started_at,submitted_at,status').eq('exam_id',examId).eq('student_id',user.id).order('attempt_no')
      if (attemptsErr) return json({error:attemptsErr.message},400)
      const decision = decideAttempt(attempts || [], Number(assignment?.max_attempts || 1))
      if (decision.action === 'block') return json({error:'You have used all allowed attempts for this exam'},409)

      let attempt:any = decision.action === 'resume' ? decision.attempt : null
      if (decision.action === 'create') {
        const res = await admin.from('exam_attempts').insert({ exam_id: examId, student_id: user.id, attempt_no:decision.attemptNo, status: 'in_progress' }).select('id,student_id,exam_id,attempt_no,started_at,submitted_at,status').single()
        if (res.error || !res.data) return json({ error: res.error?.message || 'Could not start exam' }, 400)
        attempt = res.data
      }

      const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,question_no,question_text,option_a,option_b,option_c,option_d,marks,negative_marks').eq('exam_id', examId).order('question_no')
      if (qErr || !questions?.length) return json({ error: 'No questions found for this exam' }, 409)
      const { data: responses } = await admin.from('exam_responses').select('question_id,selected_option,marked_for_review,saved_at').eq('attempt_id', attempt.id)

      const startedAt = new Date(attempt.started_at).getTime()
      const durationMs = Number(exam.duration_minutes) * 60_000
      const endsAt = startedAt + durationMs
      if (Date.now() >= endsAt) {
        await gradeAttempt(admin, attempt, true)
        return json({ error: 'Time is over. This exam has been auto-submitted.' }, 409)
      }

      return json({ ok: true, exam, attempt, ends_at: new Date(endsAt).toISOString(), questions, responses: responses || [] })
    }

    if (action === 'save') {
      const attemptId = String(body.attemptId || '')
      const questionId = String(body.questionId || '')
      const selectedOption = body.selectedOption == null || body.selectedOption === '' ? null : String(body.selectedOption).toUpperCase()
      const marked = Boolean(body.markedForReview)
      if (selectedOption !== null && !['A','B','C','D'].includes(selectedOption)) return json({ error: 'Invalid selected option' }, 400)

      const { data: attempt } = await admin.from('exam_attempts').select('id,student_id,exam_id,started_at,status').eq('id', attemptId).maybeSingle()
      if (!attempt || attempt.student_id !== user.id || attempt.status !== 'in_progress') return json({ error: 'Exam attempt is not active' }, 409)
      const { data: exam } = await admin.from('exams').select('duration_minutes').eq('id', attempt.exam_id).single()
      const endsAt = new Date(attempt.started_at).getTime() + Number(exam?.duration_minutes || 0) * 60_000
      if (Date.now() >= endsAt) return json({ error: 'Time is over' }, 409)
      const { data: q } = await admin.from('exam_questions').select('id').eq('id', questionId).eq('exam_id', attempt.exam_id).maybeSingle()
      if (!q) return json({ error: 'Question not found' }, 404)

      const { error } = await admin.from('exam_responses').upsert({ attempt_id: attemptId, question_id: questionId, selected_option: selectedOption, marked_for_review: marked, saved_at: new Date().toISOString() }, { onConflict: 'attempt_id,question_id' })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'submit') {
      const attemptId = String(body.attemptId || '')
      const auto = Boolean(body.auto)
      const { data: attempt } = await admin.from('exam_attempts').select('id,student_id,exam_id,started_at,status').eq('id', attemptId).maybeSingle()
      if (!attempt || attempt.student_id !== user.id) return json({ error: 'Attempt not found' }, 404)

      if (attempt.status !== 'in_progress') {
        const { data: existing } = await admin.from('exam_results').select('total_score,correct_count,wrong_count,unattempted_count,percentage').eq('attempt_id', attempt.id).maybeSingle()
        if (existing) return json({ ok: true, already_submitted: true, status: attempt.status, summary: existing })
        if (attempt.status === 'auto_submitted') {
          const graded = await gradeAttempt(admin, attempt, true)
          return json({ ok: true, already_submitted: true, ...graded })
        }
        return json({ ok: true, already_submitted: true, status: attempt.status })
      }

      const { data: exam } = await admin.from('exams').select('duration_minutes').eq('id', attempt.exam_id).single()
      const endsAt = new Date(attempt.started_at).getTime() + Number(exam?.duration_minutes || 0) * 60_000
      const now = Date.now()
      const isAuto = auto || now >= endsAt
      const mayTrustFinalSnapshot = now <= endsAt + FINAL_SYNC_GRACE_MS

      if (mayTrustFinalSnapshot) {
        const synced = await syncCompleteSnapshot(admin, attempt, body.responses)
        if (!synced.ok) return json({ error: synced.error || 'Answer synchronization failed' }, 409)
      }

      const graded = await gradeAttempt(admin, attempt, isAuto)
      return json({ ok: true, ...graded })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Exam operation failed' }, 400)
  }
})
