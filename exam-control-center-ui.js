(function(root,factory){
  const api=factory()
  if(typeof module!=='undefined'&&module.exports)module.exports=api
  if(root)root.ExamControlCenterUI=api
})(typeof window!=='undefined'?window:null,function(){
  const list=v=>Array.isArray(v)?v:[]
  const conductedStates=new Set(['conducted','results_ready','result_published'])
  const labels=Object.freeze({
    draft:'DRAFT',ready:'READY',available:'AVAILABLE',live:'LIVE',conducted:'CONDUCTED',
    results_ready:'RESULTS READY',result_published:'RESULT PUBLISHED',archived:'ARCHIVED'
  })

  function statusLabel(state){return labels[String(state||'')]||String(state||'UNKNOWN').replace(/_/g,' ').toUpperCase()}
  function monthKey(v){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(0,7):''}
  function tabMatch(state,tab){
    const t=String(tab||'all').toLowerCase(),s=String(state||'')
    if(t==='all')return true
    if(t==='draft')return s==='draft'||s==='ready'
    if(t==='upcoming')return s==='available'
    if(t==='live')return s==='live'
    if(t==='conducted')return conductedStates.has(s)
    if(t==='archived')return s==='archived'
    return true
  }

  function filterControlCenterExams(exams=[],filters={}){
    const search=String(filters.search||'').trim().toLowerCase()
    const type=String(filters.type||'').trim().toLowerCase()
    const batch=String(filters.batch||'').trim()
    const month=String(filters.month||'').trim()
    return list(exams).filter(x=>{
      if(!tabMatch(x?.state,filters.tab))return false
      if(search&&!`${x?.title||''} ${x?.examCode||''}`.toLowerCase().includes(search))return false
      if(type&&type!=='all'&&String(x?.examType||'').toLowerCase()!==type)return false
      if(batch&&batch!=='all'&&String(x?.batchNo??'')!==batch)return false
      if(month&&month!=='all'&&monthKey(x?.examDate)!==month)return false
      return true
    })
  }

  function monthLabel(key){
    if(!/^\d{4}-\d{2}$/.test(String(key||'')))return String(key||'Unknown')
    const [y,m]=String(key).split('-').map(Number)
    return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)))
  }

  function groupConductedByMonth(exams=[]){
    const map=new Map()
    for(const x of list(exams)){
      if(!conductedStates.has(String(x?.state||'')))continue
      const key=monthKey(x?.examDate)||'unknown'
      if(!map.has(key))map.set(key,{key,label:monthLabel(key),exams:[]})
      map.get(key).exams.push(x)
    }
    return [...map.values()].sort((a,b)=>b.key.localeCompare(a.key))
  }

  function priorityRank(x,today){
    const issues=list(x?.issues).length
    const isToday=String(x?.examDate||'')===String(today||'')
    const state=String(x?.state||'')
    if(issues&&(isToday||state==='live'))return 500
    if(state==='live')return 400
    if(isToday&&state==='available')return 300
    if(state==='ready'||state==='draft')return 200
    if(state==='available')return 100
    return 0
  }

  function priorityExam(exams=[],{today}={}){
    return list(exams).map((x,i)=>({x,i,rank:priorityRank(x,today)})).sort((a,b)=>{
      if(b.rank!==a.rank)return b.rank-a.rank
      const bd=String(b.x?.examDate||''),ad=String(a.x?.examDate||'')
      if(bd!==ad)return bd.localeCompare(ad)
      return a.i-b.i
    })[0]?.x||null
  }

  return{filterControlCenterExams,groupConductedByMonth,priorityExam,statusLabel}
})
