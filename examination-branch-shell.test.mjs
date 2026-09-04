import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('admin-exams.html','utf8');
const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const css=fs.readFileSync('admin-dashboard.css','utf8');

test('uses Examination Branch identity and tagline',()=>{
  assert.match(html,/EXAMINATION BRANCH/);
  assert.match(html,/Create\s*•\s*Conduct\s*•\s*Evaluate\s*•\s*Analyse/);
});

test('renders five designed Examination Branch navigation sections',()=>{
  for(const label of ['Exams','Question Bank','Results','Performance','Manual Exams']) assert.match(nav,new RegExp(`['\"]${label}['\"]`));
  for(const desc of ['Create & Manage Exams','Questions & Mapping','Publish & Review Results','Student Exam Analysis','Offline / Manual Records']) assert.match(nav,new RegExp(desc.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(nav,/exam-nav-card/);
  assert.match(nav,/exam-nav-number/);
  assert.match(nav,/exam-nav-copy/);
});

test('styles navigation as a full-width professional module strip',()=>{
  assert.match(css,/\.examination-branch-shell/);
  assert.match(css,/\.exam-section-nav\.branch-nav/);
  assert.match(css,/grid-template-columns:\s*repeat\(5,\s*minmax\(0,1fr\)\)/);
  assert.match(css,/\.exam-nav-card\.active/);
  assert.match(css,/\.exam-nav-number/);
});
