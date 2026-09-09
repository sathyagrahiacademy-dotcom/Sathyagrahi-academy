import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const wizard=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
const release=fs.existsSync('admin-exam-wizard-release.js')?fs.readFileSync('admin-exam-wizard-release.js','utf8'):'';
const notice=fs.readFileSync('student-exam-notice-utils.js','utf8');
const workflow=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8');

test('all Phase 2 browser surfaces remain dormant behind the explicit master flag',()=>{
  assert.match(nav,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED\s*===\s*true/);
  const flag=nav.indexOf('if(masterPhase1Enabled)');
  for(const token of ['admin-exam-wizard.js','admin-exam-wizard-release.js','admin-exam-workspace-route.js']){
    const at=nav.indexOf(token);
    assert.ok(at>flag,`${token} must load only inside master feature gate`);
  }
  assert.ok(nav.indexOf('adminExamsEnhancements')>flag,'legacy fallback must remain');
});

test('new master create uses allocator v2 and final DT/WT/MT/GT identity only',()=>{
  assert.ok(wizard.includes('allocate_exam_code_v2'));
  assert.equal(/rpc\(['"]allocate_exam_code['"]/.test(wizard),false);
  for(const type of ['daily','weekly','monthly','grand'])assert.ok(wizard.includes(type));
  assert.equal(wizard.includes("'unit'"),false);
});

test('master publish keeps open-start policy with no common scheduled start/end',()=>{
  const at=wizard.indexOf("action === 'publish_master_exam'");
  assert.ok(at>=0,'master publish action missing');
  const block=wizard.slice(at,at+7000);
  assert.match(block,/scheduled_start:null/);
  assert.match(block,/scheduled_end:null/);
  assert.ok(block.includes('Start Anytime while available'));
  assert.equal(block.includes('academy-communications'),false);
});

test('publish notification remains portal-only and credential-free',()=>{
  assert.ok(release.includes('Student Portal only')||release.includes('Student Portal notification'));
  assert.ok(notice.includes('Start Anytime while available'));
  assert.equal(notice.includes('password_hash'),false);
  assert.equal(notice.includes('examPassword'),false);
});

test('CI explicitly syntax-checks final Phase 2 browser surfaces',()=>{
  for(const file of ['admin-exam-wizard-release.js','admin-exam-workspace.js','admin-exam-workspace-route.js']){
    assert.ok(workflow.includes(`node --check ${file}`),`CI missing explicit syntax check for ${file}`);
  }
  assert.ok(workflow.includes('supabase/functions/admin-exam-wizard/index.ts'));
  assert.ok(workflow.includes('supabase/functions/student-exam-access/index.ts'));
});
