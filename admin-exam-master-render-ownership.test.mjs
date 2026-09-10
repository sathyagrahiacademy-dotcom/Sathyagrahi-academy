import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('admin-exams.html','utf8');
const legacy=fs.readFileSync('admin-exams.js','utf8');
const control=fs.readFileSync('admin-exam-control-center.js','utf8');
const workspaceRoute=fs.readFileSync('admin-exam-workspace-route.js','utf8');

test('draft delete is never captured by the master workspace route',()=>{
  const exclusion=workspaceRoute.indexOf("button.matches('[data-delete-draft], .delete-draft, .del')");
  const open=workspaceRoute.indexOf('openWorkspace(id,tabFor(button))');
  assert.ok(exclusion>=0,'workspace route must explicitly exclude destructive delete buttons');
  assert.ok(open>=0,'workspace route must still open master workspace for normal actions');
  assert.ok(exclusion<open,'delete exclusion must run before workspace navigation');
});

test('legacy exams renderer does not paint the old table in Master mode',()=>{
  assert.match(legacy,/const masterMode=window\.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED===true/);
  assert.match(legacy,/function render\(\)\{if\(masterMode\)return;/,'legacy render must become a no-op in Master mode');
});

test('Master exams content stays hidden until Control Center has rendered',()=>{
  assert.match(html,/class="content exam-master-pending"/,'static legacy exams content must not flash before Master render');
  assert.match(html,/\.exam-master-pending\{visibility:hidden\}/,'Master pending state must hide the legacy shell');
  assert.match(control,/classList\.remove\('exam-master-pending'\)/,'Control Center must reveal content after its first load attempt');
});

test('Control Center no longer waits for the legacy table to visibly render',()=>{
  assert.doesNotMatch(control,/legacyReady|Loading exams\.\.\./,'Master startup must not depend on the old visible renderer');
  assert.match(control,/typeof rows\.onclick!==['"]function['"]/,'Master startup may wait only for legacy action binding compatibility');
});
