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
  function createSaveQueue(saveFn){
    const desired=new Map();
    const workers=new Map();
    const clone=state=>({selected_option:normaliseAnswer(state?.selected_option),marked_for_review:Boolean(state?.marked_for_review)});
    function start(questionId){
      if(workers.has(questionId))return workers.get(questionId);
      const worker=(async()=>{
        while(desired.has(questionId)){
          const state=clone(desired.get(questionId));
          desired.delete(questionId);
          try{await saveFn(questionId,state)}catch(e){desired.set(questionId,state);throw e}
        }
      })().finally(()=>workers.delete(questionId));
      workers.set(questionId,worker);
      return worker;
    }
    function enqueue(questionId,state){
      desired.set(String(questionId),clone(state));
      return start(String(questionId));
    }
    async function flush(questionId){
      const id=String(questionId);
      while(desired.has(id)||workers.has(id)){
        if(desired.has(id)&&!workers.has(id))start(id);
        if(workers.has(id))await workers.get(id);
      }
    }
    async function flushAll(){
      const ids=new Set([...desired.keys(),...workers.keys()]);
      await Promise.all([...ids].map(flush));
    }
    function hasPending(){return desired.size>0||workers.size>0;}
    return{enqueue,flush,flushAll,hasPending};
  }
  return{normaliseAnswer,buildFullSnapshot,snapshotQuestionIds,isConfirmedCurrent,statusForQuestion,createSaveQueue};
});
