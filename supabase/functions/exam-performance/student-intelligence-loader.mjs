import { buildPerformanceIntelligence } from './performance-intelligence.mjs'

const text=v=>String(v??'').trim()
const uniq=values=>[...new Set((values||[]).map(v=>text(v)).filter(Boolean))]

export async function loadStudentIntelligence(admin,studentId){
  const attemptRes=await admin.from('exam_attempts')
    .select('id,exam_id,submitted_at,status')
    .eq('student_id',studentId)
    .in('status',['submitted','auto_submitted','graded'])
    .order('submitted_at',{ascending:true})
  if(attemptRes.error)throw new Error(attemptRes.error.message)
  const attempts=attemptRes.data||[]
  const attemptIds=attempts.map(a=>a.id)

  let publishedResults=[]
  if(attemptIds.length){
    const r=await admin.from('exam_results').select('attempt_id,is_published').in('attempt_id',attemptIds).eq('is_published',true)
    if(r.error)throw new Error(r.error.message)
    publishedResults=r.data||[]
  }
  const publishedAttemptIds=new Set(publishedResults.map(r=>text(r.attempt_id)))
  const publishedAttempts=attempts.filter(a=>publishedAttemptIds.has(text(a.id)))
  const examIds=uniq(publishedAttempts.map(a=>a.exam_id))

  const bankRes=await admin.from('question_bank_questions')
    .select('id,subject,subtopic_id,difficulty,is_active')
    .eq('is_active',true)
  if(bankRes.error)throw new Error(bankRes.error.message)
  const activeBank=bankRes.data||[]

  let questions=[],mappings=[],responses=[],keys=[],activity=[]
  if(examIds.length){
    const q=await admin.from('exam_questions').select('id,exam_id,bank_question_id,difficulty').in('exam_id',examIds)
    if(q.error)throw new Error(q.error.message)
    questions=q.data||[]
    const questionIds=questions.map(row=>row.id)
    const pubIds=[...publishedAttemptIds]
    if(questionIds.length){
      const [m,resp,key,act]=await Promise.all([
        admin.from('exam_question_syllabus_map').select('question_id,subtopic_id').in('question_id',questionIds),
        pubIds.length?admin.from('exam_responses').select('attempt_id,question_id,selected_option').in('attempt_id',pubIds).in('question_id',questionIds):Promise.resolve({data:[],error:null}),
        admin.from('exam_answer_keys').select('question_id,correct_option').in('question_id',questionIds),
        pubIds.length?admin.from('exam_question_activity').select('attempt_id,question_id,active_seconds').in('attempt_id',pubIds).in('question_id',questionIds):Promise.resolve({data:[],error:null})
      ])
      const err=m.error||resp.error||key.error||act.error
      if(err)throw new Error(err.message)
      mappings=m.data||[];responses=resp.data||[];keys=key.data||[];activity=act.data||[]
    }
  }

  const allSubtopicIds=uniq([...activeBank.map(q=>q.subtopic_id),...mappings.map(m=>m.subtopic_id)])
  let subtopics=[],chapters=[],units=[]
  if(allSubtopicIds.length){
    const s=await admin.from('neet_syllabus_subtopics').select('id,chapter_id,subtopic_title').in('id',allSubtopicIds)
    if(s.error)throw new Error(s.error.message)
    subtopics=s.data||[]
    const chapterIds=uniq(subtopics.map(s=>s.chapter_id))
    if(chapterIds.length){
      const ch=await admin.from('neet_syllabus_topics').select('id,unit_id').in('id',chapterIds)
      if(ch.error)throw new Error(ch.error.message)
      chapters=ch.data||[]
      const unitIds=uniq(chapters.map(ch=>ch.unit_id))
      if(unitIds.length){
        const un=await admin.from('neet_syllabus_units').select('id,subject').in('id',unitIds)
        if(un.error)throw new Error(un.error.message)
        units=un.data||[]
      }
    }
  }

  const subtopicById=new Map(subtopics.map(s=>[text(s.id),s]))
  const chapterById=new Map(chapters.map(ch=>[text(ch.id),ch]))
  const unitById=new Map(units.map(u=>[text(u.id),u]))
  const bankById=new Map(activeBank.map(q=>[text(q.id),q]))
  const mappingByQuestion=new Map()
  for(const m of mappings)if(!mappingByQuestion.has(text(m.question_id)))mappingByQuestion.set(text(m.question_id),m)
  const responseByAttemptQuestion=new Map(responses.map(r=>[`${text(r.attempt_id)}|${text(r.question_id)}`,r]))
  const keyByQuestion=new Map(keys.map(k=>[text(k.question_id),k]))
  const activityByAttemptQuestion=new Map(activity.map(a=>[`${text(a.attempt_id)}|${text(a.question_id)}`,a]))
  const questionsByExam=new Map()
  for(const q of questions){const examId=text(q.exam_id);if(!questionsByExam.has(examId))questionsByExam.set(examId,[]);questionsByExam.get(examId).push(q)}

  function subtopicSubject(subtopicId){
    const sub=subtopicById.get(text(subtopicId));const chapter=chapterById.get(text(sub?.chapter_id));const unit=unitById.get(text(chapter?.unit_id));return text(unit?.subject)||'Unknown'
  }
  function subtopicTitle(subtopicId){return text(subtopicById.get(text(subtopicId))?.subtopic_title)||text(subtopicId)||'Unmapped'}

  const bankQuestions=activeBank.map(q=>({...q,topicTitle:subtopicTitle(q.subtopic_id)}))
  const events=[]
  for(const attempt of publishedAttempts){
    for(const q of questionsByExam.get(text(attempt.exam_id))||[]){
      const bank=bankById.get(text(q.bank_question_id))
      const mapping=mappingByQuestion.get(text(q.id))
      const subtopicId=text(mapping?.subtopic_id)||text(bank?.subtopic_id)
      const response=responseByAttemptQuestion.get(`${text(attempt.id)}|${text(q.id)}`)
      const key=keyByQuestion.get(text(q.id))
      const act=activityByAttemptQuestion.get(`${text(attempt.id)}|${text(q.id)}`)
      const selected=text(response?.selected_option).toUpperCase()
      const correct=text(key?.correct_option).toUpperCase()
      events.push({
        bankQuestionId:text(q.bank_question_id)||null,
        subtopicId:subtopicId||'unmapped',
        topicTitle:subtopicTitle(subtopicId),
        subject:text(bank?.subject)||subtopicSubject(subtopicId),
        difficulty:text(q.difficulty)||text(bank?.difficulty)||'Medium',
        attemptId:text(attempt.id),
        submittedAt:text(attempt.submitted_at),
        isAttempted:Boolean(selected),
        isCorrect:Boolean(selected&&correct&&selected===correct),
        activeSeconds:Number(act?.active_seconds||0)
      })
    }
  }

  return buildPerformanceIntelligence({bankQuestions,events})
}
