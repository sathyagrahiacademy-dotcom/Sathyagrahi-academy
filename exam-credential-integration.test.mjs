import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wizard=fs.readFileSync('supabase/functions/admin-exam-wizard/index.ts','utf8');
const legacyAdmin=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8');
const student=fs.readFileSync('supabase/functions/student-exam-access/index.ts','utf8');

function blockBetween(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  assert.ok(start>=0,`missing ${startMarker}`);
  const end=source.indexOf(endMarker,start+startMarker.length);
  return source.slice(start,end>start?end:source.length);
}

test('master wizard imports shared credential crypto instead of owning a second hash implementation',()=>{
  assert.match(wizard,/exam-credential-crypto\.mjs/);
  assert.match(wizard,/sha256Hex/);
  assert.match(wizard,/encryptExamCredential/);
  assert.match(wizard,/credentialSecretName/);
  assert.doesNotMatch(wizard,/async function hashPassword\(/);
});

test('master create stores verification hash and encrypted credential atomically',()=>{
  const create=blockBetween(wizard,"action === 'create_master_exam'","action === 'update_master_basics'");
  assert.match(create,/sha256Hex\(passwordCheck\.password\)/);
  assert.match(create,/encryptExamCredential\(/);
  assert.match(create,/\.rpc\(['\"]upsert_exam_credential_v1['\"]/);
  assert.doesNotMatch(create,/\.from\(['\"]exam_access['\"]\)\.insert/);
  assert.match(create,/removePartialExam\(admin,exam\.id\)/,'paired credential persistence failure must clean up the partial exam');
});

test('master password edit reuses the existing Exam Code and the same atomic credential RPC',()=>{
  const update=blockBetween(wizard,"action === 'update_master_basics'","action === 'get_master_scope'");
  assert.match(update,/exam_access\(exam_code\)/);
  assert.match(update,/if\(examPassword\)/);
  assert.match(update,/sha256Hex\(passwordCheck\.password\)/);
  assert.match(update,/encryptExamCredential\(/);
  assert.match(update,/upsert_exam_credential_v1/);
  assert.doesNotMatch(update,/\.from\(['\"]exam_access['\"]\)\.update\(\{password_hash/);
});

test('legacy admin create and password-edit paths also use the paired credential RPC',()=>{
  assert.match(legacyAdmin,/exam-credential-crypto\.mjs/);
  assert.match(legacyAdmin,/encryptExamCredential/);
  assert.match(legacyAdmin,/sha256Hex/);
  const createUpdate=blockBetween(legacyAdmin,"action === 'create' || action === 'update'","action === 'students'");
  assert.match(createUpdate,/upsert_exam_credential_v1/);
  assert.doesNotMatch(createUpdate,/\.from\(['\"]exam_access['\"]\)\.insert/);
  assert.doesNotMatch(createUpdate,/\.from\(['\"]exam_access['\"]\)\.update\(accessUpdate/);
  assert.doesNotMatch(createUpdate,/hashPassword\(/);
});

test('student verification remains hash-only and never reads the reversible vault',()=>{
  assert.match(student,/sha256\(examPassword\)/);
  assert.match(student,/password_hash/);
  assert.doesNotMatch(student,/exam_credentials|get_exam_credential_v1|ciphertext|key_version/);
});
