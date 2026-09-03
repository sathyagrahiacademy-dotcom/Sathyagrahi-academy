import { gradeQuestions } from './grading-logic.mjs';

const id = value => String(value ?? '');
const num = value => Number(value);

function mapById(rows = []) {
  const out = new Map();
  for (const row of rows || []) out.set(id(row.id), row);
  return out;
}

function approvedMap(input, subtopics) {
  const out = new Map();
  if (input instanceof Map) {
    for (const [k, values] of input.entries()) out.set(id(k), new Set((values || []).map(id)));
    return out;
  }
  if (input && typeof input === 'object') {
    for (const [k, values] of Object.entries(input)) out.set(id(k), new Set((values || []).map(id)));
    return out;
  }
  for (const subtopic of subtopics || []) {
    if (subtopic.status && subtopic.status !== 'approved') continue;
    const key = id(subtopic.chapter_id);
    if (!out.has(key)) out.set(key, new Set());
    out.get(key).add(id(subtopic.id));
  }
  return out;
}

function summaryFromGrades(grades) {
  let earned = 0, max = 0, correct = 0, wrong = 0, unattempted = 0;
  for (const grade of grades) {
    earned += Number(grade.earned_marks || 0);
    max += Number(grade.max_marks || 0);
    if (grade.state === 'correct') correct += 1;
    else if (grade.state === 'wrong') wrong += 1;
    else unattempted += 1;
  }
  return {
    question_count: grades.length,
    max_marks: max,
    earned_marks: earned,
    correct_count: correct,
    wrong_count: wrong,
    unattempted_count: unattempted,
    percentage: max > 0 ? (earned / max) * 100 : 0
  };
}

function uniqueGrades(questionIds, gradeMap) {
  const seen = new Set(), rows = [];
  for (const qid of questionIds) {
    const key = id(qid);
    if (seen.has(key)) continue;
    seen.add(key);
    const grade = gradeMap.get(key);
    if (grade) rows.push(grade);
  }
  return rows;
}

export function buildScopePerformance({
  attemptId, examId, studentId,
  questions = [], answerKeys = [], responses = [],
  mappings = [], mappingGroups = [], subtopics = [], chapters = [], units = [],
  approvedSubtopicsByChapter,
  negativeMarking = true
} = {}) {
  if (!(mappings || []).length) return { rows: [], mapped: false };

  const totalMarks = (questions || []).reduce((sum, q) => sum + Number(q?.marks || 0), 0);
  const graded = gradeQuestions({ questions, answerKeys, responses, negativeMarking, totalMarks });
  const gradeMap = new Map(graded.questionGrades.map(row => [id(row.question_id), row]));
  const groupMap = mapById(mappingGroups);
  const subtopicMap = mapById(subtopics);
  const chapterMap = mapById(chapters);
  const unitMap = mapById(units);
  const approvedByChapter = approvedMap(approvedSubtopicsByChapter, subtopics);

  const topicQuestionIds = new Map();
  const topicGroupIds = new Map();
  for (const mapping of mappings || []) {
    const subtopicId = id(mapping.subtopic_id);
    if (!subtopicId || !subtopicMap.has(subtopicId)) continue;
    if (!topicQuestionIds.has(subtopicId)) topicQuestionIds.set(subtopicId, []);
    topicQuestionIds.get(subtopicId).push(id(mapping.question_id));
    if (!topicGroupIds.has(subtopicId)) topicGroupIds.set(subtopicId, new Set());
    if (mapping.mapping_group_id != null) topicGroupIds.get(subtopicId).add(id(mapping.mapping_group_id));
  }

  const rows = [];
  const topicRows = new Map();
  for (const [subtopicId, questionIds] of topicQuestionIds.entries()) {
    const subtopic = subtopicMap.get(subtopicId);
    const chapter = chapterMap.get(id(subtopic?.chapter_id));
    if (!chapter) continue;
    const unitId = id(chapter.unit_id);
    if (!unitMap.has(unitId)) continue;
    const groups = [...(topicGroupIds.get(subtopicId) || [])].map(gid => groupMap.get(gid)).filter(Boolean);
    const coverage = groups.length > 0 && groups.every(group => String(group.coverage).toLowerCase() === 'full') ? 'full' : 'partial';
    const stats = summaryFromGrades(uniqueGrades(questionIds, gradeMap));
    const row = {
      attempt_id: attemptId,
      exam_id: examId,
      student_id: studentId,
      scope_level: 'topic',
      unit_id: num(unitId),
      chapter_id: num(chapter.id),
      subtopic_id: num(subtopic.id),
      coverage,
      ...stats
    };
    rows.push(row);
    topicRows.set(subtopicId, { row, questionIds: [...new Set(questionIds.map(id))] });
  }

  const chapterRows = new Map();
  for (const chapter of chapters || []) {
    const chapterId = id(chapter.id);
    const descendantTopicIds = [...topicRows.keys()].filter(sid => id(subtopicMap.get(sid)?.chapter_id) === chapterId);
    if (!descendantTopicIds.length) continue;
    const questionIds = descendantTopicIds.flatMap(sid => topicRows.get(sid).questionIds);
    const required = approvedByChapter.get(chapterId) || new Set();
    const coverage = required.size > 0 && [...required].every(sid => topicRows.has(sid) && topicRows.get(sid).row.coverage === 'full') ? 'full' : 'partial';
    const stats = summaryFromGrades(uniqueGrades(questionIds, gradeMap));
    const row = {
      attempt_id: attemptId,
      exam_id: examId,
      student_id: studentId,
      scope_level: 'chapter',
      unit_id: num(chapter.unit_id),
      chapter_id: num(chapter.id),
      subtopic_id: null,
      coverage,
      ...stats
    };
    rows.push(row);
    chapterRows.set(chapterId, { row, questionIds: [...new Set(questionIds.map(id))] });
  }

  for (const unit of units || []) {
    const unitId = id(unit.id);
    const descendantChapterIds = [...chapterRows.keys()].filter(cid => id(chapterMap.get(cid)?.unit_id) === unitId);
    if (!descendantChapterIds.length) continue;
    const questionIds = descendantChapterIds.flatMap(cid => chapterRows.get(cid).questionIds);
    const relevantChapterIds = (chapters || [])
      .filter(chapter => id(chapter.unit_id) === unitId && (approvedByChapter.get(id(chapter.id))?.size || 0) > 0)
      .map(chapter => id(chapter.id));
    const coverage = relevantChapterIds.length > 0 && relevantChapterIds.every(cid => chapterRows.has(cid) && chapterRows.get(cid).row.coverage === 'full') ? 'full' : 'partial';
    const stats = summaryFromGrades(uniqueGrades(questionIds, gradeMap));
    rows.push({
      attempt_id: attemptId,
      exam_id: examId,
      student_id: studentId,
      scope_level: 'unit',
      unit_id: num(unit.id),
      chapter_id: null,
      subtopic_id: null,
      coverage,
      ...stats
    });
  }

  return { rows, mapped: rows.length > 0, grading: graded };
}
