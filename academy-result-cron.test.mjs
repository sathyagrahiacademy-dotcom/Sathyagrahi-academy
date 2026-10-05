import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const moduleUrl=new URL('./supabase/functions/academy-result-cron/result-message.mjs',import.meta.url)
const modulePath=fileURLToPath(moduleUrl)

test('result cron message module exists',()=>{
  assert.equal(existsSync(modulePath),true,'result-message.mjs must exist')
})

if(existsSync(modulePath)){
  const {buildResultDayMessage,deliveryEventKey}=await import(moduleUrl)
  test('attended result mail uses results sender and includes score',()=>{
    const out=buildResultDayMessage({student:{full_name:'Rahul'},exam:{title:'Daily Test',exam_date:'2026-09-08',total_marks:180},result:{total_score:170,percentage:94.44,correct_count:43,wrong_count:2,unattempted_count:0},subjectPerformance:[{subject:'Physics',earned_marks:38,max_marks:48,percentage:79.17}],siteUrl:'https://sathyagrahiacademy.com'})
    assert.equal(out.from,'results@sathyagrahiacademy.com')
    assert.match(out.subject,/Result & Daily Performance/i)
    assert.match(out.html,/170\s*\/\s*180/)
    assert.doesNotMatch(out.html,/NOT ATTENDED/i)
  })
  test('absent result-day mail clearly says not attended and does not invent score',()=>{
    const out=buildResultDayMessage({student:{full_name:'Sathya'},exam:{title:'Daily Test',exam_date:'2026-09-08',total_marks:180},result:null,subjectPerformance:[],siteUrl:'https://sathyagrahiacademy.com'})
    assert.equal(out.from,'results@sathyagrahiacademy.com')
    assert.match(out.html,/NOT ATTENDED/i)
    assert.doesNotMatch(out.html,/0\s*\/\s*180/)
  })
  test('delivery key is stable per exam',()=>{
    assert.equal(deliveryEventKey('exam-123'),'result_day:exam-123')
  })
}

const indexUrl=new URL('./supabase/functions/academy-result-cron/index.ts',import.meta.url)
const indexPath=fileURLToPath(indexUrl)

test('result cron endpoint exists, requires internal cron auth, and only logs communication delivery',()=>{
  assert.equal(existsSync(indexPath),true,'academy-result-cron/index.ts must exist')
  const src=readFileSync(indexPath,'utf8')
  assert.match(src,/verify_academy_morning_cron_key/)
  assert.match(src,/academy_communication_deliveries/)
  assert.match(src,/result_published/)
  assert.doesNotMatch(src,/from\(['"]exam_results['"]\)\.update/)
  assert.doesNotMatch(src,/from\(['"]exam_scope_performance['"]\)\.update/)
})