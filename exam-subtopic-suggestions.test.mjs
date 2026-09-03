import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestSubtopics } from './supabase/functions/admin-exam-mapping/subtopic-suggestions.mjs';
import { normalizeSubtopicTitle, validateSplitTitles, validateMergeRequest, validateCoverage } from './supabase/functions/admin-exam-mapping/admin-mapping-policy.mjs';

test('suggests stable subtopics from official detail', () => {
  const out = suggestSubtopics('Gametogenesis; Menstrual Cycle; Fertilisation, implantation, pregnancy and placenta; Parturition; Lactation.');
  assert.ok(out.includes('Gametogenesis'));
  assert.ok(out.includes('Menstrual Cycle'));
  assert.ok(out.some(x => /fertilisation/i.test(x)));
  assert.equal(new Set(out.map(x => x.toLowerCase())).size, out.length);
});

test('empty official detail returns no suggestions', () => {
  assert.deepEqual(suggestSubtopics(null), []);
  assert.deepEqual(suggestSubtopics('   '), []);
});

test('normalizes bullets, whitespace and duplicate clauses', () => {
  const out = suggestSubtopics('1.  Menstrual   Cycle;\n• Fertilisation; menstrual cycle; 2) Implantation.');
  assert.deepEqual(out, ['Menstrual Cycle','Fertilisation','Implantation']);
});

test('subtopic title policy trims and rejects empty values', () => {
  assert.deepEqual(normalizeSubtopicTitle('  Menstrual   Cycle  '), { ok:true, title:'Menstrual Cycle' });
  assert.equal(normalizeSubtopicTitle('  ').ok, false);
});

test('split policy requires two distinct replacement titles', () => {
  assert.equal(validateSplitTitles(['A']).ok, false);
  assert.equal(validateSplitTitles(['A','a']).ok, false);
  assert.deepEqual(validateSplitTitles(['  A  ',' B ']), { ok:true, titles:['A','B'] });
});

test('merge policy requires one chapter and at least two distinct sources', () => {
  assert.equal(validateMergeRequest({chapterId:null,subtopicIds:[1,2],title:'X'}).ok, false);
  assert.equal(validateMergeRequest({chapterId:1,subtopicIds:[2],title:'X'}).ok, false);
  assert.equal(validateMergeRequest({chapterId:1,subtopicIds:[2,2],title:'X'}).ok, false);
  assert.deepEqual(validateMergeRequest({chapterId:1,subtopicIds:[2,3],title:'  Combined  '}), { ok:true, chapterId:1, subtopicIds:['2','3'], title:'Combined' });
});

test('coverage policy accepts only full or partial', () => {
  assert.deepEqual(validateCoverage('FULL'), { ok:true, coverage:'full' });
  assert.equal(validateCoverage('other').ok, false);
});
