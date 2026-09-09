import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('admin-exam-wizard.js','utf8');
const release=fs.readFileSync('admin-exam-wizard-release.js','utf8');

test('outer Wizard has stable height and only step region scrolls',()=>{
  assert.match(js,/\.master-wizard-card\{[^}]*height:min\(760px,94vh\)/s);
  assert.match(js,/\.master-wizard-card\{[^}]*overflow:hidden/s);
  assert.match(js,/\.mw-body\{[^}]*display:flex[^}]*min-height:0/s);
  assert.match(js,/\.mw-step-scroll\{[^}]*overflow-y:auto/s);
  assert.match(js,/class="mw-step-scroll"/);
});

test('release module does not resize the outer card',()=>{
  assert.doesNotMatch(release,/master-wizard-card[^\n]*(height|max-height|overflow)/);
});
