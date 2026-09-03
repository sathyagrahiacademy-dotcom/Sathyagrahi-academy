import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync('admin-exam-questions.html','utf8');

test('question page exposes the syllabus mapping card and validation metrics', () => {
  for (const id of ['mappingSummaryLabel','mappingMetricTotal','mappingMetricMapped','mappingMetricUnmapped','mappingMetricInvalid','mappingMetricMarks']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('question page exposes range, hierarchy, coverage and mapping actions', () => {
  for (const id of ['mapSelector','mapSubject','mapUnit','mapChapter','mapSubtopic','mapCoverage','saveMappingBtn','mappingRows']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('question page exposes subtopic suggestion administration and helper script', () => {
  for (const id of ['generateSuggestionsBtn','addSubtopicBtn','mergeSelectedBtn','subtopicAdminList']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /exam-mapping-ui-utils\.js/);
});