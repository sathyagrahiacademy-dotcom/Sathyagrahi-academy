import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('student attendance loads the latest summary script version', () => {
  const html = fs.readFileSync('student-attendance.html', 'utf8');
  assert.match(html, /student-attendance\.js\?v=20260904-2/);
});
