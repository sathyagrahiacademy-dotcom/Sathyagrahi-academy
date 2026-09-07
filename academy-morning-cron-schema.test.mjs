import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,readFileSync } from 'node:fs'

const path='./ACADEMY_MORNING_CRON_MIGRATION.sql'
const sql=existsSync(path)?readFileSync(path,'utf8').toLowerCase():''

test('morning cron migration installs secure scheduler infrastructure',()=>{
  assert.equal(existsSync(path),true,'ACADEMY_MORNING_CRON_MIGRATION.sql must exist')
  assert.match(sql,/create extension if not exists pg_cron/)
  assert.match(sql,/create extension if not exists pg_net/)
  assert.match(sql,/verify_academy_morning_cron_key/)
  assert.match(sql,/vault\.create_secret/)
  assert.match(sql,/cron\.schedule/)
  assert.match(sql,/30 1 \* \* \*/)
  assert.match(sql,/academy-morning-cron/)
})

test('cron secret stays server-side and the job reads it from Vault',()=>{
  assert.match(sql,/vault\.decrypted_secrets/)
  assert.doesNotMatch(sql,/x-sga-cron-key['"]?\s*[:=]\s*['"][a-f0-9]{32,}/i)
})
