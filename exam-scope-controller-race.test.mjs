import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legacy=fs.readFileSync('admin-exams.js','utf8');
const v2=fs.readFileSync('admin-exam-scope-v2-ui.js','utf8');
const html=fs.readFileSync('admin-exams.html','utf8');

test('legacy exam controller signals readiness only after its initial load completes',()=>{
  assert.match(legacy,/await loadScopeTreeOnce\(\);resetExamForm\(\);await load\(\);window\.SGA_ADMIN_EXAMS_READY=true;window\.dispatchEvent\(new Event\('sga:admin-exams-ready'\)\)/);
});

test('V2 scope controller waits for the legacy controller readiness signal before owning the form',()=>{
  assert.match(v2,/const init=\(\)=>\{/);
  assert.match(v2,/if\(window\.SGA_ADMIN_EXAMS_READY\)init\(\);else window\.addEventListener\('sga:admin-exams-ready',init,\{once:true\}\)/);
});

test('V2 scope controller is cache-busted after the race fix',()=>{
  assert.match(html,/admin-exam-scope-v2-ui\.js\?v=20260905-2/);
});
