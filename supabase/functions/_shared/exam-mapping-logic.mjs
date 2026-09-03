function fail(error) {
  return { ok: false, numbers: [], normalized: '', error };
}

function compressNumbers(numbers) {
  if (!numbers.length) return '';
  const parts = [];
  let start = numbers[0];
  let prev = numbers[0];
  for (let i = 1; i <= numbers.length; i++) {
    const current = numbers[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return parts.join(',');
}

export function parseQuestionSelector(selector) {
  if (typeof selector !== 'string' || !selector.trim()) return fail('Question selector is required.');
  const tokens = selector.split(',');
  if (tokens.some(token => !token.trim())) return fail('Selector contains an empty question token.');

  const seen = new Set();
  const numbers = [];
  const tokenPattern = /^\s*[Qq]?\s*(\d+)\s*(?:-\s*[Qq]?\s*(\d+)\s*)?$/;

  for (const token of tokens) {
    const match = token.match(tokenPattern);
    if (!match) return fail(`Invalid selector token: ${token.trim()}`);
    const start = Number(match[1]);
    const end = match[2] == null ? start : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end <= 0) {
      return fail('Question numbers must be positive integers.');
    }
    if (end < start) return fail(`Reversed question range: ${start}-${end}`);
    for (let n = start; n <= end; n++) {
      if (seen.has(n)) return fail(`Question ${n} appears more than once in the selector.`);
      seen.add(n);
      numbers.push(n);
    }
  }

  numbers.sort((a, b) => a - b);
  return { ok: true, numbers, normalized: compressNumbers(numbers) };
}

function questionForNumber(questionByNo, number) {
  if (questionByNo instanceof Map) return questionByNo.get(number) ?? questionByNo.get(String(number));
  if (questionByNo && typeof questionByNo === 'object') return questionByNo[number] ?? questionByNo[String(number)];
  return undefined;
}

export function buildQuestionMappings({ selector, questionByNo, mappingGroupId, examId, subtopicId }) {
  const parsed = parseQuestionSelector(selector);
  if (!parsed.ok) return { ok: false, rows: [], error: parsed.error };

  const rows = [];
  for (const number of parsed.numbers) {
    const question = questionForNumber(questionByNo, number);
    const questionId = typeof question === 'string' ? question : question?.id;
    if (!questionId) return { ok: false, rows: [], error: `Question ${number} is not present in this exam.` };
    rows.push({
      question_id: String(questionId),
      exam_id: examId,
      mapping_group_id: mappingGroupId,
      subtopic_id: subtopicId
    });
  }

  return { ok: true, rows, normalized: parsed.normalized, numbers: parsed.numbers };
}

function numericQuestionNo(question) {
  return Number.isFinite(Number(question?.question_no)) ? Number(question.question_no) : null;
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  });
}

export function validateExamMapping({
  questions = [],
  answerKeys = [],
  mappingRows = [],
  approvedSubtopicIds = [],
  totalMarks = 0
} = {}) {
  const questionById = new Map((questions || []).map(q => [String(q.id), q]));
  const examIds = new Set((questions || []).map(q => q.exam_id).filter(Boolean).map(String));
  const approved = new Set((approvedSubtopicIds || []).map(String));
  const keyMap = new Map((answerKeys || []).map(k => [String(k.question_id), String(k.correct_option || '').toUpperCase()]));
  const mappingCount = new Map();
  const validMappedIds = new Set();
  const invalidQuestionNos = [];
  const invalidSubtopicQuestionNos = [];

  for (const row of mappingRows || []) {
    const questionId = String(row.question_id ?? '');
    const question = questionById.get(questionId);
    const foreignExam = row.exam_id != null && examIds.size === 1 && !examIds.has(String(row.exam_id));
    if (!question || foreignExam) {
      invalidQuestionNos.push(Number.isFinite(Number(row.question_no)) ? Number(row.question_no) : questionId);
      continue;
    }

    mappingCount.set(questionId, (mappingCount.get(questionId) || 0) + 1);
    validMappedIds.add(questionId);
    if (!approved.has(String(row.subtopic_id))) {
      const no = numericQuestionNo(question);
      invalidSubtopicQuestionNos.push(no ?? questionId);
    }
  }

  const duplicateQuestionIds = sortedUnique([...mappingCount.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  const unmappedQuestionNos = sortedUnique((questions || [])
    .filter(q => !validMappedIds.has(String(q.id)))
    .map(q => numericQuestionNo(q) ?? String(q.id)));
  const answerKeyMissingQuestionNos = sortedUnique((questions || [])
    .filter(q => !['A','B','C','D'].includes(keyMap.get(String(q.id))))
    .map(q => numericQuestionNo(q) ?? String(q.id)));

  const questionMarksTotal = (questions || []).reduce((sum, q) => sum + Number(q.marks || 0), 0);
  const expectedTotalMarks = Number(totalMarks || 0);
  const marksMatch = Math.abs(questionMarksTotal - expectedTotalMarks) < 1e-9;

  const errors = [];
  if (!questions.length) errors.push('Exam has no questions.');
  if (unmappedQuestionNos.length) errors.push(`${unmappedQuestionNos.length} question(s) are unmapped.`);
  if (invalidQuestionNos.length) errors.push(`${invalidQuestionNos.length} mapping row(s) point outside this exam.`);
  if (duplicateQuestionIds.length) errors.push(`${duplicateQuestionIds.length} question(s) have overlapping mappings.`);
  if (invalidSubtopicQuestionNos.length) errors.push(`${invalidSubtopicQuestionNos.length} question(s) use an unapproved subtopic.`);
  if (answerKeyMissingQuestionNos.length) errors.push(`${answerKeyMissingQuestionNos.length} question(s) are missing a valid answer key.`);
  if (!marksMatch) errors.push(`Question marks total ${questionMarksTotal} does not match exam total ${expectedTotalMarks}.`);

  return {
    ok: errors.length === 0,
    totalQuestions: (questions || []).length,
    mappedQuestions: validMappedIds.size,
    unmappedQuestionNos,
    invalidQuestionNos: sortedUnique(invalidQuestionNos),
    duplicateQuestionIds,
    invalidSubtopicQuestionNos: sortedUnique(invalidSubtopicQuestionNos),
    answerKeyMissingQuestionNos,
    questionMarksTotal,
    totalMarks: expectedTotalMarks,
    marksMatch,
    errors
  };
}
