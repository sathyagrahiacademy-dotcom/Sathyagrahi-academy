export function canPublishExam({ mappingValidation } = {}) {
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
  return { ok: true, validation };
}
