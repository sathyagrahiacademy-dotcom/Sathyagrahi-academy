export function groupQuestionDistribution(questions=[], keyFn=()=>'', labelFn=keyFn){
  const map=new Map();
  for(const q of Array.isArray(questions)?questions:[]){
    const key=String(keyFn(q)??'').trim(); if(!key)continue;
    const label=String(labelFn(q)??key).trim()||key;
    const row=map.get(key)||{key,label,questions:0,marks:0};
    row.questions+=1; row.marks+=Number(q?.marks||0); map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label));
}
export function buildBlueprintModel(data={}){
  const questions=Array.isArray(data.questions)?data.questions:[];
  return {
    status:data.validation?.publishReady?'FINAL BLUEPRINT':'DRAFT BLUEPRINT',
    subjects:groupQuestionDistribution(questions,q=>q.subject||'Unmapped'),
    units:groupQuestionDistribution(questions,q=>String(q.unitId||q.unitTitle||'Unmapped'),q=>q.unitTitle||'Unmapped'),
    chapters:groupQuestionDistribution(questions,q=>String(q.chapterId||q.chapterTitle||'Unmapped'),q=>q.chapterTitle||'Unmapped'),
    topics:groupQuestionDistribution(questions,q=>String(q.subtopicId||q.topicTitle||'Unmapped'),q=>q.topicTitle||'Unmapped'),
    difficulty:groupQuestionDistribution(questions,q=>q.difficulty||'Not Set'),
    types:groupQuestionDistribution(questions,q=>q.question_type||'Not Set'),
    totalQuestions:questions.length,
    totalMarks:questions.reduce((s,q)=>s+Number(q.marks||0),0)
  };
}
