import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const moduleUrl=new URL('./supabase/functions/academy-communications/message-builders.mjs',import.meta.url)
const modulePath=fileURLToPath(moduleUrl)

test('communication message builders module exists',()=>{
  assert.equal(existsSync(modulePath),true,'message-builders.mjs must exist')
})

if(existsSync(modulePath)){
  const {buildMorningMessage,buildExamMessage,buildResultMessage}=await import(moduleUrl)

  test('morning plan uses info sender and existing assigned tasks',()=>{
    const out=buildMorningMessage({
      student:{full_name:'Rahul'},
      date:'2026-09-06',
      tasks:[
        {subject:'Physics',chapter:'Thermodynamics',topic:'First Law',task_type:'Study',target_minutes:45,priority:'High'},
        {subject:'Biology',chapter:'Human Reproduction',topic:'Gametogenesis',task_type:'Revision',target_minutes:30,priority:'Medium'}
      ],
      siteUrl:'https://sathyagrahiacademy.com'
    })
    assert.equal(out.from,'info@sathyagrahiacademy.com')
    assert.match(out.subject,/study plan/i)
    assert.match(out.html,/First Law/)
    assert.match(out.html,/Gametogenesis/)
    assert.deepEqual(out.whatsappValues.slice(0,2),['Rahul','06 Sep 2026'])
  })

  test('exam published message uses exams sender and exam facts',()=>{
    const out=buildExamMessage({
      student:{full_name:'Rahul'},
      exam:{title:'Thermodynamics Daily Test',exam_type:'daily',exam_date:'2026-09-06',duration_minutes:45,total_marks:180,subject:'Chemistry'},
      examCode:'SGA-DLY-20260906-001',
      scopeSummary:'Thermodynamics — First Law',
      siteUrl:'https://sathyagrahiacademy.com'
    })
    assert.equal(out.from,'exams@sathyagrahiacademy.com')
    assert.match(out.subject,/exam/i)
    assert.match(out.html,/SGA-DLY-20260906-001/)
    assert.match(out.html,/45 min/)
    assert.match(out.html,/180/)
  })

  test('result message uses results sender and combines today studied with evidence only',()=>{
    const out=buildResultMessage({
      student:{full_name:'Rahul'},
      date:'2026-09-06',
      exam:{title:'Thermodynamics Daily Test',total_marks:180},
      result:{total_score:136,percentage:75.56,correct_count:36,wrong_count:8,unattempted_count:1},
      studySessions:[
        {subject:'Chemistry',chapter:'Thermodynamics',topic:'First Law'},
        {subject:'Chemistry',chapter:'Thermodynamics',topic:'Hess Law'}
      ],
      intelligence:{mentor:{
        strengths:[{topic:'First Law'}],
        priorityWeaknesses:[{topic:'Hess Law'}],
        retentionWatch:[],coverageGaps:[],nextExamFocus:[{topic:'Hess Law Numericals'}]
      }},
      siteUrl:'https://sathyagrahiacademy.com'
    })
    assert.equal(out.from,'results@sathyagrahiacademy.com')
    assert.match(out.html,/First Law/)
    assert.match(out.html,/Hess Law/)
    assert.match(out.html,/136/)
    assert.match(out.html,/36/)
    assert.match(out.html,/8/)
    assert.match(out.html,/Hess Law Numericals/)
  })

  test('result message does not fabricate mentor signals when evidence is absent',()=>{
    const out=buildResultMessage({
      student:{full_name:'Rahul'},date:'2026-09-06',
      exam:{title:'Daily Test',total_marks:180},
      result:{total_score:0,percentage:0,correct_count:0,wrong_count:0,unattempted_count:45},
      studySessions:[],intelligence:{mentor:{}},siteUrl:'https://sathyagrahiacademy.com'
    })
    assert.doesNotMatch(out.html,/Mastered/i)
    assert.match(out.html,/Evidence is still building|No evidence/i)
  })
}
