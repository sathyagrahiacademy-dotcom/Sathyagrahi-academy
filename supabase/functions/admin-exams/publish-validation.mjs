import { templateForExamType, validateExamTemplateCounts } from '../_shared/exam-intelligence-policy.mjs'

function blueprintIssue(code,message,target){
  return {code,message,target}
}

function countValue(map,key){
  return Number(map?.[key]||0)
}

export function validateMasterBlueprint({
  exam=null,
  mappingValidation=null,
  plannedSubjectCounts=null,
  actualSubjectCounts=null,
  scopeIssues=[]
}={}) {
  const expectedQuestions=Number(exam?.expected_questions||0)
  const expectedMarks=expectedQuestions*4
  const totalQuestions=Number(mappingValidation?.totalQuestions||0)
  const questionMarksTotal=Number(mappingValidation?.questionMarksTotal||0)
  const examTotalMarks=Number(exam?.total_marks||0)
  const missingKeys=Array.isArray(mappingValidation?.answerKeyMissingQuestionNos)?mappingValidation.answerKeyMissingQuestionNos:[]
  const unmapped=Array.isArray(mappingValidation?.unmappedQuestionNos)?mappingValidation.unmappedQuestionNos:[]
  const invalidMappings=Array.isArray(mappingValidation?.invalidQuestionNos)?mappingValidation.invalidQuestionNos:[]
  const duplicateMappings=Array.isArray(mappingValidation?.duplicateQuestionIds)?mappingValidation.duplicateQuestionIds:[]
  const unapprovedMappings=Array.isArray(mappingValidation?.invalidSubtopicQuestionNos)?mappingValidation.invalidSubtopicQuestionNos:[]
  const issues=[]

  if(!Number.isInteger(expectedQuestions)||expectedQuestions<=0||totalQuestions!==expectedQuestions){
    issues.push(blueprintIssue('QUESTION_COUNT_MISMATCH',`Questions added ${totalQuestions} / expected ${expectedQuestions}.`,'QUESTIONS'))
  }

  if(expectedMarks<=0||questionMarksTotal!==expectedMarks||examTotalMarks!==expectedMarks){
    issues.push(blueprintIssue('MARKS_MISMATCH',`Question marks ${questionMarksTotal}; expected exam maximum ${expectedMarks}.`,'QUESTIONS'))
  }

  if(missingKeys.length){
    issues.push(blueprintIssue('ANSWER_KEY_MISSING',`${missingKeys.length} question(s) need a valid answer key.`,'QUESTIONS'))
  }

  const mappingIncomplete = !mappingValidation || mappingValidation.ok!==true || unmapped.length || invalidMappings.length || duplicateMappings.length || unapprovedMappings.length || Number(mappingValidation?.mappedQuestions||0)!==totalQuestions
  if(mappingIncomplete){
    const parts=[]
    if(unmapped.length)parts.push(`${unmapped.length} unmapped`)
    if(invalidMappings.length)parts.push(`${invalidMappings.length} invalid mapping row(s)`)
    if(duplicateMappings.length)parts.push(`${duplicateMappings.length} overlapping mapping(s)`)
    if(unapprovedMappings.length)parts.push(`${unapprovedMappings.length} unapproved topic mapping(s)`)
    issues.push(blueprintIssue('MAPPING_INCOMPLETE',parts.length?parts.join(' • '):'Every question must have one approved syllabus mapping.','QUESTIONS'))
  }

  const subjectDiffs=[]
  for(const subject of ['Physics','Chemistry','Biology']){
    const planned=countValue(plannedSubjectCounts,subject)
    const actual=countValue(actualSubjectCounts,subject)
    if(planned!==actual)subjectDiffs.push(`${subject}: ${actual}/${planned}`)
  }
  if(subjectDiffs.length){
    issues.push(blueprintIssue('SUBJECT_PLAN_MISMATCH',`Actual / planned question counts — ${subjectDiffs.join(' • ')}.`,'COVERAGE'))
  }

  const normalizedScopeIssues=Array.isArray(scopeIssues)?scopeIssues.filter(Boolean):[]
  if(normalizedScopeIssues.length){
    issues.push(blueprintIssue('SCOPE_CONFLICT',normalizedScopeIssues.map(issue=>String(issue?.message||issue)).join(' • '),'COVERAGE'))
  }

  const ok=issues.length===0
  return {
    ok,
    status:ok?'EXAM READY':'ACTION REQUIRED',
    issues,
    summary:{
      expectedQuestions,
      totalQuestions,
      expectedMarks,
      questionMarksTotal,
      mappedQuestions:Number(mappingValidation?.mappedQuestions||0),
      answerKeyCount:Math.max(0,totalQuestions-missingKeys.length),
      plannedSubjectCounts:{Physics:countValue(plannedSubjectCounts,'Physics'),Chemistry:countValue(plannedSubjectCounts,'Chemistry'),Biology:countValue(plannedSubjectCounts,'Biology')},
      actualSubjectCounts:{Physics:countValue(actualSubjectCounts,'Physics'),Chemistry:countValue(actualSubjectCounts,'Chemistry'),Biology:countValue(actualSubjectCounts,'Biology')}
    }
  }
}

export function canPublishExam({ mappingValidation, exam=null, subjectCounts=null } = {}) {
  const validation = mappingValidation && typeof mappingValidation === 'object' ? mappingValidation : null;
  if (!validation || validation.ok !== true) {
    const errors = Array.isArray(validation?.errors) ? validation.errors.filter(Boolean) : [];
    const mapped = Number(validation?.mappedQuestions || 0);
    const total = Number(validation?.totalQuestions || 0);
    const detail = errors.length ? ` ${errors.join(' ')}` : '';
    return {
      ok: false,
      error: `Exam cannot be published until syllabus mapping is valid (${mapped}/${total} mapped).${detail}`.trim(),
      validation
    };
  }

  // Historical exams created before the official-type system keep their existing publish behavior.
  if (!exam?.exam_type) return { ok: true, validation };

  let template;
  try {
    template = templateForExamType(exam.exam_type);
  } catch (_) {
    return { ok:false, error:'Exam cannot be published because its official Exam Type is invalid.', validation };
  }

  const expectedQuestions=Number(exam.expected_questions);
  const durationMinutes=Number(exam.duration_minutes);
  const totalMarks=Number(exam.total_marks);
  if (expectedQuestions!==template.questions) {
    return {ok:false,error:`Exam cannot be published: official template requires ${template.questions} expected questions.`,validation};
  }
  if (durationMinutes!==template.durationMinutes) {
    return {ok:false,error:`Exam cannot be published: official template requires ${template.durationMinutes} minutes.`,validation};
  }
  if (totalMarks!==template.totalMarks) {
    return {ok:false,error:`Exam cannot be published: official template requires ${template.totalMarks} total marks.`,validation};
  }
  if (Boolean(exam.negative_marking)!==template.negativeMarking) {
    return {ok:false,error:'Exam cannot be published: official negative-marking setting does not match the exam template.',validation};
  }

  const countsGate=validateExamTemplateCounts({
    examType:exam.exam_type,
    examSubject:exam.subject,
    totalQuestions:Number(validation.totalQuestions),
    subjectCounts:subjectCounts||{}
  });
  if (!countsGate.ok) {
    return {ok:false,error:`Exam cannot be published: ${countsGate.error}.`,validation,templateValidation:countsGate};
  }

  return { ok: true, validation, templateValidation:countsGate };
}
