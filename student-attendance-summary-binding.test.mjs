import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('student-attendance.js','utf8');
const html = fs.readFileSync('student-attendance.html','utf8');

test('monthly attendance query includes student_id so saved PRESENT rows bind to the student summary', () => {
  assert.match(js, /from\('attendance'\)\.select\('student_id,attendance_date,status,marked_at,updated_at'\)/);
});

test('student attendance page loads a fresh script version after summary binding fix', () => {
  assert.match(html, /student-attendance\.js\?v=20260904-3/);
});
