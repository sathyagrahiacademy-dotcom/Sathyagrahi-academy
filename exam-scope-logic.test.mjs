import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseExamScopeItems, canSaveExamScope, buildExamScopeSummary } from './supabase/functions/admin-exams/exam-scope-logic.mjs';

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