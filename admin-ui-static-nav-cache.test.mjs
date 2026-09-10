import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const htmlFiles=fs.readdirSync('.').filter(name=>/^admin-.*\.html$/.test(name));

test('every admin portal sidebar that shows Notifications also contains Communications in static HTML',()=>{
  const sidebarPages=htmlFiles.filter(name=>{
    const html=fs.readFileSync(name,'utf8');
    return html.includes('<aside') && html.includes('admin-notifications.html') && html.includes('admin-help-feedback.html');
  });
  assert.ok(sidebarPages.length>0,'expected admin portal pages with sidebar navigation');
  const missing=sidebarPages.filter(name=>!fs.readFileSync(name,'utf8').includes('admin-communications.html'));
  assert.deepEqual(missing,[],`Communications must be static in every admin sidebar; missing in: ${missing.join(', ')}`);
});

test('Examinations page cache-busts the top-level navigation loader after the single-renderer fix',()=>{
  const html=fs.readFileSync('admin-exams.html','utf8');
  assert.match(html,/admin-examinations-nav\.js\?v=20260910-5/,'admin-exams.html must request the single-renderer navigation loader version');
});
