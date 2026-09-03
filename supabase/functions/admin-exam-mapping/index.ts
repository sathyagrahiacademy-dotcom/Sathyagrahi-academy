import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { suggestSubtopics } from './subtopic-suggestions.mjs'
import { normalizeAdminMappingAction } from './admin-mapping-action.mjs'
import { parseQuestionSelector, buildQuestionMappings, validateExamMapping } from '../_shared/exam-mapping-logic.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function ensureDraftExam(admin: any, examId: string) {
  const { data: exam, error } = await admin.from('exams').select('id,subject,total_marks,is_published,status').eq('id', examId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!exam) throw new Error('Exam not found')
  if (exam.is_published) throw new Error('Unpublish this exam before changing syllabus mapping')
  const { count, error: pErr } = await admin.from('exam_scope_performance').select('id', { count: 'exact', head: true }).eq('exam_id', examId)
  if (pErr) throw new Error(pErr.message)
  if (Number(count || 0) > 0) throw new Error('This exam already has syllabus performance. Rebuild workflow is required before changing its mapping.')
  return exam
}

async function loadValidation(admin: any, examId: string) {
  const { data: exam, error: examErr } = await admin.from('exams').select('id,subject,total_marks,is_published,status').eq('id', examId).maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!exam) throw new Error('Exam not found')

  const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,exam_id,question_no,marks').eq('exam_id', examId).order('question_no')
  if (qErr) throw new Error(qErr.message)
  const questionIds = (questions || []).map((q: any) => q.id)

  let answerKeys: any[] = []
  if (questionIds.length) {
    const r = await admin.from('exam_answer_keys').select('question_id,correct_option').in('question_id', questionIds)
    if (r.error) throw new Error(r.error.message)
    answerKeys = r.data || []
  }

  const { data: mappingRowsRaw, error: mErr } = await admin.from('exam_question_syllabus_map').select('question_id,exam_id,mapping_group_id,subtopic_id').eq('exam_id', examId)
  if (mErr) throw new Error(mErr.message)
  const questionNo = new Map((questions || []).map((q: any) => [String(q.id), q.question_no]))
  const mappingRows = (mappingRowsRaw || []).map((r: any) => ({ ...r, question_no: questionNo.get(String(r.question_id)) }))

  const { data: approvedRows, error: sErr } = await admin.from('neet_syllabus_subtopics').select('id').eq('status', 'approved')
  if (sErr) throw new Error(sErr.message)

  const validation = validateExamMapping({
    questions: questions || [],
    answerKeys,
    mappingRows,
    approvedSubtopicIds: (approvedRows || []).map((s: any) => s.id),
    totalMarks: exam.total_marks
  })
  return { exam, questions: questions || [], answerKeys, mappingRows, validation }
}

async function loadTree(admin: any, examId: string) {
  const core = await loadValidation(admin, examId)
  let unitQuery = admin.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('sort_order')
  if (['Physics','Chemistry','Biology'].includes(String(core.exam.subject))) unitQuery = unitQuery.eq('subject', core.exam.subject)
  const { data: units, error: uErr } = await unitQuery
  if (uErr) throw new Error(uErr.message)
  const unitIds = (units || []).map((u: any) => u.id)

  let chapters: any[] = []
  if (unitIds.length) {
    const r = await admin.from('neet_syllabus_topics').select('id,unit_id,topic_title,official_detail,sort_order').in('unit_id', unitIds).order('sort_order')
    if (r.error) throw new Error(r.error.message)
    chapters = r.data || []
  }
  const chapterIds = chapters.map((c: any) => c.id)

  let subtopics: any[] = []
  if (chapterIds.length) {
    const r = await admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,sort_order,status,source').in('chapter_id', chapterIds).order('sort_order')
    if (r.error) throw new Error(r.error.message)
    subtopics = r.data || []
  }

  const { data: groups, error: gErr } = await admin.from('exam_mapping_groups').select('id,exam_id,subtopic_id,coverage,selector_text,sort_order,created_at,updated_at').eq('exam_id', examId).order('sort_order')
  if (gErr) throw new Error(gErr.message)

  const syllabus = (units || []).map((unit: any) => ({
    ...unit,
    chapters: chapters.filter((c: any) => String(c.unit_id) === String(unit.id)).map((chapter: any) => ({
      ...chapter,
      subtopics: subtopics.filter((s: any) => String(s.chapter_id) === String(chapter.id))
    }))
  }))

  return { ...core, groups: groups || [], syllabus }
}

async function assertSubtopicsCanChange(admin: any, subtopicIds: string[]) {
  if (!subtopicIds.length) return
  const { data: groups, error } = await admin.from('exam_mapping_groups').select('exam_id').in('subtopic_id', subtopicIds)
  if (error) throw new Error(error.message)
  const examIds = [...new Set((groups || []).map((g: any) => String(g.exam_id)))]
  if (!examIds.length) return

  const { data: exams, error: eErr } = await admin.from('exams').select('id,is_published').in('id', examIds)
  if (eErr) throw new Error(eErr.message)
  if ((exams || []).some((e: any) => e.is_published)) throw new Error('A mapped subtopic cannot be changed while a linked exam is published')

  const { count, error: pErr } = await admin.from('exam_scope_performance').select('id', { count: 'exact', head: true }).in('exam_id', examIds)
  if (pErr) throw new Error(pErr.message)
  if (Number(count || 0) > 0) throw new Error('A mapped subtopic with generated performance cannot be changed directly')
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
    const rawBody = await req.json()
    const normalized = normalizeAdminMappingAction(rawBody)
    if (!normalized.ok) return json({ error: normalized.error || 'Invalid request' }, 400)
    const command: any = normalized.command

    if (command.action === 'tree') {
      const data = await loadTree(admin, command.examId)
      return json({ ok: true, ...data })
    }

    if (command.action === 'validate') {
      const data = await loadValidation(admin, command.examId)
      return json({ ok: true, validation: data.validation })
    }

    if (command.action === 'generate_subtopics') {
      const { data: chapter, error } = await admin.from('neet_syllabus_topics').select('id,official_detail').eq('id', command.chapterId).maybeSingle()
      if (error) return json({ error: error.message }, 400)
      if (!chapter) return json({ error: 'Chapter not found' }, 404)
      const suggestions = suggestSubtopics(chapter.official_detail)
      const { data: existing, error: exErr } = await admin.from('neet_syllabus_subtopics').select('id,subtopic_title,sort_order,status,source').eq('chapter_id', command.chapterId).order('sort_order')
      if (exErr) return json({ error: exErr.message }, 400)
      const known = new Set((existing || []).map((s: any) => String(s.subtopic_title || '').trim().toLowerCase()))
      const missing = suggestions.filter(title => !known.has(title.toLowerCase()))
      if (missing.length) {
        const start = (existing || []).reduce((m: number, s: any) => Math.max(m, Number(s.sort_order || 0)), 0)
        const rows = missing.map((title, i) => ({ chapter_id: command.chapterId, subtopic_title: title, sort_order: start + i + 1, status: 'suggested', source: 'auto' }))
        const ins = await admin.from('neet_syllabus_subtopics').insert(rows)
        if (ins.error) return json({ error: ins.error.message }, 400)
      }
      const { data: allRows, error: allErr } = await admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title,sort_order,status,source').eq('chapter_id', command.chapterId).order('sort_order')
      if (allErr) return json({ error: allErr.message }, 400)
      return json({ ok: true, created: missing.length, subtopics: allRows || [] })
    }

    if (command.action === 'upsert_subtopic') {
      if (command.subtopicId) await assertSubtopicsCanChange(admin, [String(command.subtopicId)])
      if (command.subtopicId) {
        const { data: current } = await admin.from('neet_syllabus_subtopics').select('id,chapter_id').eq('id', command.subtopicId).maybeSingle()
        if (!current || Number(current.chapter_id) !== Number(command.chapterId)) return json({ error: 'Subtopic does not belong to this chapter' }, 400)
        const { error } = await admin.from('neet_syllabus_subtopics').update({ subtopic_title: command.title, status: command.status, source: 'admin', updated_at: new Date().toISOString() }).eq('id', command.subtopicId)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true, subtopicId: command.subtopicId })
      }
      const { data: rows } = await admin.from('neet_syllabus_subtopics').select('sort_order').eq('chapter_id', command.chapterId).order('sort_order', { ascending: false }).limit(1)
      const sortOrder = Number(rows?.[0]?.sort_order || 0) + 1
      const { data, error } = await admin.from('neet_syllabus_subtopics').insert({ chapter_id: command.chapterId, subtopic_title: command.title, sort_order: sortOrder, status: command.status, source: 'admin' }).select('id').single()
      if (error || !data) return json({ error: error?.message || 'Could not create subtopic' }, 400)
      return json({ ok: true, subtopicId: data.id })
    }

    if (command.action === 'disable_subtopic') {
      await assertSubtopicsCanChange(admin, [String(command.subtopicId)])
      const [{ count: groupCount, error: gErr }, { count: mapCount, error: mErr }] = await Promise.all([
        admin.from('exam_mapping_groups').select('id', { count: 'exact', head: true }).eq('subtopic_id', command.subtopicId),
        admin.from('exam_question_syllabus_map').select('question_id', { count: 'exact', head: true }).eq('subtopic_id', command.subtopicId)
      ])
      if (gErr || mErr) return json({ error: gErr?.message || mErr?.message }, 400)
      if (Number(groupCount || 0) > 0 || Number(mapCount || 0) > 0) return json({ error: 'Mapped subtopic cannot be disabled. Merge it or remove its draft mappings first.' }, 409)
      const { error } = await admin.from('neet_syllabus_subtopics').update({ status: 'disabled', updated_at: new Date().toISOString() }).eq('id', command.subtopicId)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (command.action === 'split_subtopic') {
      await assertSubtopicsCanChange(admin, [String(command.subtopicId)])
      const { data, error } = await admin.rpc('split_exam_subtopic', { p_subtopic_id: command.subtopicId, p_titles: command.titles, p_created_by: user.id })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, subtopicIds: data || [] })
    }

    if (command.action === 'merge_subtopics') {
      await assertSubtopicsCanChange(admin, command.subtopicIds)
      const { data, error } = await admin.rpc('merge_exam_subtopics', { p_chapter_id: command.chapterId, p_subtopic_ids: command.subtopicIds.map((x: string) => Number(x)), p_title: command.title, p_created_by: user.id })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, subtopicId: data })
    }

    if (command.action === 'save_mapping') {
      await ensureDraftExam(admin, command.examId)
      const parsed = parseQuestionSelector(command.selector)
      if (!parsed.ok) return json({ error: parsed.error }, 400)
      const { data: subtopic } = await admin.from('neet_syllabus_subtopics').select('id,status').eq('id', command.subtopicId).maybeSingle()
      if (!subtopic || subtopic.status !== 'approved') return json({ error: 'Only approved subtopics can be mapped' }, 400)
      const { data: questions, error: qErr } = await admin.from('exam_questions').select('id,question_no').eq('exam_id', command.examId)
      if (qErr) return json({ error: qErr.message }, 400)
      const questionByNo = new Map((questions || []).map((q: any) => [Number(q.question_no), q]))
      const built = buildQuestionMappings({ selector: command.selector, questionByNo, mappingGroupId: command.mappingGroupId || 'pending', examId: command.examId, subtopicId: command.subtopicId })
      if (!built.ok) return json({ error: built.error }, 400)
      const { data: groupId, error } = await admin.rpc('replace_exam_mapping_group', {
        p_exam_id: command.examId,
        p_mapping_group_id: command.mappingGroupId,
        p_subtopic_id: command.subtopicId,
        p_coverage: command.coverage,
        p_selector_text: built.normalized,
        p_sort_order: 0,
        p_created_by: user.id,
        p_question_ids: built.rows.map((r: any) => r.question_id)
      })
      if (error) return json({ error: error.message }, 409)
      const validation = await loadValidation(admin, command.examId)
      return json({ ok: true, mappingGroupId: groupId, selector: built.normalized, validation: validation.validation })
    }

    if (command.action === 'delete_mapping') {
      await ensureDraftExam(admin, command.examId)
      const { error } = await admin.from('exam_mapping_groups').delete().eq('id', command.mappingGroupId).eq('exam_id', command.examId)
      if (error) return json({ error: error.message }, 400)
      const validation = await loadValidation(admin, command.examId)
      return json({ ok: true, validation: validation.validation })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Exam mapping operation failed' }, 400)
  }
})
