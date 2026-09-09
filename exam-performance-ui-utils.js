(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.ExamPerformanceUIUtils=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const id=v=>v==null?'':String(v);
  const num=v=>Number(v||0);
  const normalizeESequence=v=>Math.max(1,Math.trunc(num(v)||1));
  const seqSort=(a,b)=>normalizeESequence(a.exam_sequence)-normalizeESequence(b.exam_sequence)||new Date(a.submitted_at||0)-new Date(b.submitted_at||0);
  function scopeKey(row){return `${row.scope_level||''}:${id(row.unit_id)}:${id(row.chapter_id)}:${id(row.subtopic_id)}`;}
  function groupPerformanceByScope(rows=[]){const map=new Map();for(const row of rows||[]){const key=scopeKey(row);if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return [...map.entries()].map(([key,list])=>({key,rows:list.slice().sort(seqSort)}));}
  function formatEHistoryRow(row={}){const pct=Number(row.percentage||0);const score=`${num(row.earned_marks)}/${num(row.max_marks)}`;return `E${normalizeESequence(row.exam_sequence)} • ${String(row.coverage||'partial').toUpperCase()} • ${num(row.question_count)}Q • ${score} • ${pct.toFixed(1)}%`;}
  function eChipLabel(row={}){return `E${normalizeESequence(row.exam_sequence)}`;}
  function filterScopeRows(rows=[],filters={}){const checks=[['studentId','student_id'],['subject','subject'],['unitId','unit_id'],['chapterId','chapter_id'],['subtopicId','subtopic_id'],['examId','exam_id'],['coverage','coverage']];return (rows||[]).filter(row=>checks.every(([fk,rk])=>filters[fk]==null||filters[fk]===''||String(filters[fk]).toLowerCase()==='all'||id(row[rk]).toLowerCase()===id(filters[fk]).toLowerCase()));}
  function ensure(map,key,make){if(!map.has(key))map.set(key,make());return map.get(key);}
  function buildStudentHierarchy(rows=[]){const subjects=new Map();for(const row of (rows||[]).slice().sort(seqSort)){const subjectName=row.subject||'Other';const subject=ensure(subjects,subjectName,()=>({subject:subjectName,units:[],_units:new Map()}));const unitKey=id(row.unit_id);if(!unitKey)continue;const unit=ensure(subject._units,unitKey,()=>{const x={id:row.unit_id,title:row.unit_title||`Unit ${row.unit_id}`,history:[],chapters:[],_chapters:new Map()};subject.units.push(x);return x});if(row.scope_level==='unit')unit.history.push(row);const chapterKey=id(row.chapter_id);if(!chapterKey)continue;const chapter=ensure(unit._chapters,chapterKey,()=>{const x={id:row.chapter_id,title:row.chapter_title||`Chapter ${row.chapter_id}`,history:[],subtopics:[],_subtopics:new Map()};unit.chapters.push(x);return x});if(row.scope_level==='chapter')chapter.history.push(row);const subtopicKey=id(row.subtopic_id);if(!subtopicKey)continue;const subtopic=ensure(chapter._subtopics,subtopicKey,()=>{const x={id:row.subtopic_id,title:row.subtopic_title||`Topic ${row.subtopic_id}`,history:[]};chapter.subtopics.push(x);return x});if(row.scope_level==='topic')subtopic.history.push(row);}const out=[...subjects.values()];for(const s of out){delete s._units;for(const u of s.units){delete u._chapters;u.history.sort(seqSort);for(const c of u.chapters){delete c._subtopics;c.history.sort(seqSort);for(const t of c.subtopics)t.history.sort(seqSort);}}}return out;}
  function subjectCardModel(row={}){return{subject:String(row.subject||''),set:num(row.examsSet),attempted:num(row.examsAttempted),published:num(row.resultsPublished),average:Number(row.average||0),best:Number(row.best||0)};}
  function sortAttemptHistory(rows=[]){return (rows||[]).slice().sort((a,b)=>new Date(a.submitted_at||0)-new Date(b.submitted_at||0)||num(a.attempt_no)-num(b.attempt_no));}
  function attemptLabel(row={}){return `Attempt ${num(row.attempt_no)||1}`;}
  function subjectScopeHierarchy(rows=[],subject=''){return buildStudentHierarchy((rows||[]).filter(r=>String(r.subject||'')===String(subject)));}
  function scopeParts(row={}){
    const unit=id(row.unit_title).trim(),chapter=id(row.chapter_title).trim(),topic=id(row.subtopic_title).trim();
    const level=id(row.scope_level).toLowerCase();
    if(level==='topic')return [unit,chapter,topic].filter(Boolean);
    if(level==='chapter')return [unit,chapter].filter(Boolean);
    return [unit].filter(Boolean);
  }
  function eDialogModel(scopeRow={},subjectHistory=[]){
    const attemptId=id(scopeRow.attempt_id);
    const exact=(subjectHistory||[]).find(row=>id(row.attempt_id)===attemptId)||{};
    const parts=scopeParts(scopeRow);
    return{
      attemptId,examId:id(scopeRow.exam_id||exact.exam_id),
      examTitle:id(exact.exam_title||scopeRow.exam_title||'Exam'),
      examCode:id(exact.exam_code||scopeRow.exam_code),examDate:exact.exam_date||scopeRow.exam_date||null,
      attemptNo:num(exact.attempt_no)||1,questionCount:num(scopeRow.question_count),
      earnedMarks:num(scopeRow.earned_marks),maxMarks:num(scopeRow.max_marks),percentage:Number(scopeRow.percentage||0),
      correct:num(scopeRow.correct_count),wrong:num(scopeRow.wrong_count),unattempted:num(scopeRow.unattempted_count),
      resultPublished:Boolean(exact.resultPublished),coverage:id(scopeRow.coverage||'partial'),
      scopeLevel:id(scopeRow.scope_level||'unit'),scopeLabel:parts.at(-1)||'Scope',scopePath:parts.join(' → '),
      eLabel:eChipLabel(scopeRow)
    };
  }
  return{scopeKey,groupPerformanceByScope,formatEHistoryRow,eChipLabel,eDialogModel,normalizeESequence,filterScopeRows,buildStudentHierarchy,subjectCardModel,sortAttemptHistory,attemptLabel,subjectScopeHierarchy};
});