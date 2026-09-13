import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='supabase/functions/admin-exam-credentials/index.ts';
const exists=fs.existsSync(path);
const src=exists?fs.readFileSync(path,'utf8'):'';

test('admin exam credential Edge Function exists',()=>{
  assert.equal(exists,true,'admin-exam-credentials/index.ts must exist');
});

if(exists){
  test('requires bearer auth and active Admin before privileged access',()=>{
    const bearer=src.indexOf("startsWith('Bearer ')");
    const getUser=src.indexOf('auth.getUser()');
    const adminGuard=Math.max(src.indexOf("profile.role !== 'admin'"),src.indexOf("profile.role!=='admin'"));
    const serviceClient=Math.max(src.indexOf('SUPABASE_SERVICE_ROLE_KEY'),src.indexOf('SUPABASE_SECRET_KEYS'));
    assert.ok(bearer>=0,'Bearer authorization guard missing');
    assert.ok(getUser>bearer,'auth.getUser must run after bearer guard');
    assert.ok(adminGuard>getUser,'active Admin profile guard missing after auth.getUser');
    assert.match(src,/is_active/);
    assert.ok(serviceClient>adminGuard,'privileged service-role client/config must be created only after Admin authorization');
  });

  test('implements status reveal and reset actions',()=>{
    for(const action of ['status','reveal','reset'])assert.match(src,new RegExp(`action\\s*===\\s*['\"]${action}['\"]`));
  });

  test('reveal responses are explicitly non-cacheable',()=>{
    assert.match(src,/Cache-Control[^\n]*no-store[^\n]*private/i);
    assert.match(src,/Pragma[^\n]*no-cache/i);
    assert.match(src,/Expires[^\n]*0/i);
  });

  test('missing vault data is machine readable as RESET_REQUIRED',()=>{
    assert.match(src,/RESET_REQUIRED/);
    assert.match(src,/Password not stored/);
  });

  test('reset uses existing six digit policy and requires non-draft confirmation',()=>{
    assert.match(src,/password-policy\.mjs/);
    assert.match(src,/validateExamPassword/);
    assert.match(src,/confirmNonDraft/);
    assert.match(src,/CONFIRM_NON_DRAFT_REQUIRED/);
  });

  test('credential reads and writes go through service-role RPCs',()=>{
    assert.match(src,/\.rpc\(['\"]get_exam_credential_v1['\"]/);
    assert.match(src,/\.rpc\(['\"]upsert_exam_credential_v1['\"]/);
  });

  test('reset does not echo the password and code contains no secret logging',()=>{
    const resetStart=src.indexOf("action === 'reset'")>=0?src.indexOf("action === 'reset'"):src.indexOf("action==='reset'");
    const resetBlock=resetStart>=0?src.slice(resetStart):src;
    assert.doesNotMatch(resetBlock,/return\s+json\([^\n]*newPassword/);
    assert.doesNotMatch(src,/console\.(log|info|debug|warn)\([^\n]*(password|newPassword|requestBody|body|plaintext|decrypted)/i);
  });
}
