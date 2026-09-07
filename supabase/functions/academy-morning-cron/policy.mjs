export const SENDERS=Object.freeze({morning_plan:'info@sathyagrahiacademy.com'})
const text=value=>String(value??'').trim()
export function maskRecipient(value,channel='email'){
  if(channel!=='email')return ''
  const email=text(value).toLowerCase(),at=email.indexOf('@')
  if(at<=0)return email?'***':''
  const local=email.slice(0,at),domain=email.slice(at+1)
  if(local.length===1)return `*@${domain}`
  if(local.length===2)return `${local[0]}*@${domain}`
  return `${local[0]}${'*'.repeat(local.length-2)}${local.at(-1)}@${domain}`
}
