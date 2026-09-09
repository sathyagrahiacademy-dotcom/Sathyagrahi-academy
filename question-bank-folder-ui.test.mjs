import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('admin-question-bank.html','utf8');
const js=fs.readFileSync('admin-question-bank.js','utf8');

test('opening view is three subject folders and not a question table',()=>{
  for(const id of ['qbFolderHost','qbBreadcrumb','qbQuestionHost','qbSort','qbSearch','qbLoadMore'])assert.match(html,new RegExp(id));
  assert.doesNotMatch(html,/id=["']rows["']/);
  assert.match(js,/folder_summary/);
  assert.doesNotMatch(js,/action:['"]list['"]/);
});

test('flow is subject then chapter then topic then questions',()=>{
  for(const token of ['renderSubjects','renderChapters','renderTopics','loadTopicQuestions'])assert.match(js,new RegExp(token));
  assert.match(js,/topic_questions/);
});

test('question view has added date time and approved sorting',()=>{
  for(const text of ['Newest First','Oldest First','Difficulty','Question Type','Source','Source Year'])assert.match(html,new RegExp(text));
  assert.match(js,/created_at/);
  assert.match(js,/toLocaleDateString/);
  assert.match(js,/toLocaleTimeString/);
  assert.match(js,/add_to_exam/);
});
