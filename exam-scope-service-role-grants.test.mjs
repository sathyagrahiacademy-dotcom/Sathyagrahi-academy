import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readdirSync('.')
  .filter(name => name.endsWith('.sql'))
  .map(name => fs.readFileSync(name, 'utf8'))
  .join('\n');

test('service_role can read canonical exam syllabus hierarchy', () => {
  assert.match(sql, /grant\s+select\s+on\s+public\.neet_syllabus_units\s+to\s+service_role\s*;/i);
  assert.match(sql, /grant\s+select\s+on\s+public\.neet_syllabus_topics\s+to\s+service_role\s*;/i);
});
