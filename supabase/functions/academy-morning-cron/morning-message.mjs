import { SENDERS } from './policy.mjs'
const text=value=>String(value??'').trim()
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))
const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const BLUE='#0B2F68',TEXT='#123B68',ORANGE='#F47A1F',WHITE='#FFFFFF'
function dateParts(value){const [y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?{d:String(d).padStart(2,'0'),m:months[m-1],y:String(y)}:{d:'',m:'',y:''}}
function dateLabel(value){const p=dateParts(value);return p.y?`${p.d} ${p.m} ${p.y}`:String(value||'TODAY')}
function subjectData(tasks,subject){
  const rows=(Array.isArray(tasks)?tasks:[]).filter(x=>x.subject===subject)
  const study=rows.find(x=>x.task_type==='Study')||null
  const revision=rows.find(x=>x.task_type==='Revision')||null
  return {study,revision,hours:Math.max(1,Math.round((Number(study?.target_minutes)||Number(rows[0]?.target_minutes)||240)/60))}
}
function icon(subject){
  if(subject==='Biology')return '<span style="font-size:22px;line-height:1;color:#FFFFFF">╲╱<br>╱╲</span>'
  if(subject==='Chemistry')return '<span style="font-size:30px;line-height:1;color:#FFFFFF">△</span>'
  return '<span style="font-size:30px;line-height:1;color:#FFFFFF">◎</span>'
}
function card(subject,tasks){
  const {study,revision,hours}=subjectData(tasks,subject)
  const chapter=study?.chapter||'No New Study'
  const day=study?.topic||'—'
  const revChapter=revision?.chapter||'No Revision'
  const revStage=revision?.topic||'—'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 12px;background:${WHITE};border:1px solid ${BLUE};border-radius:12px;overflow:hidden">
    <tr>
      <td width="130" valign="middle" style="width:130px;background:${BLUE};color:${WHITE};padding:17px 12px;text-align:center">
        <div style="height:42px;display:block;color:${WHITE};font-weight:800">${icon(subject)}</div>
        <div style="width:42px;border-top:3px solid ${ORANGE};margin:8px auto 9px"></div>
        <div style="font-size:12px;font-weight:900;letter-spacing:1px;color:${WHITE}">${esc(subject.toUpperCase())}</div>
      </td>
      <td valign="top" style="padding:0;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;background:${WHITE}">
          <tr>
            <td width="58%" valign="middle" style="width:58%;padding:13px 16px;border-bottom:1px solid ${BLUE};background:${WHITE}">
              <div style="font-size:9px;font-weight:900;letter-spacing:1px;color:${ORANGE};margin-bottom:5px">STUDY TODAY</div>
              <div style="font-size:14px;font-weight:800;line-height:1.35;color:${TEXT};text-align:left">${esc(chapter)}</div>
            </td>
            <td width="20%" valign="middle" style="width:20%;padding:13px 8px;border-left:1px solid ${BLUE};border-bottom:1px solid ${BLUE};background:${WHITE};text-align:center">
              <div style="font-size:12px;font-weight:900;line-height:1.35;color:${TEXT}">${esc(day)}</div>
            </td>
            <td width="22%" rowspan="2" valign="middle" style="width:22%;padding:14px 8px;border-left:1px solid ${BLUE};background:${WHITE};text-align:center">
              <div style="font-size:25px;line-height:1;color:${TEXT};margin-bottom:6px">◷</div>
              <div style="font-size:17px;font-weight:900;line-height:1.15;color:${TEXT};white-space:nowrap">${hours} HOURS</div>
              <div style="width:34px;border-top:3px solid ${ORANGE};margin:10px auto 0"></div>
            </td>
          </tr>
          <tr>
            <td valign="middle" style="padding:13px 16px;background:${WHITE}">
              <div style="font-size:9px;font-weight:900;letter-spacing:1px;color:${ORANGE};margin-bottom:5px">REVISION TODAY</div>
              <div style="font-size:14px;font-weight:800;line-height:1.35;color:${TEXT};text-align:left">${esc(revChapter)}</div>
            </td>
            <td valign="middle" style="padding:13px 8px;border-left:1px solid ${BLUE};background:${WHITE};text-align:center">
              <div style="font-size:12px;font-weight:900;line-height:1.35;color:${TEXT}">${esc(revStage)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}
export function buildMorningMessage({student={},date,tasks=[],siteUrl='https://sathyagrahiacademy.com'}={}){
  const name=text(student.full_name)||'Student',day=dateLabel(date),parts=dateParts(date),url=text(siteUrl)||'https://sathyagrahiacademy.com'
  const dateHtml=parts.y?`${esc(parts.d)} ${esc(parts.m)} <span style="color:${ORANGE}">${esc(parts.y)}</span>`:esc(day)
  const html=`<!doctype html><html><body style="margin:0;padding:0;background:${WHITE};font-family:Arial,Helvetica,sans-serif;color:${TEXT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${WHITE}"><tr><td align="center" style="padding:18px 10px">
    <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;background:${WHITE};border-collapse:separate;border-spacing:0">
      <tr><td style="padding:4px 18px 18px;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle"><div style="font-size:21px;font-weight:900;letter-spacing:.5px;color:${BLUE}">SATHYAGRAHI <span style="color:${ORANGE}">ACADEMY</span></div><div style="font-size:9px;font-weight:800;letter-spacing:2px;color:${TEXT};margin-top:4px">NEET PREPARATION SYSTEM</div></td>
          <td width="150" valign="middle" align="right" style="border-left:2px solid ${BLUE};padding-left:14px"><div style="font-size:10px;font-weight:900;line-height:1.45;letter-spacing:1.4px;color:${TEXT}">DISCIPLINE TODAY<br>A DOCTOR TOMORROW</div><div style="width:34px;border-top:3px solid ${ORANGE};margin:7px 0 0 auto"></div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 10px 16px;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${BLUE};border-radius:12px"><tr>
          <td style="padding:18px 22px;color:${WHITE}"><div style="font-size:10px;font-weight:800;letter-spacing:2px;color:${WHITE}">MORNING STUDY PLAN</div><div style="font-size:30px;font-weight:900;line-height:1.2;color:${WHITE};margin-top:3px">${dateHtml}</div></td>
          <td width="190" align="center" style="padding:18px;border-left:1px solid ${WHITE};color:${WHITE}"><div style="font-size:10px;font-weight:800;line-height:1.6;letter-spacing:2px;color:${WHITE}">SMALL STEPS<br>BIG RESULTS</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:4px 18px 16px;text-align:center;background:${WHITE}"><span style="font-size:18px;font-weight:900;color:${TEXT}">Good Morning, ${esc(name.toUpperCase())}!</span><span style="font-size:18px;color:${ORANGE};padding:0 10px">|</span><span style="font-size:13px;font-weight:700;color:${TEXT}">Wishing you a focused study day.</span></td></tr>
      <tr><td style="padding:0 10px 4px;background:${WHITE}">${card('Biology',tasks)}${card('Chemistry',tasks)}${card('Physics',tasks)}</td></tr>
      <tr><td style="padding:0 10px 14px;background:${WHITE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${BLUE};border-left:6px solid ${ORANGE};border-radius:10px;background:${WHITE}"><tr><td width="165" style="padding:15px 18px;border-right:1px solid ${BLUE};font-size:13px;font-weight:900;letter-spacing:.8px;color:${TEXT}">TODAY’S FOCUS</td><td style="padding:15px 18px;font-size:12px;font-weight:700;line-height:1.45;color:${TEXT}">Complete today’s study as per plan and maintain your notes.</td></tr></table></td></tr>
      <tr><td style="padding:12px 18px 5px;border-top:2px solid ${BLUE};background:${WHITE}"><table role="presentation" width="100%"><tr><td><div style="font-size:11px;font-weight:900;color:${TEXT}">Sathyagrahi Academy</div><div style="font-size:9px;font-weight:700;color:${TEXT};margin-top:2px">NEET Preparation System</div></td><td align="right" style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:${TEXT}">CONSISTENT EFFORTS <span style="color:${ORANGE}">|</span> BRIGHTER FUTURES</td></tr></table></td></tr>
    </table>
  </td></tr></table></body></html>`
  const lines=['Biology','Chemistry','Physics'].map(subject=>{const d=subjectData(tasks,subject);return `${subject}: ${d.study?.chapter||'No New Study'} (${d.study?.topic||'—'}); ${d.revision?`${d.revision.chapter} ${d.revision.topic}`:'No Revision'}; ${d.hours} HOURS`})
  return {from:SENDERS.morning_plan,senderName:'Sathyagrahi Academy',subject:`Morning Study Plan — ${day}`,html,text:`Good Morning, ${name}!\n${lines.join('\n')}\n${url}`}
}
