import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishExam } from './supabase/functions/admin-exams/publish-validation.mjs';

function validMapping(totalQuestions=3,totalMarks=12){
  return {ok:true,totalQuestions,mappedQuestions:totalQuestions,unmappedQuestionNos:[],invalidQuestionNos:[],duplicateQuestionIds:[],invalidSubtopicQuestionNos:[],answerKeyMissingQuestionNos:[],questionMarksTotal:totalMarks,totalMarks,marksMatch:true,errors:[]};
}
const valid=validMapping();

test('allows a fully valid mapped legacy paper',()=>{assert.equal(canPublishExam({mappingValidation:valid}).ok,true)});
test('blocks zero-question exam',()=>{const v={...valid,ok:false,totalQuestions:0,mappedQuestions:0,errors:['Exam has no questions.']};const r=canPublishExam({mappingValidation:v});assert.equal(r.ok,false);assert.match(r.error,/publish/i)});
test('blocks unmapped questions',()=>{const v={...valid,ok:false,mappedQuestions:2,unmappedQuestionNos:[3],errors:['1 question(s) are unmapped.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks missing answer keys',()=>{const v={...valid,ok:false,answerKeyMissingQuestionNos:[2],errors:['1 question(s) are missing a valid answer key.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks marks mismatch',()=>{const v={...valid,ok:false,marksMatch:false,questionMarksTotal:12,totalMarks:16,errors:['Question marks total 12 does not match exam total 16.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks unapproved subtopics',()=>{const v={...valid,ok:false,invalidSubtopicQuestionNos:[1],errors:['1 question(s) use an unapproved subtopic.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});

test('allows official single-subject Daily paper only at 45 questions from selected subject',()=>{
  const exam={exam_type:'daily',subject:'Chemistry',expected_questions:45,duration_minutes:45,total_marks:180,negative_marking:true};
  const ok=canPublishExam({mappingValidation:validMapping(45,180),exam,subjectCounts:{Physics:0,Chemistry:45,Biology:0}});
  assert.equal(ok.ok,true);
  const bad=canPublishExam({mappingValidation:validMapping(45,180),exam,subjectCounts:{Physics:5,Chemistry:40,Biology:0}});
  assert.equal(bad.ok,false);
  assert.match(bad.error,/Daily Chemistry|45/i);
});

test('allows mixed Daily paper when mapped subject counts total exactly 45',()=>{
  const exam={exam_type:'daily',subject:'Mixed',expected_questions:45,duration_minutes:45,total_marks:180,negative_marking:true};
  const result=canPublishExam({mappingValidation:validMapping(45,180),exam,subjectCounts:{Physics:15,Chemistry:15,Biology:15}});
  assert.equal(result.ok,true);
});

test('blocks Unit or Monthly paper unless distribution is Physics 45 Chemistry 45 Biology 90',()=>{
  for(const examType of ['unit','monthly']){
    const exam={exam_type:examType,subject:'NEET',expected_questions:180,duration_minutes:180,total_marks:720,negative_marking:true};
    assert.equal(canPublishExam({mappingValidation:validMapping(180,720),exam,subjectCounts:{Physics:45,Chemistry:45,Biology:90}}).ok,true,examType);
    const bad=canPublishExam({mappingValidation:validMapping(180,720),exam,subjectCounts:{Physics:50,Chemistry:40,Biology:90}});
    assert.equal(bad.ok,false,examType);
    assert.match(bad.error,/Physics 45|distribution/i);
  }
});

test('blocks official publish when expected questions or total marks drift from type template',()=>{
  const counts={Physics:45,Chemistry:45,Biology:90};
  const wrongQuestions={exam_type:'monthly',subject:'NEET',expected_questions:179,duration_minutes:180,total_marks:720,negative_marking:true};
  const wrongMarks={exam_type:'monthly',subject:'NEET',expected_questions:180,duration_minutes:180,total_marks:700,negative_marking:true};
  assert.equal(canPublishExam({mappingValidation:validMapping(180,720),exam:wrongQuestions,subjectCounts:counts}).ok,false);
  assert.equal(canPublishExam({mappingValidation:validMapping(180,700),exam:wrongMarks,subjectCounts:counts}).ok,false);
});

test('blocks official publish when duration or negative-marking template metadata drifts',()=>{
  const counts={Physics:0,Chemistry:0,Biology:45};
  const wrongDuration={exam_type:'daily',subject:'Biology',expected_questions:45,duration_minutes:60,total_marks:180,negative_marking:true};
  const wrongNegative={exam_type:'daily',subject:'Biology',expected_questions:45,duration_minutes:45,total_marks:180,negative_marking:false};
  assert.equal(canPublishExam({mappingValidation:validMapping(45,180),exam:wrongDuration,subjectCounts:counts}).ok,false);
  assert.equal(canPublishExam({mappingValidation:validMapping(45,180),exam:wrongNegative,subjectCounts:counts}).ok,false);
});
