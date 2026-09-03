(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.sgaExamAttemptSync=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  function normaliseAnswer(value){
    if(value==null||value==='')return null;
    const v=String(value).toUpperCase();
    return ['A','B','C','D'].includes(v)?v:null;
  }
  function buildFullSnapshot(questions,responses){
    return (questions||[]).map(q=>{
      const r=(responses&&responses[q.id])||{};
      return{
        questionId:String(q.id),
        selectedOption:normaliseAnswer(r.selected_option),
        markedForReview:Boolean(r.marked_for_review)
      };
    });
  }
  function snapshotQuestionIds(snapshot){return(snapshot||[]).map(r=>String(r.questionId));}
  function isConfirmedCurrent(qid,responses,confirmed){
    const a=(responses&&responses[qid])||{selected_option:null,marked_for_review:false};
    const b=(confirmed&&confirmed[qid])||null;
    if(!b)return false;
    return normaliseAnswer(a.selected_option)===normaliseAnswer(b.selected_option)&&Boolean(a.marked_for_review)===Boolean(b.marked_for_review);
  }
  function statusForQuestion({questionId,response,visited,confirmedCurrent}){
    const r=response||{selected_option:null,marked_for_review:false};
    const selected=normaliseAnswer(r.selected_option);
    const marked=Boolean(r.marked_for_review);
    if(marked&&selected&&confirmedCurrent)return'reviewanswered';
    if(marked)return'review';
    if(selected&&confirmedCurrent)return'answered';
    if(visited)return'notanswered';
    return'notvisited';
  }
  return{normaliseAnswer,buildFullSnapshot,snapshotQuestionIds,isConfirmedCurrent,statusForQuestion};
});
