import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const edge=fs.readFileSync('supabase/functions/admin-exam-credentials/index.ts','utf8')
const ui=fs.readFileSync('admin-exam-credentials-ui.js','utf8')

test('credential reveal validates env key and falls back to protected DB key',()=>{
  assert.match(edge,/function isUsableCredentialKey/)
  assert.match(edge,/admin\.rpc\(['"]get_exam_credential_encryption_key_v1['"]\)/)
  assert.match(edge,/await readKey\(admin,keyVersion\)/)
  assert.match(edge,/await readKey\(admin,keyVersion\)/)
})

test('clipboard copy has a fallback when navigator clipboard is unavailable or fails',()=>{
  assert.match(ui,/async function copyText/)
  assert.match(ui,/navigator\.clipboard/)
  assert.match(ui,/document\.execCommand\(['"]copy['"]\)/)
  assert.match(ui,/copyText\(currentExam\.examCode\)/)
  assert.match(ui,/copyText\(password\)/)
})
