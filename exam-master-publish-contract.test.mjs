import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('.',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');

test('dedicated wizard service exposes master publish action with all readiness gates',async()=>{
  const src=await read('supabase/functions/admin-exam-wizard/index.ts');
  for(const token of ['publish_master_exam','validateResultRelease','master_blueprint_validation','blueprint_approved_at','assignedCount','result_publish_mode','result_publish_at']) assert.ok(src.includes(token),`missing ${token}`);
  assert.match(src,/action\s*===\s*['"]publish_master_exam['"]/);
  assert.match(src,/is_published:true/);
  assert.match(src,/status:['"]active['"]/);
  assert.match(src,/scheduled_start:null/);
  assert.match(src,/scheduled_end:null/);
});

test('master publish is portal-only and does not send publish email or WhatsApp',async()=>{
  const src=await read('supabase/functions/admin-exam-wizard/index.ts');
  const start=src.indexOf("action === 'publish_master_exam'");
  const at=start>=0?start:src.indexOf("action==='publish_master_exam'");
  assert.ok(at>=0,'master publish action missing');
  const block=src.slice(at,at+7000);
  assert.equal(block.includes('academy-communications'),false);
  assert.equal(block.includes("bestEffortCommunicate('exam_published'"),false);
});

test('portal exam notice carries start-anytime and result-release wording without password',async()=>{
  const access=await read('supabase/functions/student-exam-access/index.ts');
  const notice=await read('student-exam-notice-utils.js');
  assert.ok(access.includes('result_publish_mode'));
  assert.ok(access.includes('result_publish_at'));
  assert.ok(notice.includes('Start Anytime while available'));
  assert.match(notice,/Result release/i);
  assert.equal(notice.includes('password_hash'),false);
  assert.equal(notice.includes('examPassword'),false);
});

test('portal notice supports all master exam types',async()=>{
  const notice=await read('student-exam-notice-utils.js');
  for(const type of ['daily','weekly','monthly','grand']) assert.ok(notice.includes(`${type}:`),`missing ${type} label`);
});

test('wizard Step 6 companion shows release settings and publishes through master action',async()=>{
  const src=await read('admin-exam-wizard-release.js');
  for(const token of ['PUBLISH EXAM','RESULT RELEASE','publish_master_exam','mwPublishExam','mwPublishSummary','Start Anytime while available']) assert.ok(src.includes(token),`missing ${token}`);
});
