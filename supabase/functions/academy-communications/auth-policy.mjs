const text=value=>String(value??'').trim()

export const INTERNAL_ACTIONS=Object.freeze(new Set([
  'exam_published',
  'result_published',
  'morning_dispatch'
]))

export const ADMIN_ACTIONS=Object.freeze(new Set([
  'status',
  'save_settings',
  'test_email',
  'test_whatsapp',
  'retry_delivery'
]))

export function isInternalAuthorised({provided,expected}={}){
  const want=text(expected)
  const got=text(provided)
  return Boolean(want&&got&&want===got)
}

export function providerReadiness(env={}){
  const email=Boolean(text(env.RESEND_API_KEY))
  const whatsapp=Boolean(
    text(env.META_WHATSAPP_ACCESS_TOKEN)&&
    text(env.META_WHATSAPP_PHONE_NUMBER_ID)&&
    text(env.META_GRAPH_API_VERSION)&&
    text(env.WHATSAPP_TEMPLATE_MORNING_PLAN)&&
    text(env.WHATSAPP_TEMPLATE_EXAM_PUBLISHED)&&
    text(env.WHATSAPP_TEMPLATE_RESULT_PUBLISHED)
  )
  return {email:{configured:email},whatsapp:{configured:whatsapp}}
}
