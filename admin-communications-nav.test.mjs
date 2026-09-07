import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = fs.readdirSync('.').filter((name) => /^admin-.*\.html$/.test(name));
const shared = fs.readFileSync('supabase-config.js', 'utf8');

function hasAdminSidebar(html) {
  return /<aside[\s>]/i.test(html) && /<nav[\s>]/i.test(html) && html.includes('admin-dashboard.html') && html.includes('admin-help-feedback.html');
}

test('every admin sidebar page loads the shared navigation injector', () => {
  const pagesWithSidebar = files.filter((name) => hasAdminSidebar(fs.readFileSync(name, 'utf8')));
  assert.ok(pagesWithSidebar.length >= 10, 'expected admin pages with sidebars');
  const missingSharedScript = pagesWithSidebar.filter((name) => !fs.readFileSync(name, 'utf8').includes('supabase-config.js'));
  assert.deepEqual(missingSharedScript, [], `sidebar page does not load supabase-config.js: ${missingSharedScript.join(', ')}`);
});

test('shared admin navigation guarantees Communications between Notifications and Help & Feedback', () => {
  assert.match(shared, /function\s+ensureAdminCommunicationsNav\s*\(/);
  assert.match(shared, /admin-communications\.html/);
  assert.match(shared, /admin-notifications\.html/);
  assert.match(shared, /admin-help-feedback\.html/);
  assert.match(shared, /insertBefore\(/);
  assert.match(shared, /currentFile\s*===\s*['"]admin-communications\.html['"]/);
});
