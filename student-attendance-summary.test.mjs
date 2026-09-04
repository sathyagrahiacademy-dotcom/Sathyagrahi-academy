import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('student-attendance.js','utf8');

test('completed unmarked working days count as absent in student summary', () => {
  assert.match(js, /\$\('absent'\)\.textContent\s*=\s*s\.absent\s*\+\s*s\.leave\s*\+\s*s\.unmarked/);
});

test('student history still renders only saved attendance rows', () => {
  assert.match(js, /\(r\.data\s*\|\|\s*\[\]\)\.map/);
  assert.doesNotMatch(js, /report\.days\.filter/);
});
