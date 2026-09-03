import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { groupPerformanceByScope, formatEHistoryRow, filterScopeRows, buildStudentHierarchy }=require('./exam-performance-ui-utils.js');

const rows=[
 {student_id:'s1',student_name:'A',subject:'Biology',unit_id:1,unit_title:'Reproduction',chapter_id:10,chapter_title:'Human Reproduction',subtopic_id:100,subtopic_title:'Menstrual Cycle',scope_level:'topic',exam_sequence:2,coverage:'full',question_count:20,earned_marks:16,max_marks:20,percentage:80,exam_id:'e2',exam_title:'Exam 2',submitted_at:'2026-02-02'},
 {student_id:'s1',student_name:'A',subject:'Biology',unit_id:1,unit_title:'Reproduction',chapter_id:10,chapter_title:'Human Reproduction',subtopic_id:100,subtopic_title:'Menstrual Cycle',scope_level:'topic',exam_sequence:1,coverage:'partial',question_count:8,earned_marks:-1,max_marks:8,percentage:-12.5,exam_id:'e1',exam_title:'Exam 1',submitted_at:'2026-01-01'},
 {student_id:'s1',student_name:'A',subject:'Biology',unit_id:1,unit_title:'Reproduction',chapter_id:10,chapter_title:'Human Reproduction',subtopic_id:null,subtopic_title:null,scope_level:'chapter',exam_sequence:1,coverage:'partial',question_count:8,earned_marks:-1,max_marks:8,percentage:-12.5,exam_id:'e1',exam_title:'Exam 1',submitted_at:'2026-01-01'},
 {student_id:'s1',student_name:'A',subject:'Biology',unit_id:1,unit_title:'Reproduction',chapter_id:null,chapter_title:null,subtopic_id:null,subtopic_title:null,scope_level:'unit',exam_sequence:1,coverage:'partial',question_count:8,earned_marks:-1,max_marks:8,percentage:-12.5,exam_id:'e1',exam_title:'Exam 1',submitted_at:'2026-01-01'},
 {student_id:'s2',student_name:'B',subject:'Physics',unit_id:2,unit_title:'Motion',chapter_id:20,chapter_title:'Kinematics',subtopic_id:200,subtopic_title:'Vectors',scope_level:'topic',exam_sequence:1,coverage:'full',question_count:10,earned_marks:30,max_marks:40,percentage:75,exam_id:'e3',exam_title:'Exam 3',submitted_at:'2026-03-01'}
];

test('groups exact scope and orders E sequence',()=>{
 const groups=groupPerformanceByScope(rows);
 const topic=groups.find(g=>g.key==='topic:1:10:100');
 assert.deepEqual(topic.rows.map(r=>r.exam_sequence),[1,2]);
});
test('formats coverage, score, q count and negative percentage',()=>{
 const text=formatEHistoryRow(rows[1]);
 assert.match(text,/E1/); assert.match(text,/PARTIAL/); assert.match(text,/8Q/); assert.match(text,/-12\.5%/);
});
test('filters by exact criteria',()=>{
 const out=filterScopeRows(rows,{studentId:'s1',subject:'Biology',coverage:'full',subtopicId:100});
 assert.equal(out.length,1); assert.equal(out[0].exam_id,'e2');
});
test('builds subject unit chapter subtopic hierarchy with explicit E rows',()=>{
 const tree=buildStudentHierarchy(rows.filter(r=>r.student_id==='s1'));
 assert.equal(tree[0].subject,'Biology');
 assert.equal(tree[0].units[0].history[0].exam_sequence,1);
 assert.equal(tree[0].units[0].chapters[0].history[0].exam_sequence,1);
 assert.deepEqual(tree[0].units[0].chapters[0].subtopics[0].history.map(r=>r.exam_sequence),[1,2]);
 assert.equal(tree[0].units[0].chapters[0].subtopics[0].history[0].percentage,-12.5);
});
