import test from 'node:test';
import assert from 'node:assert/strict';
import uiUtils from './exam-mapping-ui-utils.js';
const { mappingCoverageLabel, availableSubtopics, mappingRowText, mappingStatusModel, saveMappingPayload, subtopicPayload, preferredMappingSelectionFromScope } = uiUtils;

test('shows ready label only for complete valid mapping', () => {
  assert.equal(
    mappingCoverageLabel({ mappedQuestions: 180, totalQuestions: 180, errors: [] }),
    'Mapped 180/180 • Ready to Publish'
  );
});

test('shows incomplete mapping count and issue count', () => {
  assert.equal(
    mappingCoverageLabel({ mappedQuestions: 176, totalQuestions: 180, errors: ['4 question(s) are unmapped.'] }),
    'Mapped 176/180 • 1 issue'
  );
});

test('returns only approved subtopics for selected unit and chapter', () => {
  const tree = [
    { id: 1, chapters: [
      { id: 11, subtopics: [
        { id: 101, subtopic_title: 'Menstrual Cycle', status: 'approved' },
        { id: 102, subtopic_title: 'Fertilisation', status: 'suggested' }
      ] },
      { id: 12, subtopics: [{ id: 103, subtopic_title: 'Placenta', status: 'approved' }] }
    ] }
  ];
  assert.deepEqual(availableSubtopics(tree, 1, 11).map(x => x.id), [101]);
  assert.deepEqual(availableSubtopics(tree, 1, 99), []);
});

test('formats a mapping row with hierarchy and coverage', () => {
  const lookup = {
    subtopics: new Map([[101, { subtopic_title: 'Menstrual Cycle', chapter_id: 11 }]]),
    chapters: new Map([[11, { topic_title: 'Human Reproduction', unit_id: 1 }]]),
    units: new Map([[1, { unit_title: 'Reproduction', subject: 'Biology' }]])
  };
  assert.equal(
    mappingRowText({ selector_text: '1-10,17', subtopic_id: 101, coverage: 'partial' }, lookup),
    'Q1-10,17 • Biology → Reproduction → Human Reproduction → Menstrual Cycle • PARTIAL'
  );
});

test('builds mapping status metrics without guessing readiness', () => {
  assert.deepEqual(
    mappingStatusModel({
      totalQuestions: 180,
      mappedQuestions: 176,
      unmappedQuestionNos: [177,178,179,180],
      invalidQuestionNos: [],
      duplicateQuestionIds: ['q5'],
      invalidSubtopicQuestionNos: [],
      answerKeyMissingQuestionNos: [],
      marksMatch: true,
      errors: ['4 question(s) are unmapped.','1 question(s) have overlapping mappings.']
    }),
    { total:180, mapped:176, unmapped:4, invalid:1, marks:'MATCH', ready:false }
  );
});

test('builds normalized save mapping payload for backend service', () => {
  assert.deepEqual(saveMappingPayload({
    examId:'e1', mappingGroupId:'g1', selector:' Q1-Q10, Q17 ', subtopicId:'101', coverage:'partial'
  }), {
    action:'save_mapping', examId:'e1', mappingGroupId:'g1', selector:'Q1-Q10, Q17', subtopicId:101, coverage:'partial'
  });
});

test('builds approve and rename payloads for a subtopic', () => {
  assert.deepEqual(subtopicPayload('approve', { chapterId:11, subtopicId:101, title:'Menstrual Cycle' }), {
    action:'upsert_subtopic', chapterId:11, subtopicId:101, title:'Menstrual Cycle', status:'approved'
  });
  assert.deepEqual(subtopicPayload('disable', { subtopicId:101 }), {
    action:'disable_subtopic', subtopicId:101
  });
});

test('exam scope converts to mapping selector defaults',()=>{
  assert.deepEqual(
    preferredMappingSelectionFromScope({subject:'Physics',unit_id:1,chapter_id:10,subtopic_id:100}),
    {subject:'Physics',unitId:1,chapterId:10,subtopicId:100}
  );
});