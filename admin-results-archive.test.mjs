import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const u=require('./admin-results-archive-utils.js');

test('pending has unpublished only and archive groups by Exam Date',()=>{
  const rows=[
    {attempt_id:'a1',is_published:false,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a2',is_published:true,exam_attempts:{exam_id:'e1',exams:{id:'e1',title:'WT 1',exam_type:'weekly',exam_date:'2026-09-08'}}},
    {attempt_id:'a3',is_published:true,exam_attempts:{exam_id:'e2',exams:{id:'e2',title:'GT 1',exam_type:'grand',exam_date:'2026-10-02'}}}
  ];
  const parts=u.partitionResultRows(rows);
  assert.deepEqual(parts.pending.map(x=>x.attempt_id),['a1']);
  const archive=u.groupPublishedResults(parts.published);
  assert.equal(archive[0].key,'2026-10');
  assert.deepEqual(archive[1].types.map(x=>x.code),['DT','WT','MT','GT']);
  assert.equal(archive[1].types.find(x=>x.code==='WT').exams[0].rows[0].attempt_id,'a2');
});

test('type mapping is DT WT MT GT',()=>{
  assert.equal(u.examTypeCode('daily'),'DT');assert.equal(u.examTypeCode('weekly'),'WT');
  assert.equal(u.examTypeCode('monthly'),'MT');assert.equal(u.examTypeCode('grand'),'GT');
});

test('page has pending/archive hosts and attempt deep link support',()=>{
  const html=fs.readFileSync('admin-results.html','utf8'),js=fs.readFileSync('admin-results.js','utf8');
  for(const id of ['pendingRows','publishedMonths','archiveExamRows'])assert.match(html,new RegExp(id));
  assert.match(js,/URLSearchParams/);assert.match(js,/get\(['"]attempt['"]\)/);
});
