export function normaliseAudience(mode,studentIds){
  const m=String(mode||'').toLowerCase();
  if(!['all','selected'].includes(m))return{ok:false,error:'Invalid audience mode'};
  if(m==='all')return{ok:true,mode:'all',studentIds:[]};
  const ids=[...new Set((Array.isArray(studentIds)?studentIds:[]).map(v=>String(v||'').trim()).filter(Boolean))];
  if(!ids.length)return{ok:false,error:'Select at least one student'};
  return{ok:true,mode:'selected',studentIds:ids};
}

export function nextMaxAttempts(current){
  return Math.max(1,Number(current)||1)+1;
}
