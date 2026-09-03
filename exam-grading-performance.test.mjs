import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gradeQuestions } from './supabase/functions/student-exam-attempt/grading-logic.mjs';
import { buildScopePerformance } from './supabase/functions/student-exam-attempt/performance-logic.mjs';

const questions=[
  {id:'q1',marks:4,negative_marks:1},
  {id:'q2',marks:4,negative_marks:1},
  {id:'q3',marks:4,negative_marks:1}
];
const keys=[
  {question_id:'q1',correct_option:'A'},
  {question_id:'q2',correct_option:'B'},
  {question_id:'q3',correct_option:'C'}
];
const responses=[
  {question_id:'q1',selected_option:'A'},
  {question_id:'q2',selected_option:'D'},
  {question_id:'q3',selected_option:'C'}
];

test('negative marking ON subtracts per-question penalty',()=>{
  const r=gradeQuestions({questions,answerKeys:keys,responses,negativeMarking:true,totalMarks:12});
  assert.equal(r.summary.total_score,7);
  assert.equal(r.summary.correct_count,2);
  assert.equal(r.summary.wrong_count,1);
  assert.equal(r.summary.unattempted_count,0);
  assert.equal(r.summary.percentage,7/12*100);
  assert.equal(r.questionGrades.find(x=>x.question_id==='q2').earned_marks,-1);
});

test('negative marking OFF subtracts zero',()=>{
  const r=gradeQuestions({questions,answerKeys:keys,responses,negativeMarking:false,totalMarks:12});
  assert.equal(r.summary.total_score,8);
  assert.equal(r.questionGrades.find(x=>x.question_id==='q2').earned_marks,0);
});

test('blank is unattempted and has no deduction',()=>{
  const r=gradeQuestions({questions,answerKeys:keys,responses:[{question_id:'q1',selected_option:null}],negativeMarking:true,totalMarks:12});
  assert.equal(r.summary.unattempted_count,3);
  assert.equal(r.summary.total_score,0);
});

test('negative total and percentage are preserved',()=>{
  const qs=[{id:'q1',marks:4,negative_marks:2},{id:'q2',marks:4,negative_marks:2}];
  const ks=[{question_id:'q1',correct_option:'A'},{question_id:'q2',correct_option:'A'}];
  const rs=[{question_id:'q1',selected_option:'B'},{question_id:'q2',selected_option:'C'}];
  const r=gradeQuestions({questions:qs,answerKeys:ks,responses:rs,negativeMarking:true,totalMarks:8});
  assert.equal(r.summary.total_score,-4);
  assert.equal(r.summary.percentage,-50);
});

test('builds weighted Topic Chapter Unit performance without percentage averaging',()=>{
  const r=buildScopePerformance({
    attemptId:'a1',examId:'e1',studentId:'s1',questions,answerKeys:keys,responses,negativeMarking:true,
    mappings:[
      {question_id:'q1',subtopic_id:10,mapping_group_id:'g1'},
      {question_id:'q2',subtopic_id:10,mapping_group_id:'g1'},
      {question_id:'q3',subtopic_id:11,mapping_group_id:'g2'}
    ],
    mappingGroups:[
      {id:'g1',subtopic_id:10,coverage:'partial'},
      {id:'g2',subtopic_id:11,coverage:'full'}
    ],
    subtopics:[
      {id:10,chapter_id:100,status:'approved'},
      {id:11,chapter_id:100,status:'approved'}
    ],
    chapters:[{id:100,unit_id:1000}],
    units:[{id:1000}],
    approvedSubtopicsByChapter:{100:[10,11]}
  });
  const topicA=r.rows.find(x=>x.scope_level==='topic'&&x.subtopic_id===10);
  const topicB=r.rows.find(x=>x.scope_level==='topic'&&x.subtopic_id===11);
  const chapter=r.rows.find(x=>x.scope_level==='chapter'&&x.chapter_id===100);
  const unit=r.rows.find(x=>x.scope_level==='unit'&&x.unit_id===1000);
  assert.equal(topicA.earned_marks,3);
  assert.equal(topicA.max_marks,8);
  assert.equal(topicA.percentage,37.5);
  assert.equal(topicA.coverage,'partial');
  assert.equal(topicB.earned_marks,4);
  assert.equal(topicB.max_marks,4);
  assert.equal(chapter.earned_marks,7);
  assert.equal(chapter.max_marks,12);
  assert.equal(chapter.percentage,7/12*100);
  assert.equal(chapter.coverage,'partial');
  assert.equal(unit.earned_marks,7);
  assert.equal(unit.max_marks,12);
  assert.equal(unit.coverage,'partial');
});

test('full chapter/unit requires every approved descendant represented FULL',()=>{
  const r=buildScopePerformance({
    attemptId:'a1',examId:'e1',studentId:'s1',questions,answerKeys:keys,responses,negativeMarking:true,
    mappings:[
      {question_id:'q1',subtopic_id:10,mapping_group_id:'g1'},
      {question_id:'q2',subtopic_id:10,mapping_group_id:'g1'},
      {question_id:'q3',subtopic_id:11,mapping_group_id:'g2'}
    ],
    mappingGroups:[{id:'g1',subtopic_id:10,coverage:'full'},{id:'g2',subtopic_id:11,coverage:'full'}],
    subtopics:[{id:10,chapter_id:100,status:'approved'},{id:11,chapter_id:100,status:'approved'}],
    chapters:[{id:100,unit_id:1000}],units:[{id:1000}],approvedSubtopicsByChapter:{100:[10,11]}
  });
  assert.equal(r.rows.find(x=>x.scope_level==='chapter').coverage,'full');
  assert.equal(r.rows.find(x=>x.scope_level==='unit').coverage,'full');
});

test('integration source imports pure grader/performance and removes unconditional penalty',()=>{
  const src=fs.readFileSync('supabase/functions/student-exam-attempt/index.ts','utf8');
  assert.match(src,/gradeQuestions/);
  assert.match(src,/buildScopePerformance/);
  assert.doesNotMatch(src,/score\s*-=\s*Number\(q\.negative_marks\s*\|\|\s*0\)/);
});
