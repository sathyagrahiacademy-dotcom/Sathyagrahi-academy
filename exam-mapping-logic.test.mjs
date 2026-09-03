import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuestionSelector,
  buildQuestionMappings,
  validateExamMapping
} from './supabase/functions/_shared/exam-mapping-logic.mjs';

test('parses a contiguous selector', () => {
  const out = parseQuestionSelector('1-10');
  assert.equal(out.ok, true);
  assert.deepEqual(out.numbers, [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(out.normalized, '1-10');
});

test('parses mixed Q-prefixed selector and normalizes it', () => {
  const out = parseQuestionSelector('Q1-Q3, Q7, 10-11');
  assert.equal(out.ok, true);
  assert.deepEqual(out.numbers, [1,2,3,7,10,11]);
  assert.equal(out.normalized, '1-3,7,10-11');
});

test('rejects a reversed range', () => {
  assert.equal(parseQuestionSelector('8-3').ok, false);
});

test('rejects duplicate question numbers inside one selector', () => {
  assert.equal(parseQuestionSelector('1-3,3').ok, false);
});

test('rejects empty selector tokens', () => {
  assert.equal(parseQuestionSelector('1,,2').ok, false);
});

test('builds UUID-backed rows from a selector', () => {
  const questionByNo = new Map([
    [1, { id: 'q1' }],
    [2, { id: 'q2' }],
    [3, { id: 'q3' }]
  ]);
  const out = buildQuestionMappings({
    selector: '1-2',
    questionByNo,
    mappingGroupId: 'g1',
    examId: 'e1',
    subtopicId: 77
  });
  assert.equal(out.ok, true);
  assert.deepEqual(out.rows, [
    { question_id: 'q1', exam_id: 'e1', mapping_group_id: 'g1', subtopic_id: 77 },
    { question_id: 'q2', exam_id: 'e1', mapping_group_id: 'g1', subtopic_id: 77 }
  ]);
});

test('rejects selector question numbers not present in the exam', () => {
  const out = buildQuestionMappings({
    selector: '1,4',
    questionByNo: new Map([[1, { id: 'q1' }]]),
    mappingGroupId: 'g1',
    examId: 'e1',
    subtopicId: 77
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /question 4/i);
});

const baseQuestions = [
  { id: 'q1', question_no: 1, exam_id: 'e1', marks: 4 },
  { id: 'q2', question_no: 2, exam_id: 'e1', marks: 4 },
  { id: 'q3', question_no: 3, exam_id: 'e1', marks: 4 }
];
const baseKeys = [
  { question_id: 'q1', correct_option: 'A' },
  { question_id: 'q2', correct_option: 'B' },
  { question_id: 'q3', correct_option: 'C' }
];
const baseMappings = [
  { question_id: 'q1', exam_id: 'e1', subtopic_id: 10 },
  { question_id: 'q2', exam_id: 'e1', subtopic_id: 10 },
  { question_id: 'q3', exam_id: 'e1', subtopic_id: 11 }
];

test('accepts a fully mapped valid exam', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: baseMappings,
    approvedSubtopicIds: [10,11],
    totalMarks: 12
  });
  assert.equal(out.ok, true);
  assert.equal(out.totalQuestions, 3);
  assert.equal(out.mappedQuestions, 3);
  assert.deepEqual(out.errors, []);
  assert.equal(out.marksMatch, true);
});

test('reports unmapped questions', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: baseMappings.slice(0,2),
    approvedSubtopicIds: [10,11],
    totalMarks: 12
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.unmappedQuestionNos, [3]);
});

test('reports mapping rows that point outside the exam', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: [...baseMappings, { question_id: 'other', question_no: 99, exam_id: 'e2', subtopic_id: 10 }],
    approvedSubtopicIds: [10,11],
    totalMarks: 12
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.invalidQuestionNos, [99]);
});

test('reports duplicate question mappings', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: [...baseMappings, { question_id: 'q2', exam_id: 'e1', subtopic_id: 11 }],
    approvedSubtopicIds: [10,11],
    totalMarks: 12
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.duplicateQuestionIds, ['q2']);
});

test('reports mappings to unapproved subtopics', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: baseMappings,
    approvedSubtopicIds: [10],
    totalMarks: 12
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.invalidSubtopicQuestionNos, [3]);
});

test('reports missing or invalid answer keys', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys.slice(0,2),
    mappingRows: baseMappings,
    approvedSubtopicIds: [10,11],
    totalMarks: 12
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.answerKeyMissingQuestionNos, [3]);
});

test('reports a total-marks mismatch', () => {
  const out = validateExamMapping({
    questions: baseQuestions,
    answerKeys: baseKeys,
    mappingRows: baseMappings,
    approvedSubtopicIds: [10,11],
    totalMarks: 15
  });
  assert.equal(out.ok, false);
  assert.equal(out.questionMarksTotal, 12);
  assert.equal(out.marksMatch, false);
});
