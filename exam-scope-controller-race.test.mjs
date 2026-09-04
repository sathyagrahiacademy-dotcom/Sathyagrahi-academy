import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('admin-exams.html','utf8');
const loader=fs.readFileSync('admin-exam-scope-v2-loader.js','utf8');

test('HTML no longer loads the V2 controller in parallel with admin-exams.js',()=>{
  assert.doesNotMatch(html,/<script src="admin-exam-scope-v2-ui\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<script src="admin-exams\.js\?v=20260905-2"><\/script>/);
  assert.match(html,/<script src="admin-exam-scope-v2-loader\.js\?v=20260905-2"><\/script>/);
});

test('loader waits until legacy scope rendering has completed before loading V2',()=>{
  assert.match(loader,/querySelector\('#scopeRows \.scope-subtopic'\)/);
  assert.match(loader,/setTimeout\(waitForLegacyScope,20\)/);
  assert.match(loader,/script\.src='admin-exam-scope-v2-ui\.js\?v=20260905-2'/);
  assert.match(loader,/script\.id='adminExamScopeV2'/);
});
