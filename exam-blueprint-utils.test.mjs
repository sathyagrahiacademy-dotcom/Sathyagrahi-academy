import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlueprintModel} from './exam-blueprint-utils.mjs';

test('blueprint is draft until publish validation is ready',()=>{
  const m=buildBlueprintModel({validation:{publishReady:false},questions:[]});
  assert.equal(m.status,'DRAFT BLUEPRINT');
});

test('blueprint groups questions by canonical syllabus, difficulty and type',()=>{
  const m=buildBlueprintModel({validation:{publishReady:true},questions:[
    {subject:'Physics',unitId:1,unitTitle:'Kinematics',chapterId:2,chapterTitle:'Motion in a Plane',subtopicId:3,topicTitle:'Projectile Motion',difficulty:'Medium',question_type:'Numerical',marks:4},
    {subject:'Physics',unitId:1,unitTitle:'Kinematics',chapterId:2,chapterTitle:'Motion in a Plane',subtopicId:3,topicTitle:'Projectile Motion',difficulty:'Hard',question_type:'Numerical',marks:4}
  ]});
  assert.equal(m.status,'FINAL BLUEPRINT');
  assert.deepEqual(m.subjects.map(x=>[x.label,x.questions,x.marks]),[['Physics',2,8]]);
  assert.deepEqual(m.topics.map(x=>[x.label,x.questions,x.marks]),[['Projectile Motion',2,8]]);
  assert.equal(m.difficulty.length,2);
  assert.deepEqual(m.types.map(x=>[x.label,x.questions]),[['Numerical',2]]);
});
