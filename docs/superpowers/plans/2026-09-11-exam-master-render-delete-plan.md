# Exam Master Single Renderer and Draft Delete Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the legacy Examinations flash in Master mode and ensure Draft Delete reaches its own exact-code confirmation flow instead of Workspace navigation.

**Architecture:** Keep the current legacy support script for auth/form compatibility, but remove its visible table ownership while Master mode is active. The Master Control Center owns the visible exam list; a temporary hidden state prevents pre-render flash. The capture-phase Workspace router explicitly excludes destructive delete controls so the Control Center delete listener receives them.

**Tech Stack:** Static HTML/CSS/JavaScript, Node `node:test`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-11-exam-master-render-delete-design.md`

## Global Constraints

- Frontend only.
- No Supabase Edge Function changes.
- No database migrations or verification writes.
- Do not delete the Sep-10 draft exam for testing.
- Do not alter the Sep-08 published exam or its attempts/results.
- Do not touch Result Mail or unrelated modules.
- Merge only after focused test and full repository CI pass.
- Claim production completion only after GitHub Pages succeeds at the exact merged `main` SHA.

---

### Task 1: Lock renderer ownership and delete-routing regressions

**Files:**
- Test: `admin-exam-master-render-ownership.test.mjs`

**Interfaces:**
- Consumes: static source text from `admin-exams.html`, `admin-exams.js`, `admin-exam-control-center.js`, `admin-exam-workspace-route.js`.
- Produces: regression contracts for Master-only visible rendering and delete exclusion before workspace navigation.

- [ ] **Step 1: Keep focused tests asserting delete exclusion precedes workspace navigation**

```js
test('draft delete is never captured by the master workspace route',()=>{
  const exclusion=workspaceRoute.indexOf("button.matches('[data-delete-draft], .delete-draft, .del')");
  const open=workspaceRoute.indexOf('openWorkspace(id,tabFor(button))');
  assert.ok(exclusion>=0);
  assert.ok(open>=0);
  assert.ok(exclusion<open);
});
```

- [ ] **Step 2: Keep focused tests asserting legacy render is a no-op in Master mode**

```js
test('legacy exams renderer does not paint the old table in Master mode',()=>{
  assert.match(legacy,/const masterMode=window\.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED===true/);
  assert.match(legacy,/function render\(\)\{if\(masterMode\)return;/);
});
```

- [ ] **Step 3: Keep focused tests asserting hidden-until-Control-Center behavior**

```js
test('Master exams content stays hidden until Control Center has rendered',()=>{
  assert.match(html,/class="content exam-master-pending"/);
  assert.match(html,/\.exam-master-pending\{visibility:hidden\}/);
  assert.match(control,/classList\.remove\('exam-master-pending'\)/);
});
```

- [ ] **Step 4: Run focused regression**

Run: `node --test admin-exam-master-render-ownership.test.mjs`
Expected: PASS.

### Task 2: Enforce single visible renderer in Master mode

**Files:**
- Modify: `admin-exams.html`
- Modify: `admin-exams.js`
- Modify: `admin-examinations-nav.js`
- Modify: `admin-exam-control-center.js`

**Interfaces:**
- Consumes: `window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED`, `.content`, `#rows`, legacy `rows.onclick`, Control Center `loadControlCenter()`.
- Produces: exactly one visible table owner in Master mode, while retaining legacy support behavior needed by current page wiring.

- [ ] **Step 1: Add initial Master pending state**

```css
.exam-master-pending{visibility:hidden}
```

and render the page content as:

```html
<section class="content exam-master-pending">...</section>
```

- [ ] **Step 2: Suppress legacy list rendering only in Master mode**

```js
const masterMode=window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED===true;
function render(){
  if(masterMode)return;
  // existing legacy render logic unchanged
}
```

- [ ] **Step 3: Do not wait for legacy visible content**

Control Center startup waits only until the legacy action binding exists:

```js
function waitForLegacy(){
  if(typeof rows.onclick!=='function'){
    setTimeout(waitForLegacy,25);
    return;
  }
  ensureShell();
  wire();
  loadControlCenter();
}
```

- [ ] **Step 4: Reveal content after first Control Center load attempt**

```js
finally{
  document.querySelector('.content')?.classList.remove('exam-master-pending');
  loading=false;
}
```

- [ ] **Step 5: Preserve legacy fallback mode**

```js
}else{
  document.querySelector('.content')?.classList.remove('exam-master-pending');
  loadScript('adminExamsEnhancements','admin-exams-enhancements.js?v=20260905-1');
}
```

- [ ] **Step 6: Use fresh asset versions for modified frontend files**

Update only the changed Examinations script query versions so production browsers do not reuse stale bundles.

### Task 3: Prevent Workspace router from hijacking Delete

**Files:**
- Modify: `admin-exam-workspace-route.js`

**Interfaces:**
- Consumes: capture-phase `document` click events and buttons with `data-id`.
- Produces: Workspace routing for normal Master actions, but no interception of draft/legacy delete controls.

- [ ] **Step 1: Exit capture handler for destructive delete controls before any navigation logic**

```js
const button=event.target?.closest?.('button[data-id]');
if(!button)return;
if(button.matches('[data-delete-draft], .delete-draft, .del'))return;
```

- [ ] **Step 2: Keep current normal Workspace routing unchanged**

```js
const id=String(button.dataset.id||'');
const row=button.closest('tr[data-master-workspace="1"]');
const attention=button.classList.contains('control-fix')&&masterIds.has(id);
if(!row&&!attention)return;
event.preventDefault();
event.stopImmediatePropagation();
openWorkspace(id,tabFor(button));
```

- [ ] **Step 3: Run focused regression again**

Run: `node --test admin-exam-master-render-ownership.test.mjs`
Expected: PASS.

### Task 4: Full verification and production rollout

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: final PR #36 head.
- Produces: verified merge and Pages deployment, without destructive live exam actions.

- [ ] **Step 1: Run full repository CI on PR #36 head**

Expected gates: intelligence contracts PASS; full root regression PASS; browser JavaScript syntax PASS; all root JavaScript syntax PASS; Edge TypeScript parse PASS.

- [ ] **Step 2: Inspect final PR diff**

Expected implementation scope: the five Examinations frontend files plus focused regression test and approved spec/plan docs only. No Supabase function, migration, Result Mail, or unrelated app files.

- [ ] **Step 3: Merge PR #36 after all required checks are green**

Expected: merge to `main`, record exact merge SHA.

- [ ] **Step 4: Verify GitHub Pages at exact merge SHA**

Expected: build SUCCESS and deploy SUCCESS for the same merge SHA.

- [ ] **Step 5: Perform non-destructive production UAT with user**

User actions: refresh/open Examinations; confirm no old table flash; click `DELETE DRAFT EXAM`; confirm exact-code prompt appears; press Cancel; confirm draft remains. Also spot-check Questions/Workspace/Continue Setup routes. No production exam is deleted.
