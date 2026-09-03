import { normalizeSubtopicTitle, validateSplitTitles, validateMergeRequest, validateCoverage } from './admin-mapping-policy.mjs';

const positiveInt = value => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const idText = value => String(value ?? '').trim();
const bad = error => ({ ok:false, error });

export function normalizeAdminMappingAction(body = {}) {
  const action = idText(body.action);
  if (!action) return bad('Action is required.');

  if (action === 'tree' || action === 'validate') {
    const examId = idText(body.examId);
    if (!examId) return bad('Exam ID is required.');
    return { ok:true, command:{ action, examId } };
  }

  if (action === 'generate_subtopics') {
    const chapterId = positiveInt(body.chapterId);
    if (!chapterId) return bad('Valid chapter is required.');
    return { ok:true, command:{ action, chapterId } };
  }

  if (action === 'upsert_subtopic') {
    const chapterId = positiveInt(body.chapterId);
    if (!chapterId) return bad('Valid chapter is required.');
    const title = normalizeSubtopicTitle(body.title);
    if (!title.ok) return title;
    const status = idText(body.status || 'suggested').toLowerCase();
    if (!['suggested','approved'].includes(status)) return bad('Subtopic status must be suggested or approved.');
    const subtopicId = body.subtopicId == null || body.subtopicId === '' ? null : positiveInt(body.subtopicId);
    if (body.subtopicId != null && body.subtopicId !== '' && !subtopicId) return bad('Valid subtopic is required.');
    return { ok:true, command:{ action, chapterId, subtopicId, title:title.title, status } };
  }

  if (action === 'disable_subtopic') {
    const subtopicId = positiveInt(body.subtopicId);
    if (!subtopicId) return bad('Valid subtopic is required.');
    return { ok:true, command:{ action, subtopicId } };
  }

  if (action === 'split_subtopic') {
    const subtopicId = positiveInt(body.subtopicId);
    if (!subtopicId) return bad('Valid subtopic is required.');
    const split = validateSplitTitles(body.titles);
    if (!split.ok) return split;
    return { ok:true, command:{ action, subtopicId, titles:split.titles } };
  }

  if (action === 'merge_subtopics') {
    const merge = validateMergeRequest(body);
    if (!merge.ok) return merge;
    return { ok:true, command:{ action, chapterId:merge.chapterId, subtopicIds:merge.subtopicIds, title:merge.title } };
  }

  if (action === 'save_mapping') {
    const examId = idText(body.examId);
    if (!examId) return bad('Exam ID is required.');
    const subtopicId = positiveInt(body.subtopicId);
    if (!subtopicId) return bad('Valid subtopic is required.');
    const selector = idText(body.selector);
    if (!selector) return bad('Question selector is required.');
    const coverage = validateCoverage(body.coverage);
    if (!coverage.ok) return coverage;
    const mappingGroupId = idText(body.mappingGroupId) || null;
    return { ok:true, command:{ action, examId, mappingGroupId, selector, subtopicId, coverage:coverage.coverage } };
  }

  if (action === 'delete_mapping') {
    const examId = idText(body.examId);
    const mappingGroupId = idText(body.mappingGroupId);
    if (!examId || !mappingGroupId) return bad('Exam ID and mapping group are required.');
    return { ok:true, command:{ action, examId, mappingGroupId } };
  }

  return bad('Unknown action.');
}
