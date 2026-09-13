export const EXAM_CREDENTIAL_KEY_VERSION=1;

export function credentialSecretName(version=EXAM_CREDENTIAL_KEY_VERSION){
  const n=Number(version);
  if(!Number.isInteger(n)||n<=0)throw new Error('Credential key version must be a positive integer');
  return `EXAM_CREDENTIAL_ENCRYPTION_KEY_V${n}`;
}

function normalizeExamId(value){
  const id=String(value??'').trim();
  if(!id)throw new Error('Exam ID is required');
  return id;
}

function normalizeExamCode(value){
  const code=String(value??'').trim().toUpperCase();
  if(!code)throw new Error('Exam Code is required');
  return code;
}

function base64ToBytes(value,label){
  const text=String(value??'').trim();
  if(!text||text.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(text))throw new Error(`Invalid ${label} base64`);
  let raw;
  try{raw=atob(text)}catch{throw new Error(`Invalid ${label} base64`)}
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes){
  let raw='';
  for(const byte of bytes)raw+=String.fromCharCode(byte);
  return btoa(raw);
}

function aadBytes(examId,examCode){
  return new TextEncoder().encode(`${normalizeExamId(examId)}\n${normalizeExamCode(examCode)}`);
}

async function importAesKey(keyBase64,usage){
  const raw=base64ToBytes(keyBase64,'encryption key');
  if(raw.length!==32)throw new Error('Exam credential encryption key must decode to exactly 32 bytes');
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,[usage]);
}

export async function sha256Hex(value){
  const bytes=new TextEncoder().encode(String(value??''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function encryptExamCredential({password,examId,examCode,keyBase64,ivBytes}={}){
  const key=await importAesKey(keyBase64,'encrypt');
  const iv=ivBytes==null?crypto.getRandomValues(new Uint8Array(12)):new Uint8Array(ivBytes);
  if(iv.length!==12)throw new Error('Exam credential IV must be exactly 12 bytes');
  const plaintext=new TextEncoder().encode(String(password??''));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aadBytes(examId,examCode),tagLength:128},key,plaintext);
  return {ciphertext:bytesToBase64(new Uint8Array(encrypted)),iv:bytesToBase64(iv),keyVersion:EXAM_CREDENTIAL_KEY_VERSION};
}

export async function decryptExamCredential({ciphertext,iv,keyVersion,examId,examCode,keyBase64}={}){
  if(Number(keyVersion)!==EXAM_CREDENTIAL_KEY_VERSION)throw new Error(`Unsupported exam credential key version: ${keyVersion}`);
  const key=await importAesKey(keyBase64,'decrypt');
  const ivBytes=base64ToBytes(iv,'credential IV');
  if(ivBytes.length!==12)throw new Error('Exam credential IV must be exactly 12 bytes');
  const cipherBytes=base64ToBytes(ciphertext,'credential ciphertext');
  if(!cipherBytes.length)throw new Error('Invalid credential ciphertext');
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:ivBytes,additionalData:aadBytes(examId,examCode),tagLength:128},key,cipherBytes);
  return new TextDecoder().decode(decrypted);
}
