import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const examQuestionsJs=readFileSync(new URL('./admin-exam-questions.js',import.meta.url),'utf8');
const examQuestionsHtml=readFileSync(new URL('./admin-exam-questions.html',import.meta.url),'utf8');
const bankHtml=readFileSync(new URL('./admin-question-bank.html',import.meta.url),'utf8');

test('download template uses an approved Physics question type example',()=>{
  assert.match(examQuestionsJs,/"Question Type":"Direct Concept MCQ"/);
  assert.doesNotMatch(examQuestionsJs,/"Question Type":"Concept"/);
});

test('client pre-validation mirrors official subject question formats',()=>{
  assert.match(examQuestionsJs,/approvedQuestionTypes/);
  for(const value of ['Circuit Based','Reaction / Product','NCERT Direct']) assert.ok(examQuestionsJs.includes(value),value);
  assert.match(examQuestionsJs,/Question Type.*approved/i);
});

test('client pre-validation requires official plus four minus one marking',()=>{
  assert.match(examQuestionsJs,/Marks must be 4/);
  assert.match(examQuestionsJs,/Negative Marks must be 1/);
});

test('bulk upload page explains official format and marking rules',()=>{
  assert.match(examQuestionsHtml,/id="officialFormatGuide"/);
  assert.match(examQuestionsHtml,/\+4 \/ −1 \/ 0/);
  assert.match(examQuestionsHtml,/Question Type/i);
});

test('exam question setup is Excel-only while legacy Question Bank page is not part of the wizard',()=>{
  assert.match(examQuestionsHtml,/EXCEL UPLOAD/i);
  assert.match(examQuestionsHtml,/No Question Bank and no manual question entry/i);
  assert.doesNotMatch(examQuestionsHtml,/FROM QUESTION BANK/);
});
