import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('student-attendance.html','utf8');
const js = fs.readFileSync('student-attendance.js','utf8');

test('student attendance history shows actual status with marked time like the earlier student view', () => {
  assert.match(html, /<th>Date<\/th><th>Day<\/th><th>Status<\/th><th>Marked Time<\/th>/);
  assert.doesNotMatch(html, /<th>Academy Day<\/th>/);
  assert.match(js, /function\s+fmtTime\s*\(/);
  assert.match(js, /Today's attendance:[\s\S]{0,180}fmtTime/);
});

test('monthly student rows come from saved attendance records, not synthetic calendar UNMARKED or SUNDAY rows', () => {
  assert.match(js, /\(r\.data\s*\|\|\s*\[\]\)[\s\S]{0,300}\.map/);
  assert.doesNotMatch(js, /report\.days\.filter/);
  assert.match(js, /fmtTime\(x\.marked_at\s*\|\|\s*x\.updated_at\)/);
});
