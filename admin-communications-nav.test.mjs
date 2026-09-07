import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = fs.readdirSync('.').filter((name) => /^admin-.*\.html$/.test(name));

test('every admin sidebar page exposes Communications navigation', () => {
  const pagesWithSidebar = files.filter((name) => fs.readFileSync(name, 'utf8').includes('class="side-link"'));
  assert.ok(pagesWithSidebar.length > 0, 'expected admin pages with sidebars');
  const missing = pagesWithSidebar.filter((name) => !fs.readFileSync(name, 'utf8').includes('href="admin-communications.html"'));
  assert.deepEqual(missing, [], `missing Communications link: ${missing.join(', ')}`);
});
