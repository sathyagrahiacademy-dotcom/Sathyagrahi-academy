const text=value=>String(value??'').trim()

function validDate(value){
  const date=value instanceof Date?value:new Date(value)
  return Number.isNaN(date.getTime())?null:date
}

function two(value){return String(value).padStart(2,'0')}

export function indiaClock(value=new Date()){
  const date=validDate(value)
  if(!date)return {date:'',time:''}
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Kolkata',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date)
  const byType=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return {
    date:`${byType.year}-${two(byType.month)}-${two(byType.day)}`,
    time:`${two(byType.hour)}:${two(byType.minute)}`
  }
}

function clockMinutes(value){
  const raw=text(value)
  const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw)
  if(!match)return null
  return Number(match[1])*60+Number(match[2])
}

export function withinMorningWindow(currentTime,configuredTime,windowMinutes=5){
  const current=clockMinutes(currentTime)
  const configured=clockMinutes(configuredTime)
  const window=Math.max(1,Math.floor(Number(windowMinutes)||0))
  if(current==null||configured==null)return false
  const delta=current-configured
  return delta>=0&&delta<window
}
