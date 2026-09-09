import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config=fs.readFileSync('supabase-config.js','utf8');
const nav=fs.readFileSync('admin-examinations-nav.js','utf8');

test('Exam Master is enabled only on the Admin Exams page',()=>{
  assert.match(config,/window\.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED\s*=\s*currentFile\s*===\s*['"]admin-exams\.html['"]/);
});

test('Examinations nav still keeps the explicit master gate and legacy fallback',()=>{
  assert.match(nav,/SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED\s*===\s*true/);
  assert.match(nav,/if\s*\(masterPhase1Enabled\)[\s\S]*examControlCenterUi[\s\S]*else[\s\S]*adminExamsEnhancements/);
});
