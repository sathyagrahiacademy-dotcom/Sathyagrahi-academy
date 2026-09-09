import { SENDERS } from './policy.mjs'

const text=value=>String(value??'').trim()
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))
const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const weekdays=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const BLUE='#0B2F68',TEXT='#123B68',ORANGE='#F47A1F',WHITE='#FFFFFF',PALE='#EEF6FD'

function dateParts(value){
  const [y,m,d]=String(value||'').split('-').map(Number)
  if(!y||!m||!d)return {d:'',m:'',y:'',weekday:''}
  const stamp=new Date(Date.UTC(y,m-1,d))
  if(stamp.getUTCFullYear()!==y||stamp.getUTCMonth()!==m-1||stamp.getUTCDate()!==d)return {d:'',m:'',y:'',weekday:''}
  return {d:String(d).padStart(2,'0'),m:months[m-1],y:String(y),weekday:weekdays[stamp.getUTCDay()]}
}
function dateLabel(value){const p=dateParts(value);return p.y?`${p.d} ${p.m} ${p.y}`:String(value||'TODAY')}

function subjectData(tasks,subject){
  const rows=(Array.isArray(tasks)?tasks:[]).filter(x=>x.subject===subject)
  const study=rows.find(x=>x.task_type==='Study')||null
  const revision=rows.find(x=>x.task_type==='Revision')||null
  return {study,revision,hours:Math.max(1,Math.round((Number(study?.target_minutes)||Number(rows[0]?.target_minutes)||240)/60))}
}

function icon(subject){
  if(subject==='Biology')return '<span style="font-size:31px;line-height:1;color:#FFFFFF;font-family:Arial,sans-serif">&#129516;</span>'
  if(subject==='Chemistry')return '<span style="font-size:34px;line-height:1;color:#FFFFFF;font-family:Arial,sans-serif">&#9879;</span>'
  return '<span style="font-size:35px;line-height:1;color:#FFFFFF;font-family:Arial,sans-serif">&#9883;</span>'
}

function card(subject,tasks){
  const {study,revision,hours}=subjectData(tasks,subject)
  const chapter=study?.chapter||'No New Study'
  const day=study?.topic||'—'
  const revChapter=revision?.chapter||'No Revision'
  const revStage=revision?.topic||'—'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 10px;background:${WHITE};border:1px solid ${BLUE};border-radius:10px;overflow:hidden">
    <tr>
      <td width="144" valign="middle" style="width:144px;background:${BLUE};color:${WHITE};padding:17px 12px;text-align:center">
        <div style="height:48px;display:block;color:${WHITE};font-weight:800">${icon(subject)}</div>
        <div style="width:44px;border-top:3px solid ${ORANGE};margin:7px auto 9px"></div>
        <div style="font-size:13px;font-weight:500;letter-spacing:1.7px;color:${WHITE}">${esc(subject.toUpperCase())}</div>
      </td>
      <td valign="top" style="padding:0;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;background:${WHITE}">
          <tr>
            <td width="57%" valign="middle" style="width:57%;padding:12px 18px;border-bottom:1px solid ${PALE};background:${WHITE}">
              <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:${ORANGE};margin-bottom:5px">STUDY TODAY</div>
              <div style="font-size:16px;font-weight:800;line-height:1.3;color:${TEXT};text-align:left">${esc(chapter)}</div>
            </td>
            <td width="20%" valign="middle" style="width:20%;padding:12px 8px;border-left:1px solid ${PALE};border-bottom:1px solid ${PALE};background:${WHITE};text-align:center">
              <div style="font-size:14px;font-weight:900;line-height:1.3;color:${TEXT}">${esc(day)}</div>
            </td>
            <td width="23%" rowspan="2" valign="middle" style="width:23%;padding:12px 8px;border-left:1px solid ${PALE};background:${PALE};text-align:center">
              <div style="font-size:30px;line-height:1;color:${TEXT};margin-bottom:7px">&#9716;</div>
              <div style="font-size:18px;font-weight:900;line-height:1.1;color:${TEXT};white-space:nowrap">${hours} HOURS</div>
              <div style="width:38px;border-top:3px solid ${ORANGE};margin:10px auto 8px"></div>
              <div style="font-size:10px;font-weight:800;letter-spacing:1.6px;color:${TEXT}">STUDY TIME</div>
            </td>
          </tr>
          <tr>
            <td valign="middle" style="padding:12px 18px;background:${WHITE}">
              <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:${ORANGE};margin-bottom:5px">REVISION TODAY</div>
              <div style="font-size:15px;font-weight:800;line-height:1.3;color:${TEXT};text-align:left">${esc(revChapter)}</div>
            </td>
            <td valign="middle" style="padding:12px 8px;border-left:1px solid ${PALE};background:${WHITE};text-align:center">
              <div style="font-size:13px;font-weight:900;line-height:1.3;color:${TEXT}">${esc(revStage)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

export function buildMorningMessage({student={},date,tasks=[],siteUrl='https://sathyagrahiacademy.com'}={}){
  const name=text(student.full_name)||'Student'
  const day=dateLabel(date)
  const parts=dateParts(date)
  const url=text(siteUrl)||'https://sathyagrahiacademy.com'
  const brandUrl=`${url.replace(/\/$/,'')}/assets/header-brand.png`
  const dateHtml=parts.y?`${esc(parts.d)} ${esc(parts.m)} <span style="color:${ORANGE}">${esc(parts.y)}</span>`:esc(day)
  const weekday=parts.weekday||'TODAY'

  const html=`<!doctype html><html><body style="margin:0;padding:0;background:${WHITE};font-family:Arial,Helvetica,sans-serif;color:${TEXT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${WHITE}"><tr><td align="center" style="padding:18px 10px">
    <table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:${WHITE};border-collapse:separate;border-spacing:0">
      <tr><td style="padding:4px 20px 18px;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="padding-right:18px"><img src="${esc(brandUrl)}" width="390" alt="Sathyagrahi Academy" style="display:block;width:100%;max-width:390px;height:auto;border:0"></td>
          <td width="165" valign="middle" align="left" style="width:165px;border-left:2px solid ${BLUE};padding-left:18px"><div style="font-size:11px;font-weight:700;line-height:1.45;letter-spacing:1.6px;color:${TEXT}">DISCIPLINE<br>TODAY<br>A DOCTOR<br>TOMORROW</div><div style="width:38px;border-top:2px solid ${ORANGE};margin:8px 0 0"></div></td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:0 10px 17px;background:${WHITE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${BLUE};border-radius:10px"><tr>
          <td valign="middle" style="padding:17px 22px;color:${WHITE}">
            <div style="font-size:11px;font-weight:500;letter-spacing:2.6px;color:${WHITE}">MORNING STUDY PLAN</div>
            <div style="font-size:32px;font-weight:900;line-height:1.12;color:${WHITE};margin-top:3px;white-space:nowrap">${dateHtml}</div>
          </td>
          <td width="155" align="center" valign="middle" style="width:155px;padding:14px 8px;color:${WHITE}">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:auto;background:${WHITE};border-radius:8px"><tr><td style="padding:9px 12px;font-size:13px;font-weight:900;letter-spacing:.6px;color:${TEXT};white-space:nowrap"><span style="font-size:16px;vertical-align:-1px">&#9638;</span>&nbsp;&nbsp;${esc(weekday)}</td></tr></table>
          </td>
          <td width="1" style="width:1px;background:${WHITE};font-size:1px;line-height:1px">&nbsp;</td>
          <td width="175" align="center" valign="middle" style="width:175px;padding:16px 12px;color:${WHITE}"><div style="font-size:11px;font-weight:700;line-height:1.5;letter-spacing:2.1px;color:${WHITE}">SMALL STEPS<br>BIG RESULTS</div></td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:3px 18px 16px;text-align:center;background:${WHITE}"><span style="font-size:19px;font-weight:900;color:${TEXT}">Good Morning, ${esc(name.toUpperCase())}!</span><span style="font-size:20px;color:${ORANGE};padding:0 12px">|</span><span style="font-size:14px;font-weight:500;color:${TEXT}">Wishing you a focused study day.</span></td></tr>

      <tr><td style="padding:0 10px 4px;background:${WHITE}">${card('Biology',tasks)}${card('Chemistry',tasks)}${card('Physics',tasks)}</td></tr>

      <tr><td style="padding:0 10px 14px;background:${WHITE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-left:7px solid ${ORANGE};border-radius:9px;background:${PALE}"><tr><td width="190" style="padding:15px 20px;border-right:2px solid ${BLUE};font-size:15px;font-weight:900;letter-spacing:.3px;color:${TEXT}">TODAY’S FOCUS</td><td style="padding:15px 22px;font-size:13px;font-weight:500;line-height:1.45;color:${TEXT}">Complete today’s study as per plan and maintain your notes.</td></tr></table></td></tr>

      <tr><td style="padding:12px 12px 5px;border-top:2px solid ${BLUE};background:${WHITE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:12px;font-weight:900;color:${TEXT}">Sathyagrahi Academy</div></td><td align="right" style="font-size:9px;font-weight:900;letter-spacing:1.3px;color:${TEXT}">CONSISTENT EFFORTS <span style="color:${ORANGE}">|</span> BRIGHTER FUTURES <span style="display:inline-block;width:28px;border-top:2px solid ${ORANGE};vertical-align:middle;margin-left:7px"></span></td></tr></table></td></tr>
    </table>
  </td></tr></table></body></html>`

  const lines=['Biology','Chemistry','Physics'].map(subject=>{const d=subjectData(tasks,subject);return `${subject}: ${d.study?.chapter||'No New Study'} (${d.study?.topic||'—'}); ${d.revision?`${d.revision.chapter} ${d.revision.topic}`:'No Revision'}; ${d.hours} HOURS`})
  return {from:SENDERS.morning_plan,senderName:'Sathyagrahi Academy',subject:`Morning Study Plan — ${day}`,html,text:`Good Morning, ${name}!\n${lines.join('\n')}\n${url}`}
}
