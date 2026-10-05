const text=value=>String(value??'').trim()
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function dateLabel(value){
  const raw=text(value)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||'Today'
  const [y,m,d]=raw.split('-').map(Number)
  return `${String(d).padStart(2,'0')} ${months[m-1]||String(m).padStart(2,'0')} ${y}`
}

function page(title,body,siteUrl){
  const url=esc(siteUrl||'https://sathyagrahiacademy.com')
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#173653"><div style="max-width:680px;margin:0 auto;padding:24px"><div style="background:#123b68;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><b style="font-size:18px">Sathyagrahi Academy</b><div style="font-size:12px;opacity:.86;margin-top:4px">${esc(title)}</div></div><div style="background:#fff;border:1px solid #dfe7ef;border-top:0;padding:22px;border-radius:0 0 12px 12px">${body}<div style="margin-top:20px;padding-top:15px;border-top:1px solid #edf1f5;font-size:12px;color:#607286">Student Portal: <a href="${url}" style="color:#123b68">${url}</a></div></div></div></body></html>`
}

function performanceTable(rows=[]){
  if(!Array.isArray(rows)||!rows.length)return '<p style="color:#607286;font-size:13px">Detailed subject performance is not available for this exam.</p>'
  const body=rows.map(row=>`<tr><td style="padding:8px;border-bottom:1px solid #edf1f5"><b>${esc(row.subject)}</b></td><td style="padding:8px;border-bottom:1px solid #edf1f5;text-align:center">${Number(row.earned_marks)||0} / ${Number(row.max_marks)||0}</td><td style="padding:8px;border-bottom:1px solid #edf1f5;text-align:right">${Number(row.percentage||0).toFixed(2)}%</td></tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><thead><tr><th style="padding:8px;text-align:left;background:#f5f9fd">Subject</th><th style="padding:8px;text-align:center;background:#f5f9fd">Marks</th><th style="padding:8px;text-align:right;background:#f5f9fd">%</th></tr></thead><tbody>${body}</tbody></table>`
}

export function deliveryEventKey(examId){
  return `result_day:${text(examId)}`
}

export function buildResultDayMessage({student={},exam={},result=null,subjectPerformance=[],siteUrl}={}){
  const name=text(student.full_name)||'Student'
  const title=text(exam.title)||'Academy Exam'
  const day=dateLabel(exam.exam_date)
  const max=Number(exam.total_marks)||0

  if(!result){
    const body=`<p style="margin-top:0">Hello <b>${esc(name)}</b>,</p><p>Here is your examination status for <b>${esc(day)}</b>.</p><div style="border:1px solid #f3c7c7;background:#fff7f7;border-radius:10px;padding:16px"><div style="font-size:13px;color:#607286">${esc(title)}</div><div style="font-size:22px;font-weight:900;color:#9a2f2f;margin-top:6px">NOT ATTENDED</div></div><p style="font-size:13px;color:#52677d;line-height:1.6">No valid exam attempt was recorded for this test. Please continue with the Academy study and revision plan.</p>`
    return {
      from:'results@sathyagrahiacademy.com',
      senderName:'Sathyagrahi Academy – Results',
      subject:`Result & Daily Performance — ${title}`,
      html:page('Result & Daily Performance',body,siteUrl),
      text:`${name} — ${title} — ${day}: NOT ATTENDED.`
    }
  }

  const score=Number(result.total_score)||0
  const percentage=Number(result.percentage)||0
  const correct=Number(result.correct_count)||0
  const wrong=Number(result.wrong_count)||0
  const unattempted=Number(result.unattempted_count)||0
  const body=`<p style="margin-top:0">Hello <b>${esc(name)}</b>,</p><p>Your result and performance summary for <b>${esc(day)}</b> is below.</p><div style="background:#f5f9fd;border:1px solid #dce7f1;border-radius:10px;padding:16px"><div style="font-size:13px;color:#607286">${esc(title)}</div><div style="font-size:24px;color:#123b68;margin-top:6px"><b>${score} / ${max}</b></div><div style="font-size:12px;margin-top:6px">${percentage.toFixed(2)}% · Correct ${correct} · Wrong ${wrong} · Unattempted ${unattempted}</div></div><div style="margin-top:16px;font-size:11px;font-weight:800;color:#6b7c90;text-transform:uppercase">Subject Performance</div>${performanceTable(subjectPerformance)}`
  return {
    from:'results@sathyagrahiacademy.com',
    senderName:'Sathyagrahi Academy – Results',
    subject:`Result & Daily Performance — ${title}`,
    html:page('Result & Daily Performance',body,siteUrl),
    text:`${name} — ${title}: ${score}/${max} (${percentage.toFixed(2)}%). Correct ${correct}, Wrong ${wrong}, Unattempted ${unattempted}.`
  }
}
