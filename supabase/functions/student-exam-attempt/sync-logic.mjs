export function normaliseSubmittedOption(value){
  if(value==null||value==='')return null;
  const v=String(value).toUpperCase();
  return ['A','B','C','D'].includes(v)?v:undefined;
}

export function validateSnapshotCoverage(authoritativeQuestionIds,snapshot){
  const ids=(authoritativeQuestionIds||[]).map(String);
  if(!Array.isArray(snapshot))return{ok:false,error:'Complete answer snapshot is required'};
  if(snapshot.length!==ids.length)return{ok:false,error:'Answer sync is incomplete. Please retry submission.'};
  const allowed=new Set(ids),seen=new Set(),rows=[];
  for(const item of snapshot){
    const questionId=String(item?.questionId||'');
    if(!questionId||!allowed.has(questionId))return{ok:false,error:'Answer snapshot contains an invalid question'};
    if(seen.has(questionId))return{ok:false,error:'Answer snapshot contains duplicate questions'};
    const selectedOption=normaliseSubmittedOption(item?.selectedOption);
    if(selectedOption===undefined)return{ok:false,error:'Answer snapshot contains an invalid option'};
    seen.add(questionId);
    rows.push({question_id:questionId,selected_option:selectedOption,marked_for_review:Boolean(item?.markedForReview)});
  }
  if(seen.size!==allowed.size||ids.some(id=>!seen.has(id)))return{ok:false,error:'Answer sync is incomplete. Please retry submission.'};
  return{ok:true,rows};
}
