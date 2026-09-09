import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');

test('master blueprint policy exposes exact ready/action-required result', async () => {
  const src = await read('supabase/functions/admin-exams/publish-validation.mjs');
  assert.match(src, /export function validateMasterBlueprint/);
  for (const token of ['EXAM READY','ACTION REQUIRED','QUESTION_COUNT_MISMATCH','MARKS_MISMATCH','ANSWER_KEY_MISSING','MAPPING_INCOMPLETE','SUBJECT_PLAN_MISMATCH','SCOPE_CONFLICT']) {
    assert.ok(src.includes(token), `missing blueprint policy token: ${token}`);
  }
});

test('admin exams exposes validation and approval actions', async () => {
  const src = await read('supabase/functions/admin-exams/index.ts');
  assert.ok(src.includes("master_blueprint_validation"));
  assert.ok(src.includes("approve_master_blueprint"));
  assert.ok(src.includes('validateMasterBlueprint'));
  assert.ok(src.includes('blueprint_approved_at'));
  assert.match(src, /new Date\(\)\.toISOString\(\)/);
});

test('wizard Step 4 renders validation, exact issues and approval gate', async () => {
  const src = await read('admin-exam-wizard.js');
  for (const token of ['master_blueprint_validation','approve_master_blueprint','EXAM READY','ACTION REQUIRED','APPROVE BLUEPRINT & CONTINUE','mwBlueprintStatus','mwBlueprintIssues','mwApproveBlueprint']) {
    assert.ok(src.includes(token), `missing Step 4 token: ${token}`);
  }
});

test('blueprint PDF surface contains master metadata but never credentials or answer key', async () => {
  const src = await read('admin-exam-blueprint.js');
  for (const token of ['Batch','Exam Date','Expected Questions','Result Publish Mode','Blueprint Approval']) {
    assert.ok(src.includes(token), `missing blueprint PDF metadata: ${token}`);
  }
  assert.equal(src.includes('password_hash'), false);
  assert.equal(src.includes('correct_option'), false);
});
