import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'
import { canAccessAudience } from './audience-policy.mjs'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
async function sha256(text: string) {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function assignmentFor(admin:any,examId:string,studentId:string){
  const {data}=await admin.from('exam_student_assignments').select('is_assigned,max_attempts').eq('exam_id',examId).eq('student_id',studentId).maybeSingle()
  return data||null
}
async function attemptAvailability(admin:any,examId:string,studentId:string,maxAttempts:number){
  const {data}=await admin.from('exam_attempts').select('status').eq('exam_id',examId).eq('student_id',studentId)
  const attempts=data||[]
  const inProgress=attempts.some((a:any)=>a.status==='in_progress')
  return {attempt_count:attempts.length,max_attempts:Math.max(1,Number(maxAttempts)||1),can_start:inProgress||attempts.length<Math.max(1,Number(maxAttempts)||1)}
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
    const studentClient = createClient(url, pub, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: { user }, error: userError } = await studentClient.auth.getUser()
    if (userError || !user) return json({ error: 'Student login required' }, 401)
    const { data: profile } = await studentClient.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!profile || profile.role !== 'student' || !profile.is_active) return json({ error: 'Student access required' }, 403)

    const admin = createClient(url, sec, { auth: { persistSession: false } })
    const body = await req.json()
    const action = String(body.action || 'verify')

    if(action==='list'){
      const {data:exams,error}=await admin.from('exams').select('id,title,subject,syllabus,duration_minutes,total_marks,negative_marking,status,is_published,audience_mode,created_at').eq('is_published',true).neq('status','completed').order('created_at',{ascending:false})
      if(error)return json({error:error.message},400)
      const visible=[]
      for(const exam of exams||[]){
        const assignment=await assignmentFor(admin,exam.id,user.id)
        if(!canAccessAudience(exam.audience_mode,assignment))continue
        const availability=await attemptAvailability(admin,exam.id,user.id,assignment?.max_attempts||1)
        visible.push({
          id:exam.id,title:exam.title,subject:exam.subject,syllabus:exam.syllabus,duration_minutes:exam.duration_minutes,total_marks:exam.total_marks,
          negative_marking:exam.negative_marking,status:exam.status,availability:availability.can_start?'active':'completed',can_start:availability.can_start,
          attempt_count:availability.attempt_count,max_attempts:availability.max_attempts
        })
      }
      return json({ok:true,exams:visible})
    }

    const examCode = String(body.examCode || '').trim().toUpperCase()
    const examPassword = String(body.examPassword || '')
    if (!examCode || !examPassword) return json({ error: 'Enter Exam Code and Password' }, 400)

    const { data: access } = await admin.from('exam_access').select('exam_id,password_hash').eq('exam_code', examCode).maybeSingle()
    if (!access) return json({ error: 'Invalid Exam Code or Password' }, 401)
    const incomingHash = await sha256(examPassword)
    if (incomingHash !== access.password_hash) return json({ error: 'Invalid Exam Code or Password' }, 401)

    const { data: exam } = await admin.from('exams').select('id,title,subject,syllabus,duration_minutes,total_marks,negative_marking,instructions,status,is_published,audience_mode').eq('id', access.exam_id).maybeSingle()
    if (!exam || !exam.is_published || exam.status === 'completed') return json({ error: 'This exam is not currently available' }, 403)
    const assignment=await assignmentFor(admin,exam.id,user.id)
    if(!canAccessAudience(exam.audience_mode,assignment))return json({error:'This exam is not assigned to you'},403)

    const availability=await attemptAvailability(admin,exam.id,user.id,assignment?.max_attempts||1)
    if(!availability.can_start)return json({error:'You have used all allowed attempts for this exam'},409)

    const { count: questionCount } = await admin.from('exam_questions').select('*', { count: 'exact', head: true }).eq('exam_id', exam.id)
    if (!questionCount) return json({ error: 'This exam has no questions yet' }, 409)

    return json({ ok: true, exam: {
      id: exam.id, title: exam.title, subject: exam.subject, syllabus: exam.syllabus,
      duration_minutes: exam.duration_minutes, total_marks: exam.total_marks,
      negative_marking: exam.negative_marking, instructions: exam.instructions,
      question_count: questionCount, can_start: true, availability: 'active',
      attempt_count:availability.attempt_count,max_attempts:availability.max_attempts
    }})
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unable to verify exam access. Please try again.' }, 400)
  }
})
