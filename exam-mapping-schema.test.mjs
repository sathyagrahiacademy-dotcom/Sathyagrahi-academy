import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('EXAM_MAPPING_PERFORMANCE_MIGRATION.sql', 'utf8').toLowerCase();

test('migration creates Phase-3 data tables', () => {
  for (const name of ['neet_syllabus_subtopics','exam_mapping_groups','exam_question_syllabus_map','exam_scope_performance']) {
    assert.match(sql, new RegExp(`create table(?: if not exists)?\\s+${name}`));
  }
});

test('mapping is one question to one topic and attempt delete cascades performance', () => {
  assert.match(sql, /question_id[\s\S]{0,160}primary key/);
  assert.match(sql, /attempt_id[\s\S]{0,180}references\s+exam_attempts\s*\(id\)[\s\S]{0,80}on delete cascade/);
});

test('RLS and dynamic E sequence are defined', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /row_number\s*\(\s*\)\s*over/i);
  assert.match(sql, /revoke\s+select[\s\S]+authenticated/i);
});
