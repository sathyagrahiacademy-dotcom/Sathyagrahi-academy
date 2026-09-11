# Exam Credential Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Admin-only reveal/copy/reset access for every exam's six-digit Exam Password while preserving the existing SHA-256 student verification path and keeping all plaintext passwords out of Postgres, browser storage, URLs, logs, and normal Control Center payloads.

**Architecture:** Keep `public.exam_access` as the student verification source (`exam_code + password_hash`). Add `private.exam_credentials` for AES-256-GCM ciphertext, accessed only through service-role-only `SECURITY INVOKER` RPCs. A shared crypto helper encrypts/decrypts using an Edge Function secret. A dedicated `admin-exam-credentials` Edge Function provides `status`, `reveal`, and `reset` actions after active-Admin authorization. New exam create/edit flows write hash + encrypted credential atomically through the same RPC. The Admin Control Center gets an `ACCESS` button and a separate credential UI controller so existing workspace/delete routing stays isolated.

**Tech Stack:** Static HTML/CSS/JavaScript, Node 22 tests, Supabase/Postgres, Supabase Edge Functions/Deno, Web Crypto AES-256-GCM, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-11-exam-credential-vault-design.md`

## Global Constraints

- Do not store exam passwords in plaintext in Postgres, GitHub, Local Storage, Session Storage, IndexedDB, URLs, analytics, or logs.
- Do not modify student login passwords or build a general password manager.
- Do not change Exam Code generation.
- Do not alter exam questions, mappings, audience, attempts, responses, results, performance, or historical result data.
- Do not reset Sep-08 or Sep-10 passwords automatically during development, migration, deployment, or UAT.
- Keep `student-exam-access` SHA-256 verification semantics unchanged.
- Keep PR #36 single-renderer/delete-routing protections intact.
- Every implementation task follows RED → minimal GREEN → regression verification.
- Never commit the encryption key. Production key name is `EXAM_CREDENTIAL_ENCRYPTION_KEY_V1` and its value is base64 for exactly 32 random bytes.

---

## Task 1 — Lock the private-vault database contract with RED tests

**Files:**
- Create: `exam-credential-vault-schema.test.mjs`
- Create later in this task: `EXAM_CREDENTIAL_VAULT_MIGRATION.sql`

- [ ] Create `exam-credential-vault-schema.test.mjs` first. Read `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` and assert that the migration contains all of these contracts:
  - `create schema if not exists private`
  - `private.exam_credentials`
  - `exam_id uuid primary key` with `references public.exams(id) on delete cascade`
  - non-null `ciphertext`, `iv`, positive `key_version`, timestamps, `updated_by`
  - revoked access for `public`, `anon`, and `authenticated`
  - service-role access only where required
  - `public.upsert_exam_credential_v1(uuid,text,text,text,text,smallint,uuid)`
  - `public.get_exam_credential_v1(uuid)`
  - both functions use `security invoker`
  - both functions revoke execution from `public`, `anon`, and `authenticated`
  - both grant execution only to `service_role`
  - upsert RPC writes `public.exam_access` and `private.exam_credentials` in one function body.

- [ ] Run the RED test:

```bash
node --test exam-credential-vault-schema.test.mjs
```

Expected: FAIL because `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` does not exist yet.

- [ ] Create `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` with this exact database interface:

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

The migration must:
- create `private.exam_credentials`;
- revoke private schema/table access from browser roles;
- grant the privileged role only the table permissions needed by the two RPCs;
- make `upsert_exam_credential_v1` atomically upsert the existing `public.exam_access` row and the private vault row;
- make `get_exam_credential_v1` return only ciphertext/IV/key version for one exam;
- use `SECURITY INVOKER`, never `SECURITY DEFINER`;
- preserve `exam_access.created_at` defaults and existing unique Exam Code semantics.

- [ ] Run GREEN:

```bash
node --test exam-credential-vault-schema.test.mjs
```

Expected: PASS.

- [ ] Before production application, execute the migration through the approved Supabase migration mechanism, then verify with read-only SQL:
  - `private.exam_credentials` exists;
  - `anon`/`authenticated` have no private table privileges;
  - RPC execute grants exist only for `service_role`;
  - no existing `exam_access` row changed merely by applying the migration.

- [ ] Commit checkpoint:

```bash
git add EXAM_CREDENTIAL_VAULT_MIGRATION.sql exam-credential-vault-schema.test.mjs
git commit -m "feat: add private exam credential vault schema"
```

---

## Task 2 — Build and prove the AES-256-GCM crypto helper

**Files:**
- Create: `supabase/functions/_shared/exam-credential-crypto.mjs`
- Create: `exam-credential-crypto.test.mjs`

- [ ] Write `exam-credential-crypto.test.mjs` first against this public helper API:

```js
export const EXAM_CREDENTIAL_KEY_VERSION = 1;
export function credentialSecretName(version = 1) {}
export async function sha256Hex(value) {}
export async function encryptExamCredential({
  password, examId, examCode, keyBase64, ivBytes
}) {}
export async function decryptExamCredential({
  ciphertext, iv, keyVersion, examId, examCode, keyBase64
}) {}
```

Required tests:
- exactly 32 decoded key bytes accepted; other sizes rejected;
- exactly 12 IV bytes used;
- round-trip preserves passwords including leading zero, e.g. `000001`;
- two encryptions with different IVs produce different ciphertext;
- wrong key fails closed;
- wrong Exam ID fails closed;
- wrong Exam Code fails closed;
- malformed base64/ciphertext fails closed;
- `credentialSecretName(1)` returns `EXAM_CREDENTIAL_ENCRYPTION_KEY_V1`;
- `sha256Hex('123456')` remains compatible with the current student access hash.

- [ ] Run RED:

```bash
node --test exam-credential-crypto.test.mjs
```

Expected: FAIL because the helper does not exist.

- [ ] Implement the helper using Web Crypto only:
  - AES-GCM with 256-bit imported raw key;
  - fresh `crypto.getRandomValues(new Uint8Array(12))` when `ivBytes` is not injected;
  - authenticated additional data exactly `examId + "\n" + examCode.trim().toUpperCase()`;
  - base64 encode ciphertext and IV;
  - never log password, key, plaintext, or decrypted value.

- [ ] Run GREEN and syntax check:

```bash
node --test exam-credential-crypto.test.mjs
node --check supabase/functions/_shared/exam-credential-crypto.mjs
```

Expected: both PASS.

- [ ] Commit checkpoint:

```bash
git add supabase/functions/_shared/exam-credential-crypto.mjs exam-credential-crypto.test.mjs
git commit -m "feat: add exam credential encryption helper"
```

---

## Task 3 — Create the Admin-only credential Edge Function

**Files:**
- Create: `supabase/functions/admin-exam-credentials/index.ts`
- Create: `admin-exam-credentials-security.test.mjs`
- Reuse: `supabase/functions/admin-exam-wizard/password-policy.mjs`
- Reuse: `supabase/functions/_shared/exam-credential-crypto.mjs`

- [ ] Write `admin-exam-credentials-security.test.mjs` first. Static contract assertions must prove:
  - bearer token is required before any action;
  - `auth.getUser()` runs;
  - profile must be `role === 'admin'` and active;
  - privileged client is created only after Admin authorization;
  - actions `status`, `reveal`, `reset` exist;
  - `reveal` adds `Cache-Control: no-store, private`, `Pragma: no-cache`, and `Expires: 0`;
  - old rows without vault data return machine-readable `RESET_REQUIRED`;
  - reset imports and uses the existing six-digit password policy;
  - reset requires `confirmNonDraft === true` for any exam that is not a pure draft;
  - reset uses `upsert_exam_credential_v1` rather than direct independent writes;
  - reveal uses `get_exam_credential_v1`;
  - source contains no logging of request body/password/decrypted plaintext.

- [ ] Run RED:

```bash
node --test admin-exam-credentials-security.test.mjs
```

Expected: FAIL because the function does not exist.

- [ ] Implement `supabase/functions/admin-exam-credentials/index.ts` with exact request/response contracts:

`status` request:
```json
{"action":"status","examId":"<uuid>"}
```
Response:
```json
{
  "ok": true,
  "exam": {
    "id": "<uuid>",
    "title": "...",
    "examCode": "SGA-DT-011009",
    "status": "draft",
    "isPublished": false,
    "resultPublished": false
  },
  "hasStoredPassword": false
}
```

`reveal` request:
```json
{"action":"reveal","examId":"<uuid>"}
```
Success response:
```json
{"ok":true,"examCode":"SGA-DT-011009","password":"123456"}
```
Missing vault response: HTTP 409 with:
```json
{"error":"Password not stored","code":"RESET_REQUIRED","examCode":"SGA-DT-011009"}
```

`reset` request:
```json
{
  "action":"reset",
  "examId":"<uuid>",
  "newPassword":"123456",
  "confirmNonDraft":false
}
```
If non-draft confirmation is needed: HTTP 409 with code `CONFIRM_NON_DRAFT_REQUIRED`.
Success response:
```json
{"ok":true,"examCode":"SGA-DT-011009"}
```
Do not echo the password from reset.

- [ ] Load encryption key using `credentialSecretName(keyVersion)` and `Deno.env.get(...)`. Treat missing/invalid key configuration as a server error without exposing key material.

- [ ] Hash with shared `sha256Hex`, encrypt, and call `upsert_exam_credential_v1` for reset.

- [ ] Run GREEN and TypeScript parse:

```bash
node --test admin-exam-credentials-security.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exam-credentials/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-credentials.js --external:*
```

Expected: PASS/exit 0.

- [ ] Commit checkpoint:

```bash
git add supabase/functions/admin-exam-credentials/index.ts admin-exam-credentials-security.test.mjs
git commit -m "feat: add admin exam credential API"
```

---

## Task 4 — Make all future exam password writes atomic and retrievable

**Files:**
- Modify: `supabase/functions/admin-exam-wizard/index.ts`
- Modify: `exam-wizard-password.test.mjs`
- Create: `exam-credential-integration.test.mjs`

- [ ] Extend `exam-wizard-password.test.mjs` and create `exam-credential-integration.test.mjs` before production edits. RED assertions must require that:
  - `create_master_exam` imports the shared credential helper;
  - create flow computes hash + encrypted credential and calls `upsert_exam_credential_v1`;
  - create flow no longer directly inserts `exam_access` as the final credential write;
  - `update_master_basics` with a non-empty `examPassword` loads the existing Exam Code, encrypts the new password, and calls the same RPC;
  - password-empty edits do not rewrite credentials;
  - partial-exam cleanup remains in place if paired credential persistence fails;
  - student verification still compares SHA-256 incoming hash with `exam_access.password_hash` and never reads the private vault.

- [ ] Run RED:

```bash
node --test exam-wizard-password.test.mjs exam-credential-integration.test.mjs
```

Expected: new assertions FAIL.

- [ ] Modify `supabase/functions/admin-exam-wizard/index.ts` minimally:
  - import `sha256Hex`, `encryptExamCredential`, and key-version helpers;
  - remove duplicated local hash implementation after compatibility is proven;
  - create flow: exam → allocate code → hash → encrypt → `upsert_exam_credential_v1` → response;
  - update password flow: derive existing Exam Code → hash → encrypt → same RPC;
  - preserve all other wizard behavior.

- [ ] Run GREEN plus existing wizard suite:

```bash
node --test exam-wizard-password.test.mjs exam-credential-integration.test.mjs admin-exam-wizard-basic-contract.test.mjs admin-exam-wizard-ui.test.mjs exam-wizard-policy.test.mjs
npx -y esbuild@0.25.9 supabase/functions/admin-exam-wizard/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-wizard.js --external:*
```

Expected: all PASS.

- [ ] Commit checkpoint:

```bash
git add supabase/functions/admin-exam-wizard/index.ts exam-wizard-password.test.mjs exam-credential-integration.test.mjs
git commit -m "feat: persist master exam credentials atomically"
```

---

## Task 5 — Add the ACCESS modal without disturbing Control Center routing

**Files:**
- Create: `admin-exam-credentials-ui.js`
- Create: `admin-exam-credentials-ui.test.mjs`
- Modify: `admin-exam-control-center.js`
- Modify: `admin-exam-control-center-ui.test.mjs`
- Modify: `admin-exam-control-center-contract.test.mjs`
- Modify: `admin-examinations-nav.js`
- Modify only if cache contract requires: `admin-ui-static-nav-cache.test.mjs`

- [ ] Write RED frontend tests first. Required contracts:
  - CODE cell contains an `ACCESS` button;
  - ACCESS button uses `data-exam-access`, `data-exam-id`, `data-exam-code`, `data-exam-title`, and lifecycle metadata;
  - ACCESS button must **not** use `data-id`, so `admin-exam-workspace-route.js` cannot capture it;
  - credential modal is masked on open;
  - open performs `status`, not `reveal`;
  - `SHOW` explicitly calls `reveal`;
  - password `COPY` calls reveal if no plaintext is already in transient memory;
  - modal close clears transient `revealedPassword` and remasks;
  - no Web Storage/IndexedDB/query-string persistence;
  - old exam state renders `RESET REQUIRED` and disables SHOW/password COPY;
  - reset input accepts exactly six digits;
  - non-draft reset requires explicit warning/confirmation before `confirmNonDraft:true` is sent;
  - Control Center ordinary payload tests reject `password`, `password_hash`, `ciphertext`, `iv`, and `key_version` secret material.

- [ ] Run RED:

```bash
node --test admin-exam-credentials-ui.test.mjs admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-exam-master-render-ownership.test.mjs
```

Expected: credential UI assertions FAIL while existing ownership tests remain PASS.

- [ ] Implement `admin-exam-credentials-ui.js` as a separate controller:
  - delegated click listener on `#rows` for `[data-exam-access]`;
  - inject one compact Academy-styled modal dynamically;
  - authenticated POST helper targeting `/functions/v1/admin-exam-credentials`;
  - code COPY uses `navigator.clipboard.writeText`;
  - SHOW calls `reveal` only on explicit click;
  - password COPY uses transient in-memory plaintext only;
  - RESET uses a six-digit input inside the modal;
  - close resets all credential state and input fields.

- [ ] Modify `admin-exam-control-center.js` only to render/access metadata in the existing CODE cell. Do not add a tenth table column and do not attach credential behavior there.

- [ ] Modify `admin-examinations-nav.js` to load `admin-exam-credentials-ui.js` after Control Center is available. Bump only the necessary cache versions and update the existing cache-contract test when required.

- [ ] Run GREEN and routing regression:

```bash
node --test admin-exam-credentials-ui.test.mjs admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-exam-master-render-ownership.test.mjs admin-ui-static-nav-cache.test.mjs
node --check admin-exam-credentials-ui.js
node --check admin-exam-control-center.js
node --check admin-examinations-nav.js
```

Expected: all PASS.

- [ ] Commit checkpoint:

```bash
git add admin-exam-credentials-ui.js admin-exam-credentials-ui.test.mjs admin-exam-control-center.js admin-exam-control-center-ui.test.mjs admin-exam-control-center-contract.test.mjs admin-examinations-nav.js admin-ui-static-nav-cache.test.mjs
git commit -m "feat: add secure exam access modal"
```

---

## Task 6 — Add CI gates for credential security and parsing

**Files:**
- Modify: `.github/workflows/examination-intelligence.yml`
- Modify: `examination-master-ci-contract.test.mjs`

- [ ] Extend `examination-master-ci-contract.test.mjs` first to require the workflow to include:
  - `exam-credential-vault-schema.test.mjs`
  - `exam-credential-crypto.test.mjs`
  - `admin-exam-credentials-security.test.mjs`
  - `exam-credential-integration.test.mjs`
  - `admin-exam-credentials-ui.test.mjs`
  - `node --check admin-exam-credentials-ui.js`
  - esbuild parse of `supabase/functions/admin-exam-credentials/index.ts`.

- [ ] Run RED:

```bash
node --test examination-master-ci-contract.test.mjs
```

Expected: FAIL until workflow is updated.

- [ ] Update `.github/workflows/examination-intelligence.yml` with the new fast contracts, browser syntax check, and Edge TypeScript parse while preserving the full root regression step.

- [ ] Run GREEN:

```bash
node --test examination-master-ci-contract.test.mjs
```

Expected: PASS.

- [ ] Commit checkpoint:

```bash
git add .github/workflows/examination-intelligence.yml examination-master-ci-contract.test.mjs
git commit -m "test: gate exam credential vault security"
```

---

## Task 7 — Configure the production key, apply DB migration, deploy the Edge Function safely

**Production project:** `lzclqifnylbyftwzpbxy`

- [ ] Generate a 32-byte random key locally without writing it into repository files:

```bash
openssl rand -base64 32
```

- [ ] Set the generated value as Supabase Edge Function secret `EXAM_CREDENTIAL_ENCRYPTION_KEY_V1`. Do not paste the value into chat, commits, PR comments, logs, screenshots, or migration SQL.

- [ ] Apply `EXAM_CREDENTIAL_VAULT_MIGRATION.sql` through the approved Supabase migration mechanism.

- [ ] Run database verification queries that confirm grants/functions/table shape without reading or creating plaintext credentials.

- [ ] Deploy `admin-exam-credentials` and the updated `admin-exam-wizard` Edge Function.

- [ ] Verify function configuration and a non-destructive authorized `status` call against the Sep-10 draft exam:
  - Exam ID: `988e28f6-a0cd-4694-9229-4c68088c2246`
  - expected Exam Code: `SGA-DT-011009`
  - expected `hasStoredPassword:false` before any manual reset.

Do **not** call reset during deployment verification.

---

## Task 8 — Run the full verification gate before PR/merge

- [ ] Run focused credential tests:

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

- [ ] Run the complete root regression suite:

```bash
node --test *.test.js *.test.mjs *.test.cjs
```

Expected: 0 failures.

- [ ] Run browser syntax checks:

```bash
node --check admin-exam-credentials-ui.js
node --check admin-exam-control-center.js
node --check admin-examinations-nav.js
node --check admin-exam-wizard.js
find . -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: exit 0.

- [ ] Parse changed Edge Functions:

```bash
npx -y esbuild@0.25.9 supabase/functions/admin-exam-credentials/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-credentials.js --external:*
npx -y esbuild@0.25.9 supabase/functions/admin-exam-wizard/index.ts --bundle --platform=neutral --loader:.ts=ts --format=esm --outfile=/tmp/admin-exam-wizard.js --external:*
```

Expected: exit 0.

- [ ] Inspect final diff specifically for forbidden secret exposure:
  - no key value;
  - no plaintext password literals representing production credentials;
  - no password included in Control Center list payload;
  - no browser storage use;
  - no unrelated Result Mail, student auth, results, or performance changes.

- [ ] Open a PR from `feature/exam-credential-vault` to `main`. Wait for `Examination Intelligence Verification` and all other required checks to be green before merge.

---

## Task 9 — Production UAT without destructive credential changes

After GitHub Pages deployment succeeds at the exact merge SHA:

- [ ] Admin opens Examinations and confirms no legacy-page flash/regression.
- [ ] Sep-10 Draft CODE cell shows `ACCESS`.
- [ ] Open ACCESS: Exam Code is visible; password remains masked; UI shows `RESET REQUIRED` because no encrypted copy exists yet.
- [ ] Close modal and reopen; no revealed/plain password persists.
- [ ] Open Sep-08 result-published exam ACCESS; it also shows `RESET REQUIRED` and no historical results/performance change.
- [ ] Do not reset either exam merely for UAT.

Only after the Admin intentionally chooses new passwords:

- [ ] Reset Sep-10 with a chosen six-digit password, then verify SHOW/COPY returns that exact value and Student verification accepts it.
- [ ] Reset Sep-08 only if future password access is actually needed, with the stronger non-draft confirmation. Before and after counts for its attempts/results/performance must remain identical.
- [ ] Verify the previous password fails after a successful reset.
- [ ] Verify Exam Code remains unchanged.

## Final Acceptance Gate

Before calling the feature complete, collect fresh evidence that:

- new exam creation produces both a valid `password_hash` and one encrypted vault row;
- Admin reveal works only through the protected credential endpoint;
- ordinary Control Center and student APIs expose no plaintext/encrypted secret material;
- old exams without vault data show `RESET REQUIRED`;
- reset changes only credential state and preserves all unrelated exam data;
- all focused tests, full regressions, syntax checks, Edge parses, CI checks, Pages build/deploy, and production UAT pass.
