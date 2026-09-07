export function indiaClock(value=new Date()){
  const date=value instanceof Date?value:new Date(value)
  if(Number.isNaN(date.getTime()))return {date:'',time:''}
  const shifted=new Date(date.getTime()+330*60*1000).toISOString()
  return {date:shifted.slice(0,10),time:shifted.slice(11,16)}
}
const mins=value=>{const m=/^(\d{2}):(\d{2})$/.exec(String(value||''));return m?Number(m[1])*60+Number(m[2]):-1}
export function withinMorningWindow(actual,configured,windowMinutes=5){
  const a=mins(actual),c=mins(configured)
  return a>=c&&a<c+windowMinutes
}
