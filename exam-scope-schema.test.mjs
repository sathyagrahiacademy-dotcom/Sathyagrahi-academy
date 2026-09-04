import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync('EXAM_SCOPE_MIGRATION.sql','utf8');

test('creates normalized service-only exam scope storage',()=>{
  assert.match(sql,/create table if not exists public\.exam_scope_items/i);
  assert.match(sql,/exam_id uuid not null references public\.exams\(id\) on delete cascade/i);
  assert.match(sql,/unit_id bigint not null references public\.neet_syllabus_units\(id\)/i);
  assert.match(sql,/chapter_id bigint not null references public\.neet_syllabus_topics\(id\)/i);
  assert.match(sql,/subtopic_id bigint references public\.neet_syllabus_subtopics\(id\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke select, insert, update, delete on public\.exam_scope_items from anon, authenticated/i);
});

test('provides atomic service-role scope replacement',()=>{
  assert.match(sql,/create or replace function public\.replace_exam_scope_items/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/delete from public\.exam_scope_items where exam_id = p_exam_id/i);
  assert.match(sql,/grant execute on function public\.replace_exam_scope_items\(uuid,jsonb\) to service_role/i);
  assert.match(sql,/revoke all on function public\.replace_exam_scope_items\(uuid,jsonb\) from public, anon, authenticated/i);
});