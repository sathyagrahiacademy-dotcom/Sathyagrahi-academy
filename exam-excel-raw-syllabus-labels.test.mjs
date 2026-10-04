import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {buildSyllabusLookup,validateImportQuestions} from './supabase/functions/admin-question-bank/import-policy.mjs'

const sql=fs.readFileSync('EXAM_EXCEL_RAW_SYLLABUS_LABELS_MIGRATION.sql','utf8')
const admin=fs.readFileSync('supabase/functions/admin-exams/index.ts','utf8')
const ui=fs.readFileSync('admin-exam-questions.js','utf8')
const html=fs.readFileSync('admin-exam-questions.html','utf8')

const row={
  questionNo:1,subject:'Chemistry',unit:'Equilibrium',chapter:'Equilibrium',topic:'Law of Mass Action',
  questionText:'Q?',optionA:'A',optionB:'B',optionC:'C',optionD:'D',correctOption:'A',
  marks:'4',negativeMarks:'1',explanation:'',difficulty:'NEET Level',questionType:'Numerical MCQ',
  source:'NCERT',sourceYear:'2026-27'
}

test('Excel import accepts noncanonical Chapter Topic labels and preserves them',()=>{
  const lookup=buildSyllabusLookup({
    units:[{id:1,subject:'Chemistry',unit_no:6,unit_title:'Equilibrium'}],
    chapters:[{id:10,unit_id:1,topic_title:'Law of chemical equilibrium'}],
    subtopics:[]
  })
  const result=validateImportQuestions(lookup,[row])
  assert.equal(result.ok,true,result.errors.join(' '))
  assert.equal(result.items[0].subject,'Chemistry')
  assert.equal(result.items[0].unitLabel,'Equilibrium')
  assert.equal(result.items[0].chapterLabel,'Equilibrium')
  assert.equal(result.items[0].topicLabel,'Law of Mass Action')
  assert.equal(result.items[0].subtopicId,null)
})

test('raw syllabus labels are stored additively on exam_questions',()=>{
  for(const col of ['subject_label','unit_label','chapter_label','topic_label']){
    assert.match(sql,new RegExp('add column if not exists '+col+' text','i'))
  }
  assert.doesNotMatch(sql,/drop table|truncate|delete from/i)
})

test('direct import never rejects a row only because canonical hierarchy IDs are absent',()=>{
  assert.doesNotMatch(sql,/Invalid Unit hierarchy|Invalid Chapter hierarchy|Topic must be approved/)
  assert.match(sql,/subject_label,unit_label,chapter_label,topic_label/i)
  assert.match(sql,/where \(x->>'subtopicId'\) is not null/i)
})

test('publish validation accepts complete raw Excel syllabus labels as mapping fallback',()=>{
  assert.match(admin,/rawSyllabusMappedIds/)
  assert.match(admin,/subject_label,unit_label,chapter_label,topic_label/)
  assert.match(admin,/effectiveMappedQuestions/)
  assert.match(admin,/rawSyllabusMapping/)
})

test('questions UI displays raw Excel subject and topic when canonical mapping is unavailable',()=>{
  assert.match(ui,/subject_label/)
  assert.match(ui,/topic_label/)
  assert.match(ui,/rawSyllabusReady/)
  assert.match(html,/stored exactly as entered in Excel/i)
})
