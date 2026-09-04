import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const css=fs.existsSync('examination-branch-shell.css')?fs.readFileSync('examination-branch-shell.css','utf8'):'';

test('uses shared Examination Branch identity and tagline',()=>{
  assert.match(nav,/EXAMINATION BRANCH/);
  assert.match(nav,/Create\s*•\s*Conduct\s*•\s*Evaluate\s*•\s*Analyse/);
});

test('renders five designed Examination Branch navigation sections',()=>{
  for(const label of ['Exams','Question Bank','Results','Performance','Manual Exams']) assert.match(nav,new RegExp(`['\"]${label}['\"]`));
  for(const desc of ['Create & Manage Exams','Questions & Mapping','Publish & Review Results','Student Exam Analysis','Offline / Manual Records']) assert.match(nav,new RegExp(desc.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(nav,/exam-nav-card/);
  assert.match(nav,/exam-nav-number/);
  assert.match(nav,/exam-nav-copy/);
  assert.match(nav,/examination-branch-shell\.css/);
});

test('styles navigation as a full-width professional module strip',()=>{
  assert.match(css,/\.examination-branch-shell/);
  assert.match(css,/\.exam-section-nav\.branch-nav/);
  assert.match(css,/grid-template-columns:\s*repeat\(5,\s*minmax\(0,1fr\)\)/);
  assert.match(css,/\.exam-nav-card\.active/);
  assert.match(css,/\.exam-nav-number/);
});
