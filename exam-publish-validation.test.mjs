import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishExam } from './supabase/functions/admin-exams/publish-validation.mjs';

const valid={ok:true,totalQuestions:3,mappedQuestions:3,unmappedQuestionNos:[],invalidQuestionNos:[],duplicateQuestionIds:[],invalidSubtopicQuestionNos:[],answerKeyMissingQuestionNos:[],questionMarksTotal:12,totalMarks:12,marksMatch:true,errors:[]};

test('allows a fully valid mapped paper',()=>{assert.equal(canPublishExam({mappingValidation:valid}).ok,true)});
test('blocks zero-question exam',()=>{const v={...valid,ok:false,totalQuestions:0,mappedQuestions:0,errors:['Exam has no questions.']};const r=canPublishExam({mappingValidation:v});assert.equal(r.ok,false);assert.match(r.error,/publish/i)});
test('blocks unmapped questions',()=>{const v={...valid,ok:false,mappedQuestions:2,unmappedQuestionNos:[3],errors:['1 question(s) are unmapped.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks missing answer keys',()=>{const v={...valid,ok:false,answerKeyMissingQuestionNos:[2],errors:['1 question(s) are missing a valid answer key.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks marks mismatch',()=>{const v={...valid,ok:false,marksMatch:false,questionMarksTotal:12,totalMarks:16,errors:['Question marks total 12 does not match exam total 16.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
test('blocks unapproved subtopics',()=>{const v={...valid,ok:false,invalidSubtopicQuestionNos:[1],errors:['1 question(s) use an unapproved subtopic.']};assert.equal(canPublishExam({mappingValidation:v}).ok,false)});
