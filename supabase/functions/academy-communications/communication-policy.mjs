export const SENDERS=Object.freeze({
  morning_plan:'info@sathyagrahiacademy.com',
  exam_published:'exams@sathyagrahiacademy.com',
  result_published:'results@sathyagrahiacademy.com'
})

const text=value=>String(value??'').trim()

export function normalisePhone(value){
  return text(value).replace(/\D/g,'')
}

export function indiaDateKey(value=new Date()){
  const date=value instanceof Date?value:new Date(value)
  if(Number.isNaN(date.getTime()))return ''
  // Asia/Kolkata is UTC+05:30 and does not observe daylight-saving time.
  return new Date(date.getTime()+330*60*1000).toISOString().slice(0,10)
}

export function eventKey(type,input={}){
  const kind=text(type)
  if(kind==='exam_published'){
    const examId=text(input.examId)
    return examId?`exam_published:${examId}`:''
  }
  if(kind==='result_published'){
    const attemptId=text(input.attemptId)
    return attemptId?`result_published:${attemptId}`:''
  }
  if(kind==='morning_plan'){
    const studentId=text(input.studentId)
    const date=text(input.date)
    return studentId&&/^\d{4}-\d{2}-\d{2}$/.test(date)?`morning_plan:${studentId}:${date}`:''
  }
  return ''
}

export function maskRecipient(value,channel){
  if(channel==='whatsapp'){
    const phone=normalisePhone(value)
    if(!phone)return ''
    if(phone.length<=4)return '*'.repeat(phone.length)
    return '*'.repeat(phone.length-4)+phone.slice(-4)
  }

  const email=text(value).toLowerCase()
  const at=email.indexOf('@')
  if(at<=0)return email?'***':''
  const local=email.slice(0,at)
  const domain=email.slice(at+1)
  if(local.length===1)return `*@${domain}`
  if(local.length===2)return `${local[0]}*@${domain}`
  return `${local[0]}${'*'.repeat(local.length-2)}${local.at(-1)}@${domain}`
}
