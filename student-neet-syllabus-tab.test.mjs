import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studentPages = [
  'dashboard.html',
  'student-learning-progress.html',
  'student-examinations.html',
  'student-results.html',
  'student-performance.html',
  'student-attendance.html',
  'student-study-material.html',
  'student-notifications.html',
  'student-help-feedback.html',
  'student-my-profile.html'
];

const syllabusLink = 'href="student-neet-syllabus.html">NEET Syllabus</a>';

test('student portal pages expose a separate NEET Syllabus sidebar tab', () => {
  for (const page of studentPages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(html.includes(syllabusLink), `${page} is missing the NEET Syllabus tab`);
  }
});

test('student NEET Syllabus page exists inside the student portal shell', () => {
  assert.ok(fs.existsSync('student-neet-syllabus.html'), 'student-neet-syllabus.html must exist');
  const html = fs.readFileSync('student-neet-syllabus.html', 'utf8');
  assert.ok(html.includes('class="side-link active" href="student-neet-syllabus.html">NEET Syllabus</a>'));
  assert.ok(html.includes('NEET Syllabus'));
  assert.ok(html.includes('Physics'));
  assert.ok(html.includes('Chemistry'));
  assert.ok(html.includes('Biology'));
});

test('student syllabus page is read-only and uses only the syllabus master tables', () => {
  assert.ok(fs.existsSync('student-neet-syllabus.js'), 'student-neet-syllabus.js must exist');
  const js = fs.readFileSync('student-neet-syllabus.js', 'utf8');
  assert.ok(js.includes("from('neet_syllabus_units')"));
  assert.ok(js.includes("from('neet_syllabus_topics')"));
  assert.ok(!js.includes("from('student_learning_progress')"));
  assert.ok(!js.includes("from('exam_attempts')"));
  assert.ok(!js.includes('.update('));
  assert.ok(!js.includes('.insert('));
  assert.ok(!js.includes('.delete('));
});
