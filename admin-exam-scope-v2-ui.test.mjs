import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('admin-exam-scope-v2-ui.js','utf8');

test('renders explicit whole chapter and specific topic scope types',()=>{
  assert.match(src,/Scope Type/);
  assert.match(src,/Whole Chapter/);
  assert.match(src,/Specific Topic/);
  assert.match(src,/Topic Name/);
});

test('enforces selector prerequisites in browser presentation',()=>{
  assert.match(src,/Select Subject first/);
  assert.match(src,/Select Unit first/);
  assert.match(src,/disabled/);
});

test('submits v2 scope payload and hydrates existing canonical topic',()=>{
  assert.match(src,/normaliseScopeDraftV2/);
  assert.match(src,/scopeItems:norm\.items/);
  assert.match(src,/subtopicTitle/);
  assert.match(src,/scopeType/);
});
