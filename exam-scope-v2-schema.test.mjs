import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('adds atomic service-only scope v2 topic resolver',()=>{
  const sql=fs.readFileSync('EXAM_SCOPE_V2_MIGRATION.sql','utf8');
  assert.match(sql,/create\s+or\s+replace\s+function\s+public\.replace_exam_scope_items_v2/i);
  assert.match(sql,/security\s+definer/i);
  assert.match(sql,/neet_syllabus_subtopics/i);
  assert.match(sql,/status\s*=\s*'approved'/i);
  assert.match(sql,/status\s*=\s*'disabled'/i);
  assert.match(sql,/delete\s+from\s+public\.exam_scope_items/i);
  assert.match(sql,/grant\s+execute[\s\S]+service_role/i);
  assert.match(sql,/revoke\s+all[\s\S]+anon[\s\S]+authenticated/i);
});

test('resolves all rows before replacing exam scope',()=>{
  const sql=fs.readFileSync('EXAM_SCOPE_V2_MIGRATION.sql','utf8').toLowerCase();
  const firstDelete=sql.indexOf('delete from public.exam_scope_items');
  const disabledCheck=sql.indexOf("status = 'disabled'");
  const topicResolution=sql.indexOf('neet_syllabus_subtopics');
  assert.ok(topicResolution>=0 && disabledCheck>=0 && firstDelete>disabledCheck,'scope delete must happen after topic validation/resolution');
  assert.match(sql,/regexp_replace\s*\(/i);
  assert.match(sql,/lower\s*\(/i);
});
