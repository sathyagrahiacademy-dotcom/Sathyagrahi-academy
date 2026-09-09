import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const htmlPath='admin-exam-workspace.html';
const jsPath='admin-exam-workspace.js';
const routePath='admin-exam-workspace-route.js';

test('setup-side Exam Workspace files exist',()=>{
  for(const path of [htmlPath,jsPath,routePath])assert.ok(fs.existsSync(path),`${path} is missing`);
});

test('workspace exposes current setup tabs and clearly disabled future tabs',()=>{
  if(!fs.existsSync(htmlPath))return;
  const html=fs.readFileSync(htmlPath,'utf8');
  for(const tab of ['OVERVIEW','COVERAGE','QUESTIONS','BLUEPRINT','STUDENTS'])assert.match(html,new RegExp(`>${tab}<`));
  for(const tab of ['LIVE','RESULTS','PERFORMANCE','FILES','AUDIT'])assert.ok(html.includes(tab),`missing future tab ${tab}`);
  assert.match(html,/disabled[^>]*>LIVE<|>LIVE<[^\n]{0,120}disabled/i);
});

test('workspace reconstructs setup from persisted control, audience, scope and blueprint facts',()=>{
  if(!fs.existsSync(jsPath))return;
  const js=fs.readFileSync(jsPath,'utf8');
  for(const token of ['control_center','master_students','get_master_scope','master_blueprint_validation','URLSearchParams','exam'])assert.ok(js.includes(token),`missing ${token}`);
  for(const token of ['Exam Code','Test Type','Batch','Exam Date','Duration','Questions Ready','Mapping','Assigned Students','Result Mode','Blueprint','Lifecycle','Next Action'])assert.ok(js.includes(token),`missing overview field ${token}`);
});

test('workspace setup tabs route to existing approved setup engines',()=>{
  if(!fs.existsSync(jsPath))return;
  const js=fs.readFileSync(jsPath,'utf8');
  assert.match(js,/admin-exam-questions\.html\?exam=/);
  assert.ok(js.includes('COVERAGE'));
  assert.ok(js.includes('BLUEPRINT'));
  assert.ok(js.includes('STUDENTS'));
});

test('master Control Center actions are captured into Workspace while legacy rows remain untouched',()=>{
  if(!fs.existsSync(routePath))return;
  const js=fs.readFileSync(routePath,'utf8');
  assert.ok(js.includes('admin-exam-workspace.html?exam='));
  assert.ok(js.includes('DT'));
  assert.ok(js.includes('WT'));
  assert.ok(js.includes('MT'));
  assert.ok(js.includes('GT'));
  assert.match(js,/data-master-workspace/);
  assert.match(js,/preventDefault\(\)/);
});
