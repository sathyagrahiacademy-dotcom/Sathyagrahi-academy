import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('admin-exams.html','utf8');
const legacyJs=fs.readFileSync('admin-exams.js','utf8');
const v2=fs.readFileSync('admin-exam-scope-v2-ui.js','utf8');
const loader=fs.readFileSync('admin-exam-scope-v2-loader.js','utf8');

test('exam form keeps canonical scope host and loads v2 controller after legacy initialization',()=>{
  assert.match(html,/id="scopeRows"/);
  assert.match(html,/id="addScopeRow"/);
  assert.match(html,/id="legacyScopeNote"/);
  assert.match(html,/admin-exam-scope-v2-loader\.js\?v=20260905-2/);
  assert.doesNotMatch(html,/<script src="admin-exam-scope-v2-ui\.js\?v=[^"]+"><\/script>/);
  assert.match(loader,/admin-exam-scope-v2-ui\.js\?v=20260905-2/);
  assert.doesNotMatch(html,/id="syllabus"/);
});

test('legacy controller still provides existing exam operations',()=>{
  assert.match(legacyJs,/scope_tree/);
  assert.match(legacyJs,/get_scope/);
  assert.match(legacyJs,/reexam_student/);
  assert.match(legacyJs,/reset_student/);
});

test('v2 scope editor uses explicit scope type and manual topic payload',()=>{
  assert.match(v2,/Scope Type/);
  assert.match(v2,/Whole Chapter/);
  assert.match(v2,/Specific Topic/);
  assert.match(v2,/scope-topic-name/);
  assert.match(v2,/normaliseScopeDraftV2/);
  assert.match(v2,/scopeItems:norm\.items/);
});

test('v2 editor renders prerequisite guidance and edit hydration',()=>{
  assert.match(v2,/Select Subject first/);
  assert.match(v2,/Select Unit first/);
  assert.match(v2,/subtopicTitle/);
  assert.match(v2,/scopeType/);
});
