import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionSubjectMap, subjectsForExam, buildSubjectAttempt, buildStudentExamMonitor } from './supabase/functions/exam-performance/admin-student-performance.mjs';

const exam={id:'e1',title:'Mixed 01',subject:'Mixed',negative_marking:true};
const questions=[
 {id:'p1',marks:4,negative_marks:1},{id:'p2',marks:4,negative_marks:1},
 {id:'c1',marks:4,negative_marks:1},{id:'c2',marks:4,negative_marks:1},
 {id:'b1',marks:4,negative_marks:1},{id:'b2',marks:4,negative_marks:1}
];
const answerKeys=questions.map((q,i)=>({question_id:q.id,correct_option:i%2?'B':'A'}));
const subtopics=[{id:101,chapter_id:11},{id:201,chapter_id:21},{id:301,chapter_id:31}];
const chapters=[{id:11,unit_id:1},{id:21,unit_id:2},{id:31,unit_id:3}];
const units=[{id:1,subject:'Physics'},{id:2,subject:'Chemistry'},{id:3,subject:'Biology'}];
const mappings=[
 {question_id:'p1',subtopic_id:101},{question_id:'p2',subtopic_id:101},
 {question_id:'c1',subtopic_id:201},{question_id:'c2',subtopic_id:201},
 {question_id:'b1',subtopic_id:301},{question_id:'b2',subtopic_id:301}
];
const subjectByQuestion=buildQuestionSubjectMap({mappings,subtopics,chapters,units});

test('mixed exam membership comes from mapped question subjects',()=>{
 assert.deepEqual(subjectsForExam({exam,questions,subjectByQuestion}),['Physics','Chemistry','Biology']);
});

test('subject attempt grades only that subject question subset',()=>{
 const attempt={id:'a1',exam_id:'e1',attempt_no:1,submitted_at:'2026-09-01T10:00:00Z'};
 const responses=[
  {question_id:'p1',selected_option:'A'},{question_id:'p2',selected_option:'A'},
  {question_id:'c1',selected_option:'A'},{question_id:'c2',selected_option:'B'},
  {question_id:'b1',selected_option:'D'},{question_id:'b2',selected_option:null}
 ];
 const p=buildSubjectAttempt({exam,attempt,questions,answerKeys,responses,subjectByQuestion,subject:'Physics'});
 const c=buildSubjectAttempt({exam,attempt,questions,answerKeys,responses,subjectByQuestion,subject:'Chemistry'});
 const b=buildSubjectAttempt({exam,attempt,questions,answerKeys,responses,subjectByQuestion,subject:'Biology'});
 assert.equal(p.max_marks,8); assert.equal(p.total_score,3); assert.equal(p.percentage,37.5);
 assert.equal(c.max_marks,8); assert.equal(c.total_score,8); assert.equal(c.percentage,100);
 assert.equal(b.max_marks,8); assert.equal(b.total_score,-1); assert.equal(b.percentage,-12.5);
 assert.notEqual(p.max_marks,24);
});

test('latest valid attempt drives average while best may come from older attempt',()=>{
 const history=[
  {exam_id:'e1',attempt_id:'a1',subject:'Physics',attempt_no:1,submitted_at:'2026-09-01T10:00:00Z',percentage:80,correct_count:8,wrong_count:2,unattempted_count:0},
  {exam_id:'e1',attempt_id:'a2',subject:'Physics',attempt_no:2,submitted_at:'2026-09-02T10:00:00Z',percentage:60,correct_count:6,wrong_count:4,unattempted_count:0}
 ];
 const monitor=buildStudentExamMonitor({eligibleExams:[{...exam,subjects:['Physics']}],attempts:[],results:[{attempt_id:'a1',is_published:true},{attempt_id:'a2',is_published:false}],subjectAttempts:history,scopeRows:[]});
 const p=monitor.subjects.find(x=>x.subject==='Physics');
 assert.equal(p.examsSet,1); assert.equal(p.examsAttempted,1); assert.equal(p.resultsPublished,1);
 assert.equal(p.average,60); assert.equal(p.best,80);
 assert.deepEqual(p.history.map(x=>x.attempt_no),[1,2]);
});

test('legacy single subject falls back but legacy mixed stays unmapped',()=>{
 const legacyPhysics={id:'ep',subject:'Physics'};
 const legacyMixed={id:'em',subject:'NEET'};
 const noMap=new Map();
 assert.deepEqual(subjectsForExam({exam:legacyPhysics,questions:[{id:'x'}],subjectByQuestion:noMap}),['Physics']);
 assert.deepEqual(subjectsForExam({exam:legacyMixed,questions:[{id:'x'}],subjectByQuestion:noMap}),[]);
 const monitor=buildStudentExamMonitor({eligibleExams:[{...legacyPhysics,subjects:['Physics']},{...legacyMixed,subjects:[]}],attempts:[],results:[],subjectAttempts:[],scopeRows:[]});
 assert.deepEqual(monitor.legacyUnmapped.map(x=>x.id),['em']);
});
