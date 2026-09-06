const text=value=>String(value??'').trim()

async function providerJson(response,label){
  let data={}
  try{data=await response.json()}catch{data={}}
  if(!response.ok){
    const message=text(data?.message||data?.error?.message||data?.error)||`${label} request failed (${response.status||'unknown'})`
    throw new Error(message)
  }
  return data
}

export async function sendResendEmail({fetchImpl=fetch,apiKey,idempotencyKey,message}={}){
  const key=text(apiKey)
  if(!key)throw new Error('Email provider is not configured')
  if(!message?.to)throw new Error('Email recipient is required')
  const fromName=text(message.senderName)||'Sathyagrahi Academy'
  const response=await fetchImpl('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${key}`,
      'Content-Type':'application/json',
      ...(text(idempotencyKey)?{'Idempotency-Key':text(idempotencyKey)}:{})
    },
    body:JSON.stringify({
      from:`${fromName} <${text(message.from)}>`,
      to:[text(message.to)],
      subject:text(message.subject),
      html:String(message.html||''),
      text:text(message.text)||undefined,
      reply_to:text(message.replyTo||message.from)||undefined
    })
  })
  const data=await providerJson(response,'Email provider')
  return {id:text(data.id)||null}
}

export async function sendMetaTemplate({fetchImpl=fetch,accessToken,apiVersion,phoneNumberId,to,templateName,language='en',values=[]}={}){
  const token=text(accessToken),version=text(apiVersion),phoneId=text(phoneNumberId),recipient=text(to),template=text(templateName)
  if(!token||!version||!phoneId||!template)throw new Error('WhatsApp provider is not configured')
  if(!recipient)throw new Error('WhatsApp recipient is required')
  const parameters=(Array.isArray(values)?values:[]).map(value=>({type:'text',text:text(value)||'—'}))
  const body={
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:recipient,
    type:'template',
    template:{
      name:template,
      language:{code:text(language)||'en'},
      ...(parameters.length?{components:[{type:'body',parameters}]}:{})
    }
  }
  const response=await fetchImpl(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`,{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  })
  const data=await providerJson(response,'WhatsApp provider')
  return {id:text(data?.messages?.[0]?.id)||null}
}
