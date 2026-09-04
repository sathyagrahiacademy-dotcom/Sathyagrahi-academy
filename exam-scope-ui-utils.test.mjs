import test from 'node:test';
import assert from 'node:assert/strict';
import uiUtils from './exam-scope-ui-utils.js';
const {unitsForSubject,chaptersForUnit,approvedSubtopicsForChapter,activeTopicSuggestionsForChapter,isDuplicateScopeRow,normaliseScopeDraft,normaliseScopeDraftV2}=uiUtils;
const tree=[
  {id:1,subject:'Physics',chapters:[{id:10,subtopics:[{id:100,subtopic_title:'Vectors',status:'suggested'},{id:101,subtopic_title:'Projectile Motion',status:'approved'},{id:102,subtopic_title:'Old Topic',status:'disabled'}]}]},
  {id:2,subject:'Biology',chapters:[]}
];

test('cascades canonical syllabus and exposes approved subtopics only for mapping compatibility',()=>{
  assert.deepEqual(unitsForSubject(tree,'Physics').map(x=>x.id),[1]);
  assert.deepEqual(chaptersForUnit(tree,1).map(x=>x.id),[10]);
  assert.deepEqual(approvedSubtopicsForChapter(tree,10).map(x=>x.id),[101]);
});

test('create exam topic suggestions include approved and suggested but hide disabled',()=>{
  assert.deepEqual(activeTopicSuggestionsForChapter(tree,10).map(x=>x.id),[100,101]);
});

test('detects exact duplicate legacy scope row',()=>{
  assert.equal(isDuplicateScopeRow([{unitId:1,chapterId:10,subtopicId:100}],{unitId:1,chapterId:10,subtopicId:100},-1),true);
});

test('normalises complete legacy draft rows and rejects incomplete rows',()=>{
  assert.deepEqual(normaliseScopeDraft([{unitId:'1',chapterId:'10',subtopicId:'100'}]),{ok:true,items:[{unitId:1,chapterId:10,subtopicId:100,sortOrder:0}]});
  assert.equal(normaliseScopeDraft([{unitId:'1',chapterId:'',subtopicId:''}]).ok,false);
});

test('whole chapter clears topic fields',()=>{
  assert.deepEqual(normaliseScopeDraftV2([{subject:'Physics',unitId:1,chapterId:10,scopeType:'chapter',topicName:'Ignore',subtopicId:101}]).items[0],{
    subject:'Physics',unitId:1,chapterId:10,scopeType:'chapter',topicName:'',subtopicId:null,sortOrder:0
  });
});

test('specific topic is required normalized and duplicate names are case insensitive',()=>{
  assert.equal(normaliseScopeDraftV2([{subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:' '}]).ok,false);
  assert.equal(normaliseScopeDraftV2([
    {subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:' Projectile   Motion '},
    {subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:'projectile motion'}
  ]).ok,false);
  assert.equal(normaliseScopeDraftV2([{subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:' Projectile   Motion '}]).items[0].topicName,'Projectile Motion');
});