import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav = fs.readFileSync('admin-examinations-nav.js','utf8');
const css = fs.readFileSync('admin-dashboard.css','utf8');
const pages = ['admin-exams.html','admin-results.html','admin-performance.html','admin-manual-exams.html'];

test('shared examinations navigation exposes four destinations without Question Bank',()=>{
  const expected = [
    ['admin-exams.html','Exams'],
    ['admin-results.html','Results'],
    ['admin-performance.html','Performance'],
    ['admin-manual-exams.html','Manual Exams']
  ];
  for (const [href,label] of expected) {
    assert.ok(nav.includes(href));
    assert.ok(nav.includes(label));
  }
  assert.equal(nav.includes('admin-question-bank.html'),false);
  assert.equal(nav.includes("'Question Bank'"),false);
  assert.match(nav,/Student Exam Analysis/);
});

test('legacy sidebar hides only Question Bank and Results links',()=>{
  assert.match(css,/aside nav a\[href="admin-question-bank\.html"\][\s\S]*aside nav a\[href="admin-results\.html"\][\s\S]*display\s*:\s*none/i);
  assert.doesNotMatch(css,/aside nav a\[href="admin-performance\.html"\][^{]*\{[^}]*display\s*:\s*none/i);
  assert.doesNotMatch(css,/aside nav a\[href="admin-exams\.html"\][^{]*\{[^}]*display\s*:\s*none/i);
});

test('all examinations pages host and load the shared section navigation',()=>{
  for (const page of pages) {
    const html = fs.readFileSync(page,'utf8');
    assert.match(html,/id="examSectionNav"/,`${page} missing examSectionNav host`);
    assert.match(html,/admin-examinations-nav\.js/,`${page} missing shared nav script`);
  }
});

test('manual exams page is an explicit next-phase shell',()=>{
  const html = fs.readFileSync('admin-manual-exams.html','utf8');
  assert.match(html,/Manual Exams/i);
  assert.match(html,/next phase/i);
  assert.doesNotMatch(html,/exam_attempts|exam_results|insert\s*\(/i);
});

test('results page is results-only and no longer has redundant performance button',()=>{
  const html = fs.readFileSync('admin-results.html','utf8');
  assert.match(html,/<main>\s*<header>[\s\S]*<h1>Results<\/h1>/i);
  assert.doesNotMatch(html,/PERFORMANCE ANALYTICS/);
});
