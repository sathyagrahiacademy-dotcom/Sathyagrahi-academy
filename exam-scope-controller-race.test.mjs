import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legacy=fs.readFileSync('admin-exams.js','utf8');
const html=fs.readFileSync('admin-exams.html','utf8');

test('V2 scope controller is loaded only after the legacy exam controller completes initial setup',()=>{
  assert.match(legacy,/await loadScopeTreeOnce\(\);resetExamForm\(\);await load\(\);const scopeV2=document\.createElement\('script'\);scopeV2\.id='adminExamScopeV2';scopeV2\.src='admin-exam-scope-v2-ui\.js\?v=20260905-2';document\.body\.appendChild\(scopeV2\)/);
});

test('HTML no longer loads the V2 scope controller in parallel with admin-exams.js',()=>{
  assert.doesNotMatch(html,/<script src="admin-exam-scope-v2-ui\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<script src="admin-exams\.js\?v=20260905-2"><\/script>/);
});
