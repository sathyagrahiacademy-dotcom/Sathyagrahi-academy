# SGA Exam Credential Vault — Design Specification

Date: 2026-09-11
Status: Approved design, implementation not started
Branch: `feature/exam-credential-vault`

## 1. Goal

Add secure Admin access to each exam's Exam Code and actual six-digit Exam Password without storing the password in plaintext or exposing it through ordinary browser/database reads.

The feature is only for **Exam Code + Exam Password**. It is not a student-login password manager and does not store student credentials.

Admin must be able to:

- open an exam's `ACCESS` modal from Examinations;
- copy the Exam Code;
- reveal/copy the current Exam Password on explicit request;
- reset an exam password when the encrypted password is unavailable or a new password is required;
- use the same mechanism for future DT/WT/MT/GT exams.

Existing Sep-08 and Sep-10 exams are included. Their historical plaintext passwords cannot be recovered from the current SHA-256 hash, so they require one manual password reset before `SHOW / COPY` becomes available.

## 2. Current State

The current access model stores:

- `public.exam_access.exam_id`
- `public.exam_access.exam_code`
- `public.exam_access.password_hash`
- `public.exam_access.created_at`

New master-exam creation validates the six-digit password, hashes it with SHA-256, and stores only `password_hash`. Updating master basics can replace the hash, but there is no reversible copy.

This existing hash remains the source used by student exam-access verification. The new vault must not replace or weaken that flow.

`public.exam_access` has RLS and an admin-only policy, but it is still a public-schema table. Reversible credential material will therefore not be added to this table.

## 3. Chosen Architecture

Use a dedicated **private encrypted credential vault** plus an Admin-only Edge Function.

### 3.1 Public verification data remains unchanged

`public.exam_access` continues to hold:

- Exam Code
- password hash

Student exam entry continues to validate against the hash. No student-facing API receives the encrypted password, encryption metadata, or plaintext password.

### 3.2 Private vault

Create a non-exposed schema/table:

`private.exam_credentials`

Recommended columns:

- `exam_id uuid primary key references public.exams(id) on delete cascade`
- `ciphertext text not null`
- `iv text not null`
- `key_version smallint not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `updated_by uuid null`

The private schema/table is not granted to `anon` or `authenticated`. Only the server-side privileged role used by Edge Functions receives the required access.

No plaintext exam password is stored in Postgres.

## 4. Encryption Design

Use **AES-256-GCM** through the runtime Web Crypto API.

A custom production Edge Function secret holds a 32-byte key, for example:

`EXAM_CREDENTIAL_ENCRYPTION_KEY_V1`

The key must:

- exist only in Supabase Edge Function secrets;
- never be committed to GitHub;
- never be embedded in browser JavaScript;
- never be stored in the database;
- be versioned so future rotation is possible.

For each encryption:

- generate a fresh random 12-byte IV;
- use AES-GCM;
- use Exam ID + Exam Code as authenticated additional data so copied/swapped ciphertext cannot silently decrypt under another exam identity;
- store only ciphertext, IV, and key version.

Plaintext must never be written to application logs.

## 5. Server Components

### 5.1 Shared crypto helper

Add a small shared module under Supabase functions, responsible only for:

- loading the correct encryption key by version;
- encrypting a six-digit password;
- decrypting a stored credential;
- base64 encoding/decoding;
- applying the Exam ID + Exam Code authenticated-data binding.

Keeping this isolated prevents crypto code from being duplicated across create/reset/reveal flows.

### 5.2 Admin-only credential function

Add a dedicated Edge Function, proposed name:

`admin-exam-credentials`

Every request must:

1. validate the caller's user JWT;
2. load the caller's profile;
3. require `role = admin` and `is_active = true`;
4. use the server-side privileged client only after Admin authorization succeeds.

Supported actions:

#### `reveal`

Input: `examId`

Behavior:

- load Exam Code;
- load encrypted credential from the private vault;
- if no vault row exists, return a `RESET_REQUIRED` state;
- decrypt only after Admin authorization;
- return `{ examCode, password }`;
- include `Cache-Control: no-store` and equivalent no-cache response headers.

The plaintext exists only in the response to that explicit reveal request.

#### `reset`

Input: `examId`, `newPassword`, plus an explicit confirmation flag for non-draft exams.

Behavior:

- validate exactly six numeric digits using the existing exam password policy;
- load the exam and current Exam Code;
- for published/live/conducted/result-published exams, require explicit confirmation because changing the password changes any future access with the old password;
- hash the new password using the current student-access-compatible hashing method;
- encrypt the new password with the vault key;
- persist the hash and encrypted vault copy together;
- do not change exam code, questions, attempts, responses, results, performance, publishing state, or syllabus.

The reset response should not echo the plaintext password because the Admin already entered it.

## 6. Atomic Credential Persistence

Hash and encrypted vault data must not drift apart.

Create one server-only transactional database function, for example:

`public.upsert_exam_credential_v1(...)`

Inputs include:

- exam id
- exam code
- password hash
- ciphertext
- IV
- key version
- updated-by Admin id

The function performs, in one PostgreSQL transaction:

- insert/update `public.exam_access` for that exam;
- insert/update `private.exam_credentials` for that exam.

Security requirements:

- use `SECURITY INVOKER`, not `SECURITY DEFINER`;
- revoke execute from `PUBLIC`, `anon`, and `authenticated`;
- grant execute only to the server-side privileged role;
- grant that role only the needed privileges on the private schema/table.

This RPC becomes the single write path for paired hash + encrypted credential state.

## 7. Integration With Exam Creation and Editing

### 7.1 New exam creation

The current master-exam creation flow remains structurally the same:

1. validate basics/password;
2. create exam row;
3. allocate Exam Code;
4. compute password hash;
5. encrypt password;
6. call the transactional credential RPC;
7. if credential persistence fails, keep the existing partial-exam cleanup behavior.

The API response may continue to return the Exam Code, but must not return or persist the plaintext password outside the explicit Admin UI flow.

### 7.2 Password changes in existing wizard/edit flow

Any existing Admin workflow that changes `examPassword` must be updated to write both:

- new `password_hash`;
- new encrypted vault credential.

It must use the same shared helper/RPC rather than directly updating only `password_hash`.

## 8. Admin UI Design

The Examinations Control Center already has a `CODE` column. Keep the table compact by placing one `ACCESS` control beside/under the displayed Exam Code rather than adding another full table column.

Example:

`SGA-DT-011009   [ ACCESS ]`

Clicking `ACCESS` opens a modal.

### 8.1 ACCESS modal

Display:

- Exam Name
- Exam Code — visible + `COPY`
- Password — default `••••••`
- `SHOW`
- `COPY`
- `RESET PASSWORD`

Rules:

- password is never automatically revealed;
- opening the modal does not call the reveal endpoint;
- `SHOW` triggers the Admin-only reveal request;
- `COPY` for password triggers reveal if needed, then copies the value;
- clear any revealed password from local UI state when the modal closes;
- do not save it to Local Storage, Session Storage, IndexedDB, URL/query string, analytics, or logs;
- optionally remask after a short inactivity period, but modal close clearing is mandatory.

### 8.2 Existing exams without encrypted credentials

If no private vault row exists:

- show Exam Code normally;
- show `Password not stored — RESET REQUIRED`;
- disable `SHOW` and password `COPY`;
- keep `RESET PASSWORD` enabled.

No attempt is made to reverse the old hash.

### 8.3 Reset UX

Reset flow:

1. Admin clicks `RESET PASSWORD`;
2. enters a new exact six-digit numeric password;
3. confirms it;
4. for non-draft exams, show a stronger warning that old credentials stop working for future access;
5. save through the Admin credential function;
6. return to masked state;
7. allow `SHOW / COPY` after successful save.

Do not automatically generate or silently reset old exam passwords during deployment.

## 9. Existing Sep-08 and Sep-10 Exams

After rollout:

- both existing exams will initially show `RESET REQUIRED` because their old plaintext values are not recoverable;
- Admin manually assigns a new six-digit password to each;
- the new hash becomes the active student-access password;
- the encrypted password becomes available for later Admin reveal/copy.

For the Sep-08 result-published exam, this reset must not alter existing attempts, results, or performance rows. It only changes any future password-based access.

For the Sep-10 draft exam, reset changes only its exam credential.

## 10. Security Guardrails

Mandatory guardrails:

- no plaintext passwords in GitHub;
- no plaintext passwords in Postgres;
- no plaintext passwords in browser storage;
- no plaintext passwords in logs;
- no encrypted credential fields in ordinary `control_center` payloads;
- no direct client query to the private vault;
- Admin role + active status checked on every reveal/reset request;
- server-side encryption key loaded only from Edge Function secrets;
- response caching disabled for reveal;
- password masked by default;
- private vault rows cascade-delete when the exam is deleted;
- published/non-draft resets require explicit warning/confirmation;
- exam deletion rules and safe-delete backend remain unchanged.

## 11. Non-Goals

This work does **not**:

- store student login passwords;
- create a general-purpose Academy password manager;
- change student authentication;
- change exam-code generation;
- change exam questions/mapping/audience/results/performance logic;
- change historical result records;
- automatically rotate every exam password at deployment;
- expose the encryption key to administrators or browsers.

## 12. Testing Requirements

### Database / migration

Verify:

- private schema/table exists;
- `anon` and `authenticated` cannot read/write it;
- server privileged role can access only as intended;
- server-only RPC has no execute grant to public client roles;
- vault row cascades on exam deletion;
- paired hash + encrypted credential update is transactional.

### Crypto helper

Verify:

- encrypt → decrypt returns the same six-digit password;
- each encryption uses a fresh IV;
- wrong key fails;
- wrong Exam ID / Exam Code authenticated data fails;
- malformed ciphertext fails closed.

### Edge Function authorization

Verify:

- no session → 401;
- student/non-admin → 403;
- inactive admin → 403;
- active admin can reveal/reset;
- reveal for old exam without vault row returns `RESET_REQUIRED`;
- response is marked no-store;
- logs contain no plaintext password.

### Credential behavior

Verify:

- new exam creation writes both hash and encrypted credential;
- reset updates both together;
- new password passes student exam-access validation;
- old password fails after reset;
- Exam Code is unchanged by password reset;
- existing attempts/results/performance remain unchanged.

### Frontend

Verify:

- Control Center does not receive plaintext password by default;
- ACCESS modal opens masked;
- SHOW reveals only after explicit click;
- COPY works;
- close clears revealed value;
- old exam displays RESET REQUIRED;
- non-draft reset warning is shown;
- normal Examinations navigation/actions remain unchanged.

## 13. Rollout Order

1. Create encryption key secret in Supabase Edge Function secrets.
2. Apply private-vault + transactional RPC migration.
3. Deploy shared crypto helper and `admin-exam-credentials` function.
4. Update master-exam create/edit password persistence to use the new paired write path.
5. Update Admin Control Center with ACCESS modal.
6. Run full automated regression/contract tests.
7. Deploy to production.
8. Non-destructive UAT of ACCESS modal on existing exams.
9. Manually reset Sep-08 and Sep-10 only when Admin is ready to establish their new retrievable passwords.

No production exam password is changed merely as a deployment test.

## 14. Acceptance Criteria

The design is complete when all of the following are true:

- every newly created exam has a normal hash plus an encrypted Admin-retrievable password;
- Admin can reveal/copy a password only through the protected ACCESS flow;
- ordinary browser/API payloads never contain the password;
- old exams without vault data clearly require a reset;
- after manual reset, Sep-08 and Sep-10 credentials can be revealed/copied;
- student exam access uses the newly reset password;
- old password no longer works after reset;
- no unrelated exam/student/result data changes;
- all security, regression, syntax, and deployment checks pass before merge.
