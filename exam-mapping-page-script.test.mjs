import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js = fs.readFileSync('admin-exam-mapping-ui.js','utf8');

test('mapping page script uses the protected admin mapping function', () => {
  assert.match(js, /functions\.invoke\(["']admin-exam-mapping["']/);
});

test('mapping page script refreshes when question rows change', () => {
  assert.match(js, /MutationObserver/);
  assert.match(js, /questionsBody/);
  assert.match(js, /refreshMapping/);
});

test('mapping page script wires mapping and topic administration actions', () => {
  for (const action of ['save_mapping','delete_mapping','generate_subtopics','upsert_subtopic','split_subtopic','merge_subtopics','disable_subtopic']) {
    assert.match(js, new RegExp(action));
  }
});