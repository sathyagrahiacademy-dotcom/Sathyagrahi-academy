import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studentPages = [
  'dashboard.html',
  'student-learning-progress.html',
  'student-neet-syllabus.html',
  'student-examinations.html',
  'student-results.html',
  'student-performance.html',
  'student-attendance.html',
  'student-study-material.html',
  'student-notifications.html',
  'student-help-feedback.html',
  'student-my-profile.html'
];

test('all core student pages load the shared nav bootstrap', () => {
  for (const page of studentPages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(html.includes('supabase-config.js'), `${page} must load supabase-config.js`);
  }
});

test('all core student pages render NEET Syllabus statically after Learning Progress', () => {
  for (const page of studentPages) {
    const html = fs.readFileSync(page, 'utf8');
    const learningIndex = html.indexOf('href="student-learning-progress.html"');
    const syllabusIndex = html.indexOf('href="student-neet-syllabus.html"');
    assert.ok(learningIndex >= 0, `${page} missing Learning Progress link`);
    assert.ok(syllabusIndex >= 0, `${page} missing static NEET Syllabus link`);
    assert.ok(syllabusIndex > learningIndex, `${page} must place NEET Syllabus after Learning Progress`);
    assert.match(html, /<a[^>]*href="student-neet-syllabus\.html"[^>]*>\s*NEET Syllabus\s*<\/a>/i, `${page} must render a real NEET Syllabus anchor`);
  }
});

test('shared bootstrap keeps NEET Syllabus as an idempotent fallback only', () => {
  const js = fs.readFileSync('supabase-config.js', 'utf8');
  assert.ok(js.includes('ensureStudentSyllabusNav'));
  assert.ok(js.includes("student-neet-syllabus.html"));
  assert.ok(js.includes("student-learning-progress.html"));
  assert.ok(js.includes("currentFile === 'student-neet-syllabus.html'"));
  assert.ok(js.includes('if (!syllabus)'));
});

test('student NEET Syllabus page exists inside the student portal shell', () => {
  assert.ok(fs.existsSync('student-neet-syllabus.html'), 'student-neet-syllabus.html must exist');
  const html = fs.readFileSync('student-neet-syllabus.html', 'utf8');
  assert.ok(html.includes('NEET Syllabus'));
  assert.ok(html.includes('Physics'));
  assert.ok(html.includes('Chemistry'));
  assert.ok(html.includes('Biology'));
  assert.ok(html.includes('dashboard.css'));
  assert.ok(html.includes('supabase-config.js'));
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
