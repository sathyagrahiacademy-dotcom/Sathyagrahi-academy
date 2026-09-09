import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  'admin-exams.html',
  'admin-question-bank.html',
  'admin-results.html',
  'admin-performance.html',
  'admin-manual-exams.html'
];

async function read(name){ return readFile(new URL(name, import.meta.url), 'utf8'); }

test('all Examination Branch pages use the shared top header shell', async () => {
  for (const page of pages) {
    const src = await read(page);
    assert.match(src, /<main>\s*<header>/i, `${page} must start main content with the shared header`);
    assert.ok(src.includes('<div id="examSectionNav"></div>'), `${page} must render the common branch nav`);
  }
});

test('all Examination Branch pages render Communications statically in the sidebar', async () => {
  for (const page of pages) {
    const src = await read(page);
    assert.ok(src.includes('href="admin-communications.html"'), `${page} must include Communications before JS runs`);
  }
});

test('branch shell gives the section nav one consistent vertical rhythm', async () => {
  const css = await read('examination-branch-shell.css');
  assert.ok(css.includes('.examination-branch-page .content'));
  assert.ok(css.includes('padding-top:30px'));
  assert.ok(css.includes('.examination-branch-page main>header'));
}
