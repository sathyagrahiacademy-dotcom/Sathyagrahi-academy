import { SENDERS } from './communication-policy.mjs'

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[ch]))
const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function dateLabel(value){
  const raw=text(value)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||'Today'
  const [y,m,d]=raw.split('-').map(Number)
  if(!months[m-1]||d<1||d>31)return raw
  return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`
}

function page(title,body,siteUrl){
  const url=esc(siteUrl||'https://sathyagrahiacademy.com')
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#173653"><div style="max-width:640px;margin:0 auto;padding:24px"><div style="background:#123b68;color:white;padding:18px 22px;border-radius:12px 12px 0 0"><b style="font-size:18px">Sathyagrahi Academy</b><div style="font-size:12px;opacity:.85;margin-top:4px">${esc(title)}</div></div><div style="background:white;border:1px solid #dfe7ef;border-top:0;padding:22px;border-radius:0 0 12px 12px">${body}<div style="margin-top:20px;padding-top:15px;border-top:1px solid #edf1f5;font-size:12px;color:#607286">Full details: <a href="${url}" style="color:#123b68">${url}</a></div></div></div></body></html>`
}

function taskLine(task){
  const parts=[task.subject,task.chapter,task.topic].map(text).filter(Boolean)
  const meta=[task.task_type,Number(task.target_minutes)>0?`${Number(task.target_minutes)} min`:'',task.priority?`${task.priority} priority`:''].filter(Boolean)
  return `${parts.join(' — ')}${meta.length?` (${meta.join(' · ')})`:''}`
}

function topicOf(item){return text(item?.topic||item?.topicTitle||item?.reason)}
function firstTopics(items,limit=2){return list(items).map(topicOf).filter(Boolean).slice(0,limit)}
function uniqueStudyLines(rows){
  const seen=new Set(),out=[]
  for(const row of list(rows)){
    const value=[row.subject,row.chapter,row.topic].map(text).filter(Boolean).join(' — ')
    if(value&&!seen.has(value)){seen.add(value);out.push(value)}
  }
  return out
}

export function buildMorningMessage({student={},date,tasks=[],siteUrl}={}){
  const name=text(student.full_name)||'Student'
  const day=dateLabel(date)
  const lines=list(tasks).map(taskLine).filter(Boolean)
  const summary=lines.length?lines.join('; '):'No study tasks are assigned for today.'
  const body=`<p style="margin-top:0">Good morning <b>${esc(name)}</b>.</p><p>Here is your study plan for <b>${esc(day)}</b>.</p>${lines.length?`<ul style="line-height:1.7">${lines.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>No study tasks are assigned for today.</p>'}<p style="font-size:13px;color:#52677d">Complete the assigned work and update your study session in the Academy portal.</p>`
  return {
    from:SENDERS.morning_plan,
    senderName:'Sathyagrahi Academy',
    subject:`Today’s Study Plan — ${day}`,
    html:page('Morning Study Plan',body,siteUrl),
    text:`${name} — ${day}\n${summary}`,
    whatsappValues:[name,day,summary,text(siteUrl)||'https://sathyagrahiacademy.com']
  }
}

export function buildExamMessage({student={},exam={},examCode,scopeSummary,siteUrl}={}){
  const name=text(student.full_name)||'Student'
  const title=text(exam.title)||'Academy Exam'
  const day=dateLabel(exam.exam_date)
  const code=text(examCode)||'—'
  const duration=Number(exam.duration_minutes)||0
  const marks=Number(exam.total_marks)||0
  const scope=text(scopeSummary||exam.syllabus)||text(exam.subject)||'NEET'
  const body=`<p style="margin-top:0">Hello <b>${esc(name)}</b>,</p><p>Your Academy exam has been published.</p><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:7px 0;color:#64758a">Exam</td><td style="padding:7px 0"><b>${esc(title)}</b></td></tr><tr><td style="padding:7px 0;color:#64758a">Date</td><td>${esc(day)}</td></tr><tr><td style="padding:7px 0;color:#64758a">Code</td><td><b>${esc(code)}</b></td></tr><tr><td style="padding:7px 0;color:#64758a">Duration</td><td>${duration} min</td></tr><tr><td style="padding:7px 0;color:#64758a">Marks</td><td>${marks}</td></tr><tr><td style="padding:7px 0;color:#64758a">Scope</td><td>${esc(scope)}</td></tr></table>`
  return {
    from:SENDERS.exam_published,
    senderName:'Sathyagrahi Academy – Examinations',
    subject:`Exam Published — ${title}`,
    html:page('Examination Notice',body,siteUrl),
    text:`${name}: ${title} | ${day} | ${code} | ${duration} min | ${marks} marks | ${scope}`,
    whatsappValues:[name,title,day,code,`${duration} min`,`${marks}`,scope,text(siteUrl)||'https://sathyagrahiacademy.com']
  }
}

export function buildResultMessage({student={},date,exam={},result={},studySessions=[],intelligence={},siteUrl}={}){
  const name=text(student.full_name)||'Student'
  const day=dateLabel(date)
  const title=text(exam.title)||'Academy Exam'
  const score=Number(result.total_score)||0
  const max=Number(exam.total_marks)||0
  const percentage=Number(result.percentage)||0
  const correct=Number(result.correct_count)||0
  const wrong=Number(result.wrong_count)||0
  const unattempted=Number(result.unattempted_count)||0
  const studied=uniqueStudyLines(studySessions)
  const mentor=intelligence?.mentor||{}
  const strengths=firstTopics(mentor.strengths)
  const weaknesses=firstTopics(mentor.priorityWeaknesses)
  const revision=weaknesses.length?weaknesses:firstTopics(mentor.retentionWatch).concat(firstTopics(mentor.coverageGaps)).slice(0,2)
  const nextFocus=firstTopics(mentor.nextExamFocus,3)
  const evidenceFallback='Evidence is still building — continue today’s planned study and practice.'
  const studiedText=studied.length?studied.join('; '):'No study session was recorded for this date.'
  const strongText=strengths.length?strengths.join(', '):evidenceFallback
  const reviseText=revision.length?revision.join(', '):evidenceFallback
  const nextText=nextFocus.length?nextFocus.join(', '):evidenceFallback
  const section=(label,value)=>`<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:#6b7c90;text-transform:uppercase">${esc(label)}</div><div style="margin-top:4px;line-height:1.55">${esc(value)}</div></div>`
  const body=`<p style="margin-top:0">Hello <b>${esc(name)}</b>,</p><p>Here is your Daily Performance summary for <b>${esc(day)}</b>.</p><div style="background:#f5f9fd;border:1px solid #dce7f1;border-radius:10px;padding:14px"><b>${esc(title)}</b><div style="font-size:22px;color:#123b68;margin-top:8px"><b>${score}${max?` / ${max}`:''}</b></div><div style="font-size:12px;margin-top:5px">${percentage.toFixed(2)}% · Correct ${correct} · Wrong ${wrong} · Unattempted ${unattempted}</div></div>${section('Today Studied',studiedText)}${section('Strong Areas',strongText)}${section('Needs Revision',reviseText)}${section('Next Focus',nextText)}`
  return {
    from:SENDERS.result_published,
    senderName:'Sathyagrahi Academy – Results',
    subject:`Daily Performance — ${title}`,
    html:page('Result & Daily Performance',body,siteUrl),
    text:`${name} — ${title}: ${score}/${max} (${percentage.toFixed(2)}%). Today Studied: ${studiedText}. Revise: ${reviseText}. Next: ${nextText}`,
    whatsappValues:[name,title,`${score}/${max}`,`${percentage.toFixed(2)}%`,studiedText,reviseText,nextText,text(siteUrl)||'https://sathyagrahiacademy.com']
  }
}
