const text=v=>String(v??'').trim();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round1=v=>Math.round((num(v)+Number.EPSILON)*10)/10;
const pct=(a,b)=>b>0?round1(a/b*100):0;

const DIFFICULTIES=['Easy','Medium','Hard'];
function difficultyName(v){const s=text(v).toLowerCase();if(s==='easy')return 'Easy';if(s==='hard')return 'Hard';return 'Medium'}
function median(values){const a=(values||[]).map(num).filter(v=>v>0).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function avg(values){const a=(values||[]).map(num).filter(v=>v>=0);return a.length?round1(a.reduce((s,v)=>s+v,0)/a.length):0}
function emptyDifficulty(){return {attempted:0,correct:0,accuracy:0,avgActiveSeconds:0}}
function aggregateDifficulty(events){
  const out={Easy:emptyDifficulty(),Medium:emptyDifficulty(),Hard:emptyDifficulty()};
  for(const d of DIFFICULTIES){
    const rows=(events||[]).filter(e=>e.isAttempted&&difficultyName(e.difficulty)===d);
    const correct=rows.filter(e=>e.isCorrect).length;
    out[d]={attempted:rows.length,correct,accuracy:pct(correct,rows.length),avgActiveSeconds:avg(rows.map(e=>num(e.activeSeconds)))};
  }
  return out;
}
function attemptStats(events){
  const by=new Map();
  for(const e of events||[]){if(!e.isAttempted)continue;const id=text(e.attemptId)||'legacy';if(!by.has(id))by.set(id,{id,at:text(e.submittedAt),attempted:0,correct:0});const r=by.get(id);r.attempted++;if(e.isCorrect)r.correct++;if(text(e.submittedAt)>r.at)r.at=text(e.submittedAt)}
  return [...by.values()].map(r=>({...r,accuracy:pct(r.correct,r.attempted)})).sort((a,b)=>a.at.localeCompare(b.at));
}
function trendFor(stats){if(stats.length<2)return 'Not Enough Data';const prev=stats[stats.length-2].accuracy,latest=stats[stats.length-1].accuracy,delta=latest-prev;if(delta>=5)return 'Improving';if(delta<=-5)return 'Declining';return 'Stable'}
function recentAccuracy(stats){const rows=stats.slice(-2);return rows.length?round1(rows.reduce((s,r)=>s+r.accuracy,0)/rows.length):0}
function transitions(events){
  const by=new Map();
  for(const e of events||[]){const id=text(e.bankQuestionId);if(!id||!e.isAttempted)continue;if(!by.has(id))by.set(id,[]);by.get(id).push(e)}
  let retentionMisses=0,improvementEvents=0;
  for(const rows of by.values()){
    rows.sort((a,b)=>text(a.submittedAt).localeCompare(text(b.submittedAt)));
    for(let i=1;i<rows.length;i++){
      if(rows[i-1].isCorrect===true&&rows[i].isCorrect===false)retentionMisses++;
      if(rows[i-1].isCorrect===false&&rows[i].isCorrect===true)improvementEvents++;
    }
  }
  return {retentionMisses,improvementEvents};
}
function classificationFor(t){
  if(!t.attempted)return 'Not Yet Assessed';
  if(t.coveragePct<40||t.uniqueBankQuestionsFaced<5)return t.accuracy>=75?'Strong Early Evidence — Low Coverage':'Developing — Low Coverage';
  if(t.attempted>=5&&t.accuracy<45)return 'Weak';
  const hard=t.difficulty.Hard;
  if(t.accuracy>=85&&t.coveragePct>=70&&hard.attempted>=3&&hard.accuracy>=70&&t.distinctAttempts>=2&&t.recentAccuracy>=80&&t.retentionMisses===0)return 'Mastered';
  if(t.retentionMisses>0||t.accuracy<60||(hard.attempted>=3&&hard.accuracy<60))return 'Needs Revision';
  if(t.accuracy>=75&&t.coveragePct>=40)return 'Strong';
  return 'Developing';
}
function topicEvidence(t){
  const hard=t.difficulty.Hard;
  return `${t.topicTitle} — ${t.accuracy}% accuracy across ${t.attempted} attempted questions; bank coverage ${t.coveragePct}% (${t.uniqueBankQuestionsFaced}/${t.activeBankQuestions}); Hard ${hard.accuracy}% on ${hard.attempted}; ${t.retentionMisses} retention miss${t.retentionMisses===1?'':'es'}.`;
}
function makeSignal(t,reason,evidence=topicEvidence(t)){return {subtopicId:t.subtopicId,topic:t.topicTitle,classification:t.classification,reason,evidence}}

export function buildPerformanceIntelligence({bankQuestions=[],events=[]}={}){
  const activeBank=(bankQuestions||[]).filter(q=>q&&q.is_active!==false);
  const activeById=new Map(activeBank.map(q=>[text(q.id),q]));
  const linkedEvents=(events||[]).filter(e=>text(e.bankQuestionId));
  const facedActiveIds=new Set(linkedEvents.map(e=>text(e.bankQuestionId)).filter(id=>activeById.has(id)));
  const repeatExposure=Math.max(0,linkedEvents.length-new Set(linkedEvents.map(e=>text(e.bankQuestionId))).size);
  const allTransitions=transitions(events);
  const difficulty=aggregateDifficulty(events);

  const topicIds=new Set([
    ...activeBank.map(q=>text(q.subtopic_id)).filter(Boolean),
    ...(events||[]).map(e=>text(e.subtopicId)).filter(Boolean)
  ]);
  const subjectMedians={};
  for(const subject of new Set((events||[]).map(e=>text(e.subject)).filter(Boolean))){subjectMedians[subject]=median((events||[]).filter(e=>e.isAttempted&&text(e.subject)===subject).map(e=>num(e.activeSeconds)))}

  const topics=[];
  for(const subtopicId of topicIds){
    const bankRows=activeBank.filter(q=>text(q.subtopic_id)===subtopicId);
    const eventRows=(events||[]).filter(e=>text(e.subtopicId)===subtopicId);
    const attemptedRows=eventRows.filter(e=>e.isAttempted);
    const correct=attemptedRows.filter(e=>e.isCorrect).length;
    const bankIds=new Set(bankRows.map(q=>text(q.id)));
    const uniqueFaced=new Set(eventRows.map(e=>text(e.bankQuestionId)).filter(id=>bankIds.has(id)));
    const stats=attemptStats(eventRows);
    const diff=aggregateDifficulty(eventRows);
    const trans=transitions(eventRows);
    const topicTitle=text(eventRows.find(e=>text(e.topicTitle))?.topicTitle)||text(bankRows.find(q=>text(q.topicTitle))?.topicTitle)||subtopicId||'Unmapped';
    const subject=text(eventRows.find(e=>text(e.subject))?.subject)||text(bankRows.find(q=>text(q.subject))?.subject)||'Unknown';
    const times=attemptedRows.map(e=>num(e.activeSeconds)).filter(v=>v>0);
    const topicAvg=avg(times),subjectMedian=num(subjectMedians[subject]);
    const speedIssue=times.length>=3&&subjectMedian>0&&topicAvg>=subjectMedian*1.5;
    const base={
      subtopicId,topicTitle,subject,
      activeBankQuestions:bankRows.length,
      uniqueBankQuestionsFaced:uniqueFaced.size,
      coveragePct:pct(uniqueFaced.size,bankRows.length),
      attempted:attemptedRows.length,
      correct,
      accuracy:pct(correct,attemptedRows.length),
      difficulty:diff,
      distinctAttempts:stats.length,
      recentAccuracy:recentAccuracy(stats),
      trend:trendFor(stats),
      retentionMisses:trans.retentionMisses,
      improvementEvents:trans.improvementEvents,
      avgActiveSeconds:topicAvg,
      subjectMedianActiveSeconds:round1(subjectMedian),
      speedIssue
    };
    topics.push({...base,classification:classificationFor(base)});
  }
  topics.sort((a,b)=>a.subject.localeCompare(b.subject)||a.topicTitle.localeCompare(b.topicTitle));

  const strengths=topics.filter(t=>['Mastered','Strong'].includes(t.classification)).map(t=>makeSignal(t,'Sustained accuracy with adequate evidence.'));
  const priorityWeaknesses=topics.filter(t=>['Weak','Needs Revision'].includes(t.classification)).sort((a,b)=>a.accuracy-b.accuracy).map(t=>makeSignal(t,t.classification==='Weak'?'Sustained low accuracy.':'Revision evidence detected.'));
  const speedIssues=topics.filter(t=>t.speedIssue).map(t=>makeSignal(t,'Slower than your subject pattern.',`${t.topicTitle} — average active time ${t.avgActiveSeconds}s vs subject median ${t.subjectMedianActiveSeconds}s across ${t.attempted} attempted questions.`));
  const retentionWatch=topics.filter(t=>t.retentionMisses>0).map(t=>makeSignal(t,'Previously-correct bank questions were later missed.',`${t.topicTitle} — ${t.retentionMisses} retention miss${t.retentionMisses===1?'':'es'} detected across repeated bank-question exposure.`));
  const coverageGaps=topics.filter(t=>t.activeBankQuestions>0&&t.coveragePct<40).sort((a,b)=>a.coveragePct-b.coveragePct||(b.activeBankQuestions-b.uniqueBankQuestionsFaced)-(a.activeBankQuestions-a.uniqueBankQuestionsFaced)).map(t=>makeSignal(t,'Question Bank coverage is still low.',`${t.topicTitle} — bank coverage ${t.coveragePct}% (${t.uniqueBankQuestionsFaced}/${t.activeBankQuestions}); ${Math.max(0,t.activeBankQuestions-t.uniqueBankQuestionsFaced)} active bank questions not yet faced.`));
  const focus=[];const used=new Set();
  for(const source of [priorityWeaknesses,retentionWatch,speedIssues,coverageGaps])for(const s of source){if(focus.length>=3)break;if(used.has(s.subtopicId))continue;used.add(s.subtopicId);focus.push({...s,reason:`Next Exam Focus: ${s.reason}`})}

  return {
    summary:{
      activeBankQuestions:activeBank.length,
      uniqueBankQuestionsFaced:facedActiveIds.size,
      bankCoveragePct:pct(facedActiveIds.size,activeBank.length),
      repeatExposure,
      retentionMisses:allTransitions.retentionMisses,
      improvementEvents:allTransitions.improvementEvents
    },
    difficulty,
    topics,
    mentor:{strengths,priorityWeaknesses,speedIssues,retentionWatch,coverageGaps,nextExamFocus:focus}
  };
}
