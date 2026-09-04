import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('admin-exams.html','utf8');
const js=fs.readFileSync('admin-exams.js','utf8');

test('exam form uses canonical scope editor instead of visible free-text syllabus',()=>{
  assert.match(html,/id="scopeRows"/);
  assert.match(html,/id="addScopeRow"/);
  assert.match(html,/id="legacyScopeNote"/);
  assert.doesNotMatch(html,/id="syllabus"/);
});

test('exam controller loads and persists canonical scope',()=>{
  assert.match(js,/scope_tree/);
  assert.match(js,/get_scope/);
  assert.match(js,/scopeItems/);
});