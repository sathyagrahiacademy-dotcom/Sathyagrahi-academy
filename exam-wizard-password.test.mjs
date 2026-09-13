import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { validateExamPassword } from './supabase/functions/admin-exam-wizard/password-policy.mjs';
const require=createRequire(import.meta.url);
const client=require('./exam-password-utils.js');

test('password policy is exactly six digits and permits leading zero',()=>{
  for(const value of ['000001','482731','999999']){
    assert.equal(client.isValidSixDigitPassword(value),true);
    assert.deepEqual(validateExamPassword(value),{ok:true,password:value});
  }
  for(const value of ['12345','1234567','12A456','123-56','']){
    assert.equal(client.isValidSixDigitPassword(value),false);
    assert.equal(validateExamPassword(value).ok,false);
  }
});

test('generator returns exactly six numeric characters',()=>{
  const fake={getRandomValues(bytes){bytes[0]=123;return bytes;}};
  assert.match(client.generateSixDigitPassword(fake),/^\d{6}$/);
});

test('wizard and edge both use shared six digit policies',()=>{
  const wizard=fs.readFileSync('admin-exam-wizard.js','utf8');
  const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
  assert.match(wizard,/ExamPasswordUtils/);
  assert.match(edge,/validateExamPassword/);
  assert.doesNotMatch(edge,/4 to 64 characters/);
});

test('master wizard password persistence uses the shared encrypted credential helper',()=>{
  const edge=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
  assert.match(edge,/exam-credential-crypto\.mjs/);
  assert.match(edge,/encryptExamCredential/);
  assert.match(edge,/upsert_exam_credential_v1/);
});
