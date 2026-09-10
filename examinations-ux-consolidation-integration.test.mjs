import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/examination-intelligence.yml','utf8');

test('CI explicitly covers Examinations UX contracts and changed Edge',()=>{
  for(const file of [
    'exam-wizard-password.test.mjs',
    'exam-wizard-shell.test.mjs',
    'question-bank-folder-api.test.mjs',
    'question-bank-folder-ui.test.mjs',
    'admin-results-archive.test.mjs',
    'admin-performance-hierarchy-dialog.test.mjs',
    'examinations-ux-consolidation-integration.test.mjs'
  ]) assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));

  assert.doesNotMatch(workflow,/admin-performance-hierarchy\.test\.mjs/);
  assert.match(workflow,/supabase\/functions\/admin-exam-wizard\/index\.ts/);
  assert.match(workflow,/supabase\/functions\/admin-question-bank\/index\.ts/);
  assert.match(workflow,/supabase\/functions\/exam-performance\/index\.ts/);
});
