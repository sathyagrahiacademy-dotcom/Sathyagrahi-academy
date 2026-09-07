import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = fs.readdirSync('.').filter((name) => /^admin-.*\.html$/.test(name));

function hasAdminSidebar(html) {
  return /<aside[\s>]/i.test(html) && /<nav[\s>]/i.test(html) && html.includes('admin-dashboard.html') && html.includes('admin-help-feedback.html');
}

test('every admin sidebar page exposes Communications navigation between Notifications and Help & Feedback', () => {
  const pagesWithSidebar = files.filter((name) => hasAdminSidebar(fs.readFileSync(name, 'utf8')));
  assert.ok(pagesWithSidebar.length >= 10, 'expected admin pages with sidebars');
  const failures = [];
  for (const name of pagesWithSidebar) {
    const html = fs.readFileSync(name, 'utf8');
    const notifications = html.indexOf('href="admin-notifications.html"');
    const communications = html.indexOf('href="admin-communications.html"');
    const help = html.indexOf('href="admin-help-feedback.html"');
    if (!(notifications >= 0 && communications > notifications && help > communications)) failures.push(name);
  }
  assert.deepEqual(failures, [], `Communications missing or misplaced: ${failures.join(', ')}`);
});
