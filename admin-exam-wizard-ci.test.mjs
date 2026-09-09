import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflow=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8')

test('Examinations CI parses the dedicated master wizard Edge Function',()=>{
  assert.match(workflow,/supabase\/functions\/admin-exam-wizard\/index\.ts/)
  assert.match(workflow,/outfile=\/tmp\/admin-exam-wizard\.js/)
})

test('Examinations CI syntax-checks the master wizard browser controller',()=>{
  assert.match(workflow,/node --check admin-exam-wizard\.js/)
})
