# Central Question Bank + Auto Mapping + Blueprint Implementation Plan

**Goal:** Add permanent syllabus-aware Question Bank storage, automatic canonical mapping for AI-generated Excel imports, automatic bank reuse, and downloadable exam Blueprint PDF without changing student grading semantics.

**Branch:** `feature/central-question-bank-blueprint`

## Task 1 — Lock schema and import contracts with tests

**Create:**
- `question-bank-schema.test.mjs`
- `question-bank-import-policy.test.mjs`
- `QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql`

**Steps:**
1. Write RED tests asserting migration creates `question_bank_questions`, adds `bank_question_id` + metadata snapshot columns to `exam_questions`, enables RLS, revokes browser DML, grants service-role access, and defines atomic import/reuse RPCs.
2. Write RED tests for canonical label normalization/resolution policy: exact normalized hierarchy succeeds; wrong Unit/Chapter/Topic fails; disabled/suggested Topic does not auto-map.
3. Run the tests and confirm they fail for missing implementation.
4. Add minimal migration and pure import-policy module needed to make tests green.
5. Re-run tests.

## Task 2 — Upgrade Excel template and browser validation

**Modify:**
- `admin-exam-questions.js`
- `admin-exam-questions.html` only if copy/help text needs update

**Create:**
- `exam-question-import-ui.test.mjs`

**Steps:**
1. RED test expected template headers: Subject, Unit, Chapter, Topic, Difficulty, Question Type, Source, Source Year.
2. RED test parser emits these fields and validates required syllabus fields for bulk automatic mapping.
3. Update template sample and parser.
4. Add UI summary wording explaining `AUTO MAP` and `Needs Review` behavior.
5. Run test + `node --check admin-exam-questions.js`.

## Task 3 — Make bulk import atomic and syllabus-aware

**Modify:**
- Supabase deployed `admin-exam-questions` Edge Function

**Add source snapshot:**
- `supabase/functions/admin-exam-questions/index.ts`
- `supabase/functions/admin-exam-questions/import-policy.mjs`

**Create:**
- `admin-exam-question-import-contract.test.mjs`

**Steps:**
1. RED tests require `bulk_add` to validate canonical Subject -> Unit -> Chapter -> approved Topic, return row-specific errors, compute bank hash, and call one atomic RPC rather than sequential inserts.
2. Implement pure resolver/normalization helpers.
3. Update Edge Function `bulk_add` to resolve all rows before any write and call `import_exam_questions_to_bank` RPC once.
4. Preserve existing `add`, `update`, `get`, `delete` semantics.
5. Re-run contract tests and syntax/source checks.

## Task 4 — Sync manual mapping into permanent Question Bank

**Modify:**
- `supabase/functions/admin-exam-mapping/index.ts`
- `QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql` RPCs as needed

**Create:**
- `question-bank-manual-sync.test.mjs`

**Steps:**
1. RED test: successful `save_mapping` triggers bank sync for mapped exam questions lacking `bank_question_id`.
2. Implement service-only `sync_exam_questions_to_bank(exam_id, question_ids)` RPC or equivalent server helper.
3. Invoke only after canonical mapping save succeeds.
4. Confirm existing mapping validation behavior is unchanged.

## Task 5 — Replace Question Bank with central-bank backend

**Create:**
- `supabase/functions/admin-question-bank/index.ts`
- `question-bank-ui-contract.test.mjs`

**Modify:**
- `admin-question-bank.html`
- `admin-question-bank.js`

**Steps:**
1. RED tests require protected bank API with `list` and `add_to_exam` actions.
2. Implement `list` with canonical hierarchy labels and filter-ready metadata.
3. Implement `add_to_exam` using one service-only RPC that copies bank records into `exam_questions`, answer keys and mappings as independent snapshots.
4. Update UI filters to Subject, Unit, Chapter, Topic, Difficulty, Type.
5. Keep multi-select `ADD SELECTED TO EXAM` flow; target exam must be draft/unpublished.
6. Re-run tests and JS checks.

## Task 6 — Add Blueprint data endpoint

**Modify:**
- `supabase/functions/admin-exams/index.ts`

**Create:**
- `exam-blueprint-data.test.mjs`

**Steps:**
1. RED test for `action:'blueprint'` requiring exam metadata, code, canonical coverage, question metadata, mapping groups/labels, validation, audience count, and first submitted date.
2. Implement the action using service-role reads; never return password/hash.
3. Aggregate distributions client-side to keep endpoint simple.
4. Re-run exam backend regression tests.

## Task 7 — Add branded Blueprint PDF download

**Create:**
- `admin-exam-blueprint.js`
- `exam-blueprint-utils.mjs`
- `exam-blueprint-ui.test.mjs`

**Modify:**
- `admin-exams.html`
- `admin-exams-enhancements.js` or `admin-exams.js` only where action wiring is safest

**Steps:**
1. RED tests for Blueprint action/button, Draft/Final classification, distribution aggregation, and exclusion of passwords/answer content.
2. Add jsPDF + AutoTable CDN scripts using the project’s existing CDN pattern.
3. Add `BLUEPRINT PDF` action without rebuilding existing exam action handlers.
4. Render academy-blue PDF sections: Identity, Coverage, Distribution, Mapping Blueprint, Marks, Difficulty/Type, Validation, Audience/Conduct.
5. Filename: `<exam-code>_Exam_Blueprint.pdf`.
6. Run JS syntax + pure aggregation tests.

## Task 8 — Full verification and production rollout

**Verification:**
- Run all new tests plus existing exam scope/mapping/import/archive tests.
- `node --check` all modified browser JS.
- Review final branch diff for grading/publish/result/student unintended changes.

**Production rollout order:**
1. Apply `QUESTION_BANK_AUTO_MAPPING_MIGRATION.sql` through Supabase migration tool.
2. Verify schema, RLS, service-role privileges and RPC existence.
3. Deploy updated `admin-exam-questions` with JWT verification enabled.
4. Deploy updated `admin-exam-mapping` with JWT verification enabled.
5. Deploy new `admin-question-bank` with JWT verification enabled.
6. Deploy updated `admin-exams` with JWT verification enabled.
7. Run Supabase security advisor.
8. Re-check production counts and no unintended historical rewrites.
9. Open PR, review, confirm mergeable, squash merge to `main` under standing user authorization.
10. Fetch `main` after merge and report the exact SHA.

## Non-goals

- No AI inference/fuzzy topic guessing inside the website.
- No student-facing Question Bank.
- No question-paper PDF or answer-key PDF in this change.
- No changes to grading formulas, attempts, re-exam/reset, result publication, attendance, or student authentication.
