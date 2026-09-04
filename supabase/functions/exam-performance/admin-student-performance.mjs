import { gradeQuestions } from '../student-exam-attempt/grading-logic.mjs';

const SUBJECTS=['Physics','Chemistry','Biology'];
const text=v=>String(v??'');
const num=v=>Number(v||0);

export function buildQuestionSubjectMap({mappings=[],subtopics=[],chapters=[],units=[]}={}){
  const subById=new Map((subtopics||[]).map(x=>[text(x.id),x]));
  const chapterById=new Map((chapters||[]).map(x=>[text(x.id),x]));
  const unitById=new Map((units||[]).map(x=>[text(x.id),x]));
  const out=new Map();
  for(const row of mappings||[]){
    const sub=subById.get(text(row.subtopic_id));
    const chapter=sub&&chapterById.get(text(sub.chapter_id));
    const unit=chapter&&unitById.get(text(chapter.unit_id));
    if(unit?.subject&&SUBJECTS.includes(String(unit.subject))) out.set(text(row.question_id),String(unit.subject));
  }
  return out;
}

export function subjectsForExam({exam={},questions=[],subjectByQuestion=new Map()}={}){
  const mapped=[];
  for(const q of questions||[]){
    const subject=subjectByQuestion.get(text(q.id));
    if(subject&&SUBJECTS.includes(subject)&&!mapped.includes(subject))mapped.push(subject);
  }
  if(mapped.length) return SUBJECTS.filter(s=>mapped.includes(s));
  return SUBJECTS.includes(String(exam.subject))?[String(exam.subject)]:[];
}

export function buildSubjectAttempt({exam={},attempt={},questions=[],answerKeys=[],responses=[],subjectByQuestion=new Map(),subject}={}){
  if(!SUBJECTS.includes(String(subject))) return null;
  const membership=subjectsForExam({exam,questions,subjectByQuestion});
  if(!membership.includes(String(subject))) return null;
  const hasMapped=(questions||[]).some(q=>subjectByQuestion.has(text(q.id)));
  const subset=hasMapped?(questions||[]).filter(q=>subjectByQuestion.get(text(q.id))===subject):(questions||[]);
  if(!subset.length) return null;
  const ids=new Set(subset.map(q=>text(q.id)));
  const keys=(answerKeys||[]).filter(x=>ids.has(text(x.question_id)));
  const rs=(responses||[]).filter(x=>ids.has(text(x.question_id)));
  const maxMarks=subset.reduce((sum,q)=>sum+num(q.marks),0);
  const graded=gradeQuestions({questions:subset,answerKeys:keys,responses:rs,negativeMarking:Boolean(exam.negative_marking),totalMarks:maxMarks});
  return {
    exam_id:text(exam.id),exam_title:exam.title||'',subject:String(subject),
    attempt_id:text(attempt.id),attempt_no:num(attempt.attempt_no)||1,submitted_at:attempt.submitted_at||null,
    total_score:graded.summary.total_score,max_marks:maxMarks,percentage:graded.summary.percentage,
    correct_count:graded.summary.correct_count,wrong_count:graded.summary.wrong_count,unattempted_count:graded.summary.unattempted_count,
    question_count:subset.length
  };
}

function sortHistory(a,b){
  const ta=new Date(a.submitted_at||0).getTime(),tb=new Date(b.submitted_at||0).getTime();
  return ta-tb||num(a.attempt_no)-num(b.attempt_no);
}
function latestPerExam(rows){
  const map=new Map();
  for(const row of [...rows].sort(sortHistory)) map.set(text(row.exam_id),row);
  return [...map.values()];
}
function avg(rows,key='percentage'){return rows.length?rows.reduce((s,x)=>s+num(x[key]),0)/rows.length:0;}

export function buildStudentExamMonitor({eligibleExams=[],attempts=[],results=[],subjectAttempts=[],scopeRows=[]}={}){
  const resultByAttempt=new Map((results||[]).map(r=>[text(r.attempt_id),r]));
  const enriched=(subjectAttempts||[]).map(row=>({...row,resultPublished:Boolean(resultByAttempt.get(text(row.attempt_id))?.is_published)}));
  const legacyUnmapped=(eligibleExams||[])
    .filter(exam=>!Array.isArray(exam.subjects)||exam.subjects.length===0)
    .filter(exam=>['NEET','Mixed'].includes(String(exam.subject)));
  const subjects=SUBJECTS.map(subject=>{
    const setExams=(eligibleExams||[]).filter(exam=>Array.isArray(exam.subjects)&&exam.subjects.includes(subject));
    const history=enriched.filter(x=>x.subject===subject).sort(sortHistory);
    const latest=latestPerExam(history);
    const attempted=new Set(history.map(x=>text(x.exam_id))).size;
    const published=new Set(history.filter(x=>x.resultPublished).map(x=>text(x.exam_id))).size;
    const best=history.length?Math.max(...history.map(x=>num(x.percentage))):0;
    const correct=latest.reduce((s,x)=>s+num(x.correct_count),0),wrong=latest.reduce((s,x)=>s+num(x.wrong_count),0);
    return {subject,examsSet:setExams.length,examsAttempted:attempted,resultsPublished:published,average:avg(latest),best,accuracy:correct+wrong?correct/(correct+wrong)*100:0,history};
  });
  return {
    summary:{examsSet:(eligibleExams||[]).length,examsAttempted:new Set(enriched.map(x=>text(x.exam_id))).size},
    subjects,
    subjectHistory:Object.fromEntries(subjects.map(x=>[x.subject,x.history])),
    scopeRows:scopeRows||[],
    legacyUnmapped
  };
}
