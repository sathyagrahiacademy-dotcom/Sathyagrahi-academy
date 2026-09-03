export function decideAttempt(attempts,maxAttempts){
  const list=Array.isArray(attempts)?attempts:[];
  const active=list.find(a=>a?.status==='in_progress');
  if(active)return{action:'resume',attempt:active};
  const quota=Math.max(1,Number(maxAttempts)||1);
  if(list.length>=quota)return{action:'block'};
  const maxNo=list.reduce((m,a)=>Math.max(m,Number(a?.attempt_no)||0),0);
  return{action:'create',attemptNo:maxNo+1};
}
