# Exam Credential Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Admin-only reveal/copy/reset access for every exam's six-digit Exam Password while preserving the existing SHA-256 student verification path and keeping all plaintext passwords out of Postgres, browser storage, URLs, logs, and normal Control Center payloads.

**Architecture:** Keep `public.exam_access` as the student verification source (`exam_code + password_hash`). Store reversible material only in `private.exam_credentials` as AES-256-GCM ciphertext. Browser roles cannot access the private schema. Service-role-only `SECURITY INVOKER` RPCs bridge the private table to Edge Functions. A shared crypto helper uses an Edge Function secret. A dedicated `admin-exam-credentials` function provides `status`, `reveal`, and `reset` after active-Admin authorization. New exam create/edit flows write hash + encrypted credential atomically. The Admin Control Center receives an `ACCESS` button plus a separate credential UI controller so PR #36 workspace/delete routing remains isolated.

**Tech Stack:** Static HTML/CSS/JavaScript, Node 22 tests, Supabase/Postgres, Supabase Edge Functions/Deno, Web Crypto AES-256-GCM, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-11-exam-credential-vault-design.md`

## Global Constraints

- Never store plaintext exam passwords in Postgres, GitHub, browser storage, URLs, analytics, or logs.
- Never store the encryption key in GitHub, SQL, browser code, chat, screenshots, or PR comments.
- Production secret name: `EXAM_CREDENTIAL_ENCRYPTION_KEY_V1`; value must decode to exactly 32 random bytes.
- Do not change Student login passwords, student authentication, Exam Code generation, questions, mapping, audience, attempts, responses, results, performance, or historical result data.
- Do not automatically reset Sep-08 or Sep-10 during migration, deployment, tests, or UAT.
- Keep `student-exam-access` SHA-256 verification semantics unchanged.
- Keep PR #36 single-renderer/delete-routing protections intact.
- Use TDD: RED test → minimum implementation → GREEN → focused regression.
- Production secret creation, DB migration, and Edge deployment happen only after local/full regression and PR CI are green.

---

## Task 1 — Private vault migration contract

**Files**
- Create: `exam-credential-vault-schema.test.mjs`
- Create: `EXAM_CREDENTIAL_VAULT_MIGRATION.sql`

- [ ] Write `exam-credential-vault-schema.test.mjs` first. It must assert the migration defines:
  - `private.exam_credentials` with `exam_id uuid primary key references public.exams(id) on delete cascade`;
  - `ciphertext`, `iv`, positive `key_version`, `created_at`, `updated_at`, `updated_by`;
  - no `anon`/`authenticated` private-schema/table access;
  - service-role-only access;
  - `public.upsert_exam_credential_v1(uuid,text,text,text,text,smallint,uuid)`;
  - `public.get_exam_credential_v1(uuid)`;
  - both RPCs are `SECURITY INVOKER`, not `SECURITY DEFINER`;
  - execute revoked from `PUBLIC`, `anon`, `authenticated` and granted only to `service_role`;
  - paired `public.exam_access` + `private.exam_credentials` writes happen inside the same upsert function.

- [ ] Run RED:
```bash
node --test exam-credential-vault-schema.test.mjs
```
Expected: FAIL because the migration does not exist.

- [ ] Create `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` with exact interfaces:
```sql
public.upsert_exam_credential_v1(
  p_exam_id uuid,
  p_exam_code text,
  p_password_hash text,
  p_ciphertext text,
  p_iv text,
  p_key_version smallint,
  p_updated_by uuid
) returns void

public.get_exam_credential_v1(p_exam_id uuid)
returns table(ciphertext text, iv text, key_version smallint)
```
The upsert RPC must preserve `exam_access.created_at` defaults and the existing unique Exam Code constraint. The read RPC returns only encrypted material for one exam.

- [ ] Run GREEN:
```bash
node --test exam-credential-vault-schema.test.mjs
```
Expected: PASS.

- [ ] Commit:
```bash
git add EXAM_CREDENTIAL_VAULT_MIGRATION.sql exam-credential-vault-schema.test.mjs
git commit -m "feat: add private exam credential vault schema"
```

---

## Task 2 — AES-256-GCM helper

**Files**
- Create: `supabase/functions/_shared/exam-credential-crypto.mjs`
- Create: `exam-credential-crypto.test.mjs`

- [ ] Write tests first against this API:
```js
export const EXAM_CREDENTIAL_KEY_VERSION = 1;
export function credentialSecretName(version = 1) {}
export async function sha256Hex(value) {}
export async function encryptExamCredential({password,examId,examCode,keyBase64,ivBytes}) {}
export async function decryptExamCredential({ciphertext,iv,keyVersion,examId,examCode,keyBase64}) {}
```
Tests must cover: 32-byte key enforcement, 12-byte IV, leading-zero round trip, fresh-IV ciphertext difference, wrong key failure, wrong exam ID/code AAD failure, malformed ciphertext failure, secret-name mapping, and SHA-256 compatibility.

- [ ] Run RED:
```bash
node --test exam-credential-crypto.test.mjs
```
Expected: FAIL.

- [ ] Implement Web Crypto AES-GCM. AAD must be exactly:
```js
`${examId}\n${examCode.trim().toUpperCase()}`
```
If `ivBytes` is omitted, generate `crypto.getRandomValues(new Uint8Array(12))`. Store ciphertext and IV as base64. Never log secret material.

- [ ] Run GREEN:
```bash
node --test exam-credential-crypto.test.mjs
node --check supabase/functions/_shared/exam-credential-crypto.mjs
```
Expected: PASS.

- [ ] Commit:
```bash
git add supabase/functions/_shared/exam-credential-crypto.mjs exam-credential-crypto.test.mjs
git commit -m "feat: add exam credential encryption helper"
```

---

## Task 3 — Admin credential Edge API

**Files**
- Create: `supabase/functions/admin-exam-credentials/index.ts`
- Create: `admin-exam-credentials-security.test.mjs`
- Reuse: `supabase/functions/admin-exam-wizard/password-policy.mjs`

- [ ] Write RED security tests requiring bearer auth, `auth.getUser()`, active Admin profile check before privileged client creation, actions `status/reveal/reset`, no-store reveal headers, `RESET_REQUIRED`, non-draft confirmation, service-role RPC usage, six-digit validation, and absence of password/body logging.

- [ ] Run RED:
```bash
node --test admin-exam-credentials-security.test.mjs
```
Expected: FAIL.

- [ ] Implement exact API contracts.

`status` request:
```json
{"action":"status","examId":"<uuid>"}
```
Response:
```json
{"ok":true,"exam":{"id":"<uuid>","title":"...","examCode":"SGA-DT-011009","status":"draft","isPublished":false,"resultPublished":false},"hasStoredPassword":false}
```

`reveal` request:
```json
{"action":"reveal","examId":"<uuid>"}
```
Success:
```json
{"ok":true,"examCode":"SGA-DT-011009","password":"123456"}
```
No vault row: HTTP 409:
```json
{"error":"Password not stored","code":"RESET_REQUIRED","examCode":"SGA-DT-011009"}
```
Reveal response headers: `Cache-Control: no-store, private`, `Pragma: no-cache`, `Expires: 0`.

`reset` request:
```json
{"action":"reset","examId":"<uuid>","newPassword":"123456","confirmNonDraft":false}
```
For any exam that is not a pure draft, false confirmation returns HTTP 409 with `code:"CONFIRM_NON_DRAFT_REQUIRED"`. Successful reset returns only:
```json
{"ok":true,"examCode":"SGA-DT-011009"}
```
It must not echo the password.

- [ ] Reset path: validate existing 6-digit policy → `sha256Hex` → AES-GCM encrypt → call `upsert_exam_credential_v1`.
- [ ] Reveal path: call `get_exam_credential_v1` → load versioned Edge secret → decrypt.
- [ ] Treat missing/invalid key configuration as a server error without exposing key material.

- [ ] Run GREEN + TS parse:
```bash
node --test admin-exam-credentials-security.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exam-credentials/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-credentials.js --external:*
```
Expected: PASS/exit 0.

- [ ] Commit:
```bash
git add supabase/functions/admin-exam-credentials/index.ts admin-exam-credentials-security.test.mjs
git commit -m "feat: add admin exam credential API"
```

---

## Task 4 — Atomic credential persistence in master exam create/edit

**Files**
- Modify: `supabase/functions/admin-exam-wizard/index.ts`
- Modify: `exam-wizard-password.test.mjs`
- Create: `exam-credential-integration.test.mjs`

- [ ] Add RED assertions requiring:
  - `create_master_exam` to hash + encrypt + call `upsert_exam_credential_v1`;
  - no final direct `exam_access` insert for master credential creation;
  - `update_master_basics` with a non-empty password to load current Exam Code and call the same paired RPC;
  - empty-password edits not to rewrite credentials;
  - partial-exam cleanup to remain if paired persistence fails;
  - `student-exam-access` to keep SHA-256-vs-`password_hash` verification and never read the private vault.

- [ ] Run RED:
```bash
node --test exam-wizard-password.test.mjs exam-credential-integration.test.mjs
```
Expected: new assertions FAIL.

- [ ] Modify `admin-exam-wizard/index.ts` minimally. Import shared `sha256Hex`, `encryptExamCredential`, key-version/secret-name helpers. Remove the duplicate local hash function only after the compatibility test proves identical output.

- [ ] Run GREEN + wizard regression:
```bash
node --test exam-wizard-password.test.mjs exam-credential-integration.test.mjs admin-exam-wizard-basic-contract.test.mjs admin-exam-wizard-ui.test.mjs exam-wizard-policy.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exam-wizard/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-wizard.js --external:*
```
Expected: PASS.

- [ ] Commit:
```bash
git add supabase/functions/admin-exam-wizard/index.ts exam-wizard-password.test.mjs exam-credential-integration.test.mjs
git commit -m "feat: persist master exam credentials atomically"
```

---

## Task 5 — ACCESS UI without route conflicts

**Files**
- Create: `admin-exam-credentials-ui.js`
- Create: `admin-exam-credentials-ui.test.mjs`
- Modify: `admin-exam-control-center.js`
- Modify: `admin-exam-control-center-ui.test.mjs`
- Modify: `admin-exam-control-center-contract.test.mjs`
- Modify: `admin-examinations-nav.js`
- Modify when cache assertion changes: `admin-ui-static-nav-cache.test.mjs`

- [ ] Write RED tests requiring:
  - existing CODE cell gets an `ACCESS` button, no new table column;
  - button uses `data-exam-access`, `data-exam-id`, `data-exam-code`, `data-exam-title`, lifecycle metadata;
  - button has **no `data-id`**, preventing `admin-exam-workspace-route.js` capture;
  - opening modal calls only `status`, never `reveal`;
  - password is masked by default;
  - SHOW explicitly calls reveal;
  - password COPY reveals only if transient plaintext is absent;
  - modal close clears `revealedPassword` and remasks;
  - no Local Storage, Session Storage, IndexedDB, URL/query persistence;
  - missing vault displays `RESET REQUIRED`, disables SHOW/password COPY, keeps reset enabled;
  - reset requires exactly six digits;
  - non-draft reset must display warning before sending `confirmNonDraft:true`;
  - Control Center payload contract excludes `password`, `password_hash`, `ciphertext`, `iv`, `key_version`.

- [ ] Run RED while proving PR #36 protections stay green:
```bash
node --test admin-exam-credentials-ui.test.mjs admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-exam-master-render-ownership.test.mjs
```
Expected: new credential assertions FAIL; existing render/delete ownership assertions PASS.

- [ ] Implement `admin-exam-credentials-ui.js` as separate delegated controller on `#rows`. Inject one compact Academy-styled modal. Use authenticated POST to `/functions/v1/admin-exam-credentials`. Use `navigator.clipboard.writeText` for COPY. Keep plaintext only in transient JS memory and clear it on modal close.

- [ ] Modify `admin-exam-control-center.js` only to add ACCESS markup/metadata inside the CODE cell.
- [ ] Modify `admin-examinations-nav.js` to load the new controller after Control Center. Bump only required cache versions and align the cache-contract test.

- [ ] Run GREEN + routing/syntax regression:
```bash
node --test admin-exam-credentials-ui.test.mjs admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-exam-master-render-ownership.test.mjs admin-ui-static-nav-cache.test.mjs
node --check admin-exam-credentials-ui.js
node --check admin-exam-control-center.js
node --check admin-examinations-nav.js
```
Expected: PASS.

- [ ] Commit:
```bash
git add admin-exam-credentials-ui.js admin-exam-credentials-ui.test.mjs admin-exam-control-center.js admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-examinations-nav.js admin-ui-static-nav-cache.test.mjs
git commit -m "feat: add secure exam access modal"
```

---

## Task 6 — CI contracts

**Files**
- Modify: `.github/workflows/examination-intelligence.yml`
- Modify: `examination-master-ci-contract.test.mjs`

- [ ] Extend CI contract test first to require these fast tests:
  - `exam-credential-vault-schema.test.mjs`
  - `exam-credential-crypto.test.mjs`
  - `admin-exam-credentials-security.test.mjs`
  - `exam-credential-integration.test.mjs`
  - `admin-exam-credentials-ui.test.mjs`
  - browser syntax for `admin-exam-credentials-ui.js`
  - esbuild parse for `supabase/functions/admin-exam-credentials/index.ts`.

- [ ] Run RED:
```bash
node --test examination-master-ci-contract.test.mjs
```
Expected: FAIL.

- [ ] Update workflow while preserving the full root regression step.
- [ ] Run GREEN:
```bash
node --test examination-master-ci-contract.test.mjs
```
Expected: PASS.

- [ ] Commit:
```bash
git add .github/workflows/examination-intelligence.yml examination-master-ci-contract.test.mjs
git commit -m "test: gate exam credential vault security"
```

---

## Task 7 — Full local verification and PR CI before any production change

- [ ] Run focused suite:
```bash
node --test \
  exam-credential-vault-schema.test.mjs \
  exam-credential-crypto.test.mjs \
  admin-exam-credentials-security.test.mjs \
  exam-credential-integration.test.mjs \
  admin-exam-credentials-ui.test.mjs \
  exam-wizard-password.test.mjs \
  admin-exam-control-center-contract.test.mjs \
  admin-exam-control-center-ui.test.mjs \
  admin-exam-master-render-ownership.test.mjs \
  examination-master-ci-contract.test.mjs
```
Expected: 0 failures.

- [ ] Run full root regression:
```bash
node --test *.test.js *.test.mjs *.test.cjs
```
Expected: 0 failures.

- [ ] Run syntax/parsing:
```bash
node --check admin-exam-credentials-ui.js
node --check admin-exam-control-center.js
node --check admin-examinations-nav.js
find . -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx -y esbuild@0.25.9 supabase/functions/admin-exam-credentials/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-credentials.js --external:*
npx -y esbuild@0.25.9 supabase/functions/admin-exam-wizard/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-wizard.js --external:*
```
Expected: exit 0.

- [ ] Inspect diff for forbidden exposure: no production key, no real plaintext exam credential, no password in Control Center payload, no browser storage, no unrelated Result Mail/student-auth/result/performance edits.

- [ ] Open PR `feature/exam-credential-vault` → `main`. Wait until `Examination Intelligence Verification` and all required checks are green. Do not apply production migration or deploy functions before this gate is green.

---

## Task 8 — Backend production rollout after green PR CI

**Production Supabase project:** `lzclqifnylbyftwzpbxy`

- [ ] Generate a 32-byte random production key without saving it into the repository:
```bash
openssl rand -base64 32
```

- [ ] Set that value as Edge Function secret `EXAM_CREDENTIAL_ENCRYPTION_KEY_V1`. Never paste the value into chat/commit/PR/log output.

- [ ] Apply `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` using the approved Supabase migration mechanism.

- [ ] Verify via read-only SQL:
  - private table exists with expected columns/FK;
  - `anon` and `authenticated` have no private table/schema access;
  - only `service_role` can execute the two credential RPCs;
  - existing `exam_access` rows/codes/hashes were not changed by migration alone;
  - vault initially has no rows for old exams unless explicitly reset.

- [ ] Deploy `admin-exam-credentials` and updated `admin-exam-wizard` Edge Functions.

- [ ] Perform only non-destructive backend UAT with `status` on Sep-10 Draft:
  - Exam ID `988e28f6-a0cd-4694-9229-4c68088c2246`
  - Exam Code must remain `SGA-DT-011009`
  - `hasStoredPassword` must be false before manual reset.

Do not call `reset` merely to test deployment.

---

## Task 9 — Merge, Pages deployment, and production UI UAT

- [ ] Re-check PR head SHA and required green checks, then merge only that head.
- [ ] Verify GitHub Pages build + deploy completes successfully at the exact merge SHA.
- [ ] Admin refreshes Examinations and confirms no legacy flash/regression.
- [ ] Sep-10 CODE cell shows ACCESS. Opening it shows Exam Code and `RESET REQUIRED`, with password masked and no automatic reveal.
- [ ] Close/reopen modal and verify no plaintext persists.
- [ ] Sep-08 result-published exam also shows `RESET REQUIRED`; attempts/results/performance counts remain untouched.
- [ ] Do not reset either exam merely for UAT.

When Admin intentionally chooses a new password later:
- [ ] Reset Sep-10 with an exact six-digit chosen password; verify SHOW/COPY returns it, Student verification accepts it, old password fails, Exam Code stays unchanged.
- [ ] Reset Sep-08 only if future password access is needed; require non-draft confirmation and compare attempts/results/performance counts before/after to prove they are unchanged.

## Final Acceptance Gate

Before claiming completion, fresh evidence must show:
- new exam creation creates both `password_hash` and one encrypted vault row;
- Admin reveal works only through protected credential API;
- normal Admin/student payloads expose no plaintext or encrypted secret material;
- old exams without vault rows show `RESET REQUIRED`;
- reset changes only credential state;
- focused tests, full regressions, syntax checks, Edge parses, PR CI, backend rollout, Pages deployment, and production UAT all pass.
