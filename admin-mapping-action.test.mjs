import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdminMappingAction } from './supabase/functions/admin-exam-mapping/admin-mapping-action.mjs';

test('save_mapping normalizes coverage and required ids', () => {
  const out = normalizeAdminMappingAction({action:'save_mapping',examId:'e1',selector:' Q1-Q3 ',subtopicId:7,coverage:'FULL'});
  assert.equal(out.ok,true);
  assert.equal(out.command.action,'save_mapping');
  assert.equal(out.command.examId,'e1');
  assert.equal(out.command.subtopicId,7);
  assert.equal(out.command.coverage,'full');
  assert.equal(out.command.selector,'Q1-Q3');
});

test('save_mapping rejects missing exam or invalid coverage', () => {
  assert.equal(normalizeAdminMappingAction({action:'save_mapping',selector:'1-3',subtopicId:7,coverage:'full'}).ok,false);
  assert.equal(normalizeAdminMappingAction({action:'save_mapping',examId:'e1',selector:'1-3',subtopicId:7,coverage:'bad'}).ok,false);
});

test('upsert_subtopic allows suggested or approved only', () => {
  assert.equal(normalizeAdminMappingAction({action:'upsert_subtopic',chapterId:2,title:'A',status:'approved'}).ok,true);
  assert.equal(normalizeAdminMappingAction({action:'upsert_subtopic',chapterId:2,title:'A',status:'disabled'}).ok,false);
});

test('split and merge requests are normalized through policy', () => {
  const split=normalizeAdminMappingAction({action:'split_subtopic',subtopicId:9,titles:[' A ',' B ']});
  assert.deepEqual(split.command.titles,['A','B']);
  const merge=normalizeAdminMappingAction({action:'merge_subtopics',chapterId:2,subtopicIds:[9,10],title:' Combined '});
  assert.deepEqual(merge.command.subtopicIds,['9','10']);
  assert.equal(merge.command.title,'Combined');
});

test('unknown action is rejected', () => {
  assert.equal(normalizeAdminMappingAction({action:'boom'}).ok,false);
});
