((root)=>{
  function safeNonNegativeInt(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?Math.floor(n):0;
  }

  function formatActiveTime(value){
    const sec=safeNonNegativeInt(value);
    if(sec<60)return `${sec} sec`;
    const min=Math.floor(sec/60),rem=sec%60;
    return `${min} min ${String(rem).padStart(2,'0')} sec`;
  }

  function normaliseQuestionMeta(question={}){
    const activeSeconds=safeNonNegativeInt(question.active_seconds);
    return {
      difficulty:String(question.difficulty||'').trim()||'Not Set',
      topic:String(question.topic||'').trim()||'Unmapped',
      activeSeconds,
      activeTime:formatActiveTime(activeSeconds),
      visitCount:safeNonNegativeInt(question.visit_count),
      answerChangeCount:safeNonNegativeInt(question.answer_change_count)
    };
  }

  root.sgaStudentAnswerReview={formatActiveTime,normaliseQuestionMeta};
})(typeof window!=='undefined'?window:globalThis);
