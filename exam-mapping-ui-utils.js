(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExamMappingUIUtils = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function mappingCoverageLabel(summary = {}) {
    const mapped = Number(summary.mappedQuestions || 0);
    const total = Number(summary.totalQuestions || 0);
    const issues = list(summary.errors).length;
    if (total > 0 && mapped === total && issues === 0) {
      return `Mapped ${mapped}/${total} • Ready to Publish`;
    }
    return `Mapped ${mapped}/${total} • ${issues} ${issues === 1 ? 'issue' : 'issues'}`;
  }

  function availableSubtopics(tree, unitId, chapterId) {
    const unit = list(tree).find(item => String(item.id) === String(unitId));
    if (!unit) return [];
    const chapter = list(unit.chapters).find(item => String(item.id) === String(chapterId));
    if (!chapter) return [];
    return list(chapter.subtopics).filter(item => item.status === 'approved');
  }

  function mappingRowText(group = {}, lookup = {}) {
    const subtopic = lookup.subtopics?.get(group.subtopic_id) || lookup.subtopics?.get(String(group.subtopic_id));
    const chapter = subtopic && (lookup.chapters?.get(subtopic.chapter_id) || lookup.chapters?.get(String(subtopic.chapter_id)));
    const unit = chapter && (lookup.units?.get(chapter.unit_id) || lookup.units?.get(String(chapter.unit_id)));
    const selector = String(group.selector_text || '').replace(/^Q/i, '');
    const hierarchy = [unit?.subject, unit?.unit_title, chapter?.topic_title, subtopic?.subtopic_title]
      .filter(Boolean)
      .join(' → ');
    return `Q${selector} • ${hierarchy || 'Unknown syllabus scope'} • ${String(group.coverage || '').toUpperCase()}`;
  }

  function mappingStatusModel(summary = {}) {
    const invalid =
      list(summary.invalidQuestionNos).length +
      list(summary.duplicateQuestionIds).length +
      list(summary.invalidSubtopicQuestionNos).length +
      list(summary.answerKeyMissingQuestionNos).length;
    return {
      total: Number(summary.totalQuestions || 0),
      mapped: Number(summary.mappedQuestions || 0),
      unmapped: list(summary.unmappedQuestionNos).length,
      invalid,
      marks: summary.marksMatch === true ? 'MATCH' : 'MISMATCH',
      ready: Number(summary.totalQuestions || 0) > 0 && list(summary.errors).length === 0
    };
  }

  function saveMappingPayload({ examId, mappingGroupId, selector, subtopicId, coverage }) {
    const payload = {
      action: 'save_mapping',
      examId: String(examId || ''),
      selector: String(selector || '').trim(),
      subtopicId: Number(subtopicId),
      coverage: String(coverage || '').toLowerCase()
    };
    if (mappingGroupId) payload.mappingGroupId = String(mappingGroupId);
    return payload;
  }

  function subtopicPayload(kind, data = {}) {
    if (kind === 'disable') {
      return { action: 'disable_subtopic', subtopicId: Number(data.subtopicId) };
    }
    if (kind === 'generate') {
      return { action: 'generate_subtopics', chapterId: Number(data.chapterId) };
    }
    if (kind === 'split') {
      return { action: 'split_subtopic', subtopicId: Number(data.subtopicId), titles: list(data.titles).map(x => String(x).trim()).filter(Boolean) };
    }
    if (kind === 'merge') {
      return { action: 'merge_subtopics', chapterId: Number(data.chapterId), subtopicIds: list(data.subtopicIds).map(Number), title: String(data.title || '').trim() };
    }
    return {
      action: 'upsert_subtopic',
      chapterId: Number(data.chapterId),
      ...(data.subtopicId ? { subtopicId: Number(data.subtopicId) } : {}),
      title: String(data.title || '').trim(),
      status: kind === 'approve' ? 'approved' : String(data.status || 'suggested')
    };
  }

  return { mappingCoverageLabel, availableSubtopics, mappingRowText, mappingStatusModel, saveMappingPayload, subtopicPayload };
});