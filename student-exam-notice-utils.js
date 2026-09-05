(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SGAExamNotices=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TYPE_LABELS=Object.freeze({daily:'Daily Exam',unit:'Unit Exam',monthly:'Monthly Exam'});

  function clean(value){return String(value??'').trim()}
  function formatDate(value){
    const text=clean(value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return '';
    const date=new Date(`${text}T00:00:00Z`);
    if(Number.isNaN(date.getTime()))return '';
    return date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  }
  function typeLabel(exam){
    const type=clean(exam?.exam_type).toLowerCase();
    return TYPE_LABELS[type]||clean(exam?.subject)||'Exam';
  }
  function buildExamNotice(exam={}){
    const id=clean(exam.id);
    const type=typeLabel(exam);
    const date=formatDate(exam.exam_date);
    const code=clean(exam.exam_code);
    const subject=clean(exam.subject);
    const syllabus=clean(exam.syllabus);
    const questions=Number(exam.question_count||exam.expected_questions||0);
    const duration=Number(exam.duration_minutes||0);
    const marks=Number(exam.total_marks||0);
    const canStart=Boolean(exam.can_start);
    const attemptCount=Math.max(0,Number(exam.attempt_count)||0);
    const maxAttempts=Math.max(1,Number(exam.max_attempts)||1);
    const parts=[type];
    if(subject&&subject!==type)parts.push(subject);
    if(code)parts.push(`Code: ${code}`);
    if(date)parts.push(`Date: ${date}`);
    if(questions>0)parts.push(`${questions} questions`);
    if(duration>0)parts.push(`${duration} min`);
    if(marks>0)parts.push(`${marks} marks`);
    if(syllabus)parts.push(`Syllabus: ${syllabus}`);
    if(!canStart)parts.push(`Completed / attempts used: ${attemptCount}/${maxAttempts}`);
    return {
      kind:'exam',
      id:`exam:${id}`,
      title:clean(exam.title)||type,
      message:parts.join(' • '),
      audience:'exam',
      published_at:clean(exam.exam_date)||clean(exam.created_at)||null,
      created_at:clean(exam.created_at)||clean(exam.exam_date)||null,
      poster_url:null,
      actionHref:canStart&&id?`student-examinations.html?exam=${encodeURIComponent(id)}`:'student-examinations.html',
      actionLabel:canStart?'OPEN EXAM':'VIEW EXAM'
    };
  }

  return {buildExamNotice,formatDate,typeLabel};
});
