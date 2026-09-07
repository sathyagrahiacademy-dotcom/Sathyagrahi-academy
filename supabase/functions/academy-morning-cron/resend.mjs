const text=value=>String(value??'').trim()
export async function sendResendEmail({fetchImpl=fetch,apiKey,idempotencyKey,message}={}){
  if(!text(apiKey))throw new Error('Email provider is not configured')
  if(!text(message?.to))throw new Error('Email recipient is required')
  const response=await fetchImpl('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${text(apiKey)}`,'Content-Type':'application/json',...(text(idempotencyKey)?{'Idempotency-Key':text(idempotencyKey)}:{})},
    body:JSON.stringify({from:`${text(message.senderName)||'Sathyagrahi Academy'} <${text(message.from)}>`,to:[text(message.to)],subject:text(message.subject),html:String(message.html||''),text:text(message.text)||undefined,reply_to:text(message.replyTo||message.from)||undefined})
  })
  let data={}
  try{data=await response.json()}catch{data={}}
  if(!response.ok)throw new Error(text(data?.message||data?.error?.message||data?.error)||`Email provider request failed (${response.status||'unknown'})`)
  return {id:text(data?.id)||null}
}
