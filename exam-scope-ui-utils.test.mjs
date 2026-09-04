import test from 'node:test';
import assert from 'node:assert/strict';
import uiUtils from './exam-scope-ui-utils.js';
const {unitsForSubject,chaptersForUnit,approvedSubtopicsForChapter,isDuplicateScopeRow,normaliseScopeDraft}=uiUtils;
const tree=[{id:1,subject:'Physics',chapters:[{id:10,subtopics:[{id:100,status:'approved'},{id:101,status:'suggested'}]}]},{id:2,subject:'Biology',chapters:[]}];

test('cascades canonical syllabus and exposes approved subtopics only',()=>{
  assert.deepEqual(unitsForSubject(tree,'Physics').map(x=>x.id),[1]);
  assert.deepEqual(chaptersForUnit(tree,1).map(x=>x.id),[10]);
  assert.deepEqual(approvedSubtopicsForChapter(tree,10).map(x=>x.id),[100]);
});

test('detects exact duplicate scope row',()=>{
  assert.equal(isDuplicateScopeRow([{unitId:1,chapterId:10,subtopicId:100}],{unitId:1,chapterId:10,subtopicId:100},-1),true);
});

test('normalises complete draft rows and rejects incomplete rows',()=>{
  assert.deepEqual(normaliseScopeDraft([{unitId:'1',chapterId:'10',subtopicId:'100'}]),{ok:true,items:[{unitId:1,chapterId:10,subtopicId:100,sortOrder:0}]});
  assert.equal(normaliseScopeDraft([{unitId:'1',chapterId:'',subtopicId:''}]).ok,false);
});