import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseExamScopeItems, canSaveExamScope, buildExamScopeSummary, normalizeTopicName, normaliseExamScopeDraftV2 } from './supabase/functions/admin-exams/exam-scope-logic.mjs';

test('normalises ids and blocks duplicate exact scope',()=>{
  const good=normaliseExamScopeItems([{unitId:'1',chapterId:'10',subtopicId:'100'}]);
  assert.equal(good.ok,true);
  assert.deepEqual(good.items,[{unitId:1,chapterId:10,subtopicId:100,sortOrder:0}]);
  assert.equal(normaliseExamScopeItems([{unitId:1,chapterId:10,subtopicId:100},{unitId:1,chapterId:10,subtopicId:100}]).ok,false);
});

test('rejects incomplete invalid ids',()=>{
  assert.equal(normaliseExamScopeItems([{unitId:0,chapterId:10,subtopicId:null}]).ok,false);
  assert.equal(normaliseExamScopeItems([{unitId:1,chapterId:null,subtopicId:null}]).ok,false);
});

test('requires scope for new exams but preserves empty legacy updates',()=>{
  assert.equal(canSaveExamScope({action:'create',hadStructuredScope:false,items:[]}).ok,false);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:false,items:[]}).ok,true);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:true,items:[]}).ok,false);
  assert.equal(canSaveExamScope({action:'update',hadStructuredScope:true,items:[{unitId:1,chapterId:10,subtopicId:null,sortOrder:0}]}).ok,true);
});

test('builds legacy display summary from canonical labels',()=>{
  const lookup={chapters:new Map([[10,{topic_title:'Motion in a Plane'}],[20,{topic_title:'Human Reproduction'}]]),subtopics:new Map([[100,{subtopic_title:'Vectors'}],[200,{subtopic_title:'Gametogenesis'}]])};
  assert.equal(buildExamScopeSummary([{chapterId:10,subtopicId:100},{chapterId:20,subtopicId:200}],lookup),'Motion in a Plane • Vectors; Human Reproduction • Gametogenesis');
});

test('normalizes manual topic whitespace',()=>{
  assert.equal(normalizeTopicName('  Projectile   Motion  '),'Projectile Motion');
});

test('whole chapter scope clears topic fields',()=>{
  assert.deepEqual(normaliseExamScopeDraftV2([{subject:'Physics',unitId:'1',chapterId:'10',scopeType:'chapter',topicName:'ignored',subtopicId:100}]),{
    ok:true,items:[{subject:'Physics',unitId:1,chapterId:10,scopeType:'chapter',topicName:'',subtopicId:null,sortOrder:0}]
  });
});

test('specific topic requires a normalized name',()=>{
  assert.equal(normaliseExamScopeDraftV2([{subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:'   '}]).ok,false);
  assert.deepEqual(normaliseExamScopeDraftV2([{subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:'  Projectile   Motion '}]).items[0],{
    subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:'Projectile Motion',subtopicId:null,sortOrder:0
  });
});

test('requires canonical subject and rejects normalized duplicate topics',()=>{
  assert.equal(normaliseExamScopeDraftV2([{subject:'NEET',unitId:1,chapterId:10,scopeType:'chapter'}]).ok,false);
  assert.equal(normaliseExamScopeDraftV2([
    {subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:'Projectile Motion'},
    {subject:'Physics',unitId:1,chapterId:10,scopeType:'topic',topicName:' projectile   motion '}
  ]).ok,false);
});
