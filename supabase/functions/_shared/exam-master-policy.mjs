export const MASTER_EXAM_TYPES=Object.freeze({
  daily:Object.freeze({code:'DT',label:'Daily Test'}),
  weekly:Object.freeze({code:'WT',label:'Weekly Test'}),
  monthly:Object.freeze({code:'MT',label:'Monthly Test'}),
  grand:Object.freeze({code:'GT',label:'Grand Test'})
})

export function normaliseMasterExamType(value){
  const key=String(value??'').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(MASTER_EXAM_TYPES,key)?key:null
}

export function masterExamTypeLabel(value){
  const key=normaliseMasterExamType(value)
  return key?MASTER_EXAM_TYPES[key].label:null
}

function parseIsoDate(value){
  const raw=String(value??'')
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if(!m)throw new Error('Invalid exam date')
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3])
  const d=new Date(Date.UTC(year,month-1,day))
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw new Error('Invalid exam date')
  return {year,month,day}
}

export function buildMasterExamCode({type,batch,date}={}){
  const key=normaliseMasterExamType(type)
  if(!key)throw new Error('Invalid exam type')
  const n=Number(batch)
  if(!Number.isInteger(n)||n<1||n>99)throw new Error('Invalid batch')
  const {month,day}=parseIsoDate(date)
  const batch2=String(n).padStart(2,'0')
  const dd=String(day).padStart(2,'0')
  const mm=String(month).padStart(2,'0')
  return `SGA-${MASTER_EXAM_TYPES[key].code}-${batch2}${dd}${mm}`
}

export function deriveExamLifecycle(input={}){
  if(input.archivedAt)return {state:'archived'}
  if(input.resultPublished)return {state:'result_published'}
  if(!input.isPublished)return {state:input.setupReady===true?'ready':'draft'}
  if(Number(input.activeCount||0)>0)return {state:'live'}
  if(input.newStartsClosedAt||input.legacyCompleted===true){
    return {state:Number(input.readyResultCount||0)>0?'results_ready':'conducted'}
  }
  return {state:'available'}
}

export function nextExamAction(state){
  switch(String(state||'')){
    case 'draft': return 'Continue Setup'
    case 'ready': return 'Publish Exam'
    case 'available':
    case 'live': return 'Monitor Exam'
    case 'conducted': return 'Review Results'
    case 'results_ready': return 'Publish Results'
    case 'result_published': return 'View Performance'
    case 'archived': return 'View Exam'
    default: return 'View Exam'
  }
}
