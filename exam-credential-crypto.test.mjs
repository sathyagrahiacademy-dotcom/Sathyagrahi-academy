import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const modUrl=new URL('./supabase/functions/_shared/exam-credential-crypto.mjs',import.meta.url);
async function load(){return import(modUrl.href)}
const keyBase64=Buffer.alloc(32,7).toString('base64');
const otherKeyBase64=Buffer.alloc(32,8).toString('base64');
const exam={examId:'988e28f6-a0cd-4694-9229-4c68088c2246',examCode:'sga-dt-011009'};

test('credential crypto helper exists',async()=>{
  const mod=await load();
  assert.equal(mod.EXAM_CREDENTIAL_KEY_VERSION,1);
});

test('secret name is versioned',async()=>{
  const {credentialSecretName}=await load();
  assert.equal(credentialSecretName(1),'EXAM_CREDENTIAL_ENCRYPTION_KEY_V1');
  assert.equal(credentialSecretName(2),'EXAM_CREDENTIAL_ENCRYPTION_KEY_V2');
});

test('requires exactly 32 key bytes',async()=>{
  const {encryptExamCredential}=await load();
  await assert.rejects(()=>encryptExamCredential({...exam,password:'123456',keyBase64:Buffer.alloc(31).toString('base64')}),/32 bytes/i);
  await assert.rejects(()=>encryptExamCredential({...exam,password:'123456',keyBase64:Buffer.alloc(33).toString('base64')}),/32 bytes/i);
});

test('requires exactly 12 IV bytes when injected',async()=>{
  const {encryptExamCredential}=await load();
  await assert.rejects(()=>encryptExamCredential({...exam,password:'123456',keyBase64,ivBytes:new Uint8Array(11)}),/12 bytes/i);
  await assert.rejects(()=>encryptExamCredential({...exam,password:'123456',keyBase64,ivBytes:new Uint8Array(13)}),/12 bytes/i);
});

test('round trip preserves six-digit password including leading zero',async()=>{
  const {encryptExamCredential,decryptExamCredential}=await load();
  const encrypted=await encryptExamCredential({...exam,password:'000001',keyBase64,ivBytes:new Uint8Array(12).fill(1)});
  assert.equal(encrypted.keyVersion,1);
  const plain=await decryptExamCredential({...exam,...encrypted,keyBase64});
  assert.equal(plain,'000001');
});

test('different IVs produce different ciphertext',async()=>{
  const {encryptExamCredential}=await load();
  const a=await encryptExamCredential({...exam,password:'123456',keyBase64,ivBytes:new Uint8Array(12).fill(1)});
  const b=await encryptExamCredential({...exam,password:'123456',keyBase64,ivBytes:new Uint8Array(12).fill(2)});
  assert.notEqual(a.ciphertext,b.ciphertext);
});

test('wrong key and wrong authenticated context fail closed',async()=>{
  const {encryptExamCredential,decryptExamCredential}=await load();
  const encrypted=await encryptExamCredential({...exam,password:'123456',keyBase64,ivBytes:new Uint8Array(12).fill(3)});
  await assert.rejects(()=>decryptExamCredential({...exam,...encrypted,keyBase64:otherKeyBase64}));
  await assert.rejects(()=>decryptExamCredential({...exam,examId:'11111111-1111-1111-1111-111111111111',...encrypted,keyBase64}));
  await assert.rejects(()=>decryptExamCredential({...exam,examCode:'SGA-DT-DIFFERENT',...encrypted,keyBase64}));
});

test('malformed ciphertext and unsupported key version fail closed',async()=>{
  const {decryptExamCredential}=await load();
  await assert.rejects(()=>decryptExamCredential({...exam,ciphertext:'***',iv:Buffer.alloc(12).toString('base64'),keyVersion:1,keyBase64}),/base64|credential/i);
  await assert.rejects(()=>decryptExamCredential({...exam,ciphertext:Buffer.from('bad').toString('base64'),iv:Buffer.alloc(12).toString('base64'),keyVersion:2,keyBase64}),/unsupported/i);
});

test('sha256 helper matches existing verification digest',async()=>{
  const {sha256Hex}=await load();
  const expected=createHash('sha256').update('123456').digest('hex');
  assert.equal(await sha256Hex('123456'),expected);
});
