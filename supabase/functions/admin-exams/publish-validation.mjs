import { templateForExamType, validateExamTemplateCounts } from '../_shared/exam-intelligence-policy.mjs'

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
