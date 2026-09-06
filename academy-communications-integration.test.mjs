import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const edge=readFileSync(new URL('./supabase/functions/admin-exams/index.ts',import.meta.url),'utf8')
const results=readFileSync(new URL('./admin-results.js',import.meta.url),'utf8')

test('result publication is performed by authenticated admin Edge action, not direct browser mutations',()=>{
  assert.match(results,/adminCall\(\{action:['"]publish_result['"],attemptId/)
  assert.doesNotMatch(results,/from\(['"]exam_results['"]\)\.update\(\{is_published:true\}/)
  assert.doesNotMatch(results,/from\(['"]exams['"]\)\.update\(\{result_published:true\}/)
  assert.match(edge,/action\s*===\s*['"]publish_result['"]/)
})

test('admin Edge has a best-effort internal communication helper',()=>{
  assert.match(edge,/async function bestEffortCommunicate\(/)
  assert.match(edge,/academy-communications/)
  assert.match(edge,/x-sga-internal-key/i)
  assert.match(edge,/ACADEMY_COMMUNICATIONS_INTERNAL_KEY/)
  assert.match(edge,/catch\s*\([^)]*\)\s*\{/)
})

test('exam publication calls communication only after authoritative publish succeeds',()=>{
  const publishPos=edge.indexOf("action==='publish'")>=0?edge.indexOf("action==='publish'"):edge.indexOf('action === \'publish\'')
  assert.ok(publishPos>=0,'admin-exams publish action must exist')
  const section=edge.slice(publishPos,publishPos+7000)
  const dbPublish=Math.max(section.indexOf('is_published:true'),section.indexOf('is_published: true'))
  const communicate=section.indexOf("bestEffortCommunicate('exam_published'")
  assert.ok(dbPublish>=0,'exam must be persisted as published')
  assert.ok(communicate>dbPublish,'exam communication must occur after publication')
})

test('result publication persists result flags before best-effort communication',()=>{
  const marker=edge.indexOf("action==='publish_result'")>=0?edge.indexOf("action==='publish_result'"):edge.indexOf('action === \'publish_result\'')
  assert.ok(marker>=0,'publish_result action must exist')
  const section=edge.slice(marker,marker+7000)
  const resultPublish=section.indexOf('is_published:true')>=0?section.indexOf('is_published:true'):section.indexOf('is_published: true')
  const examFlag=section.indexOf('result_published:true')>=0?section.indexOf('result_published:true'):section.indexOf('result_published: true')
  const communicate=section.indexOf("bestEffortCommunicate('result_published'")
  assert.ok(resultPublish>=0&&examFlag>=0,'result and exam published flags must be persisted')
  assert.ok(communicate>resultPublish&&communicate>examFlag,'result communication must happen after database publication')
})
