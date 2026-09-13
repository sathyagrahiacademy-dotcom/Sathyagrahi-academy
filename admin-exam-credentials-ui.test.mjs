import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller=fs.readFileSync('admin-exam-control-center.js','utf8');
const nav=fs.readFileSync('admin-examinations-nav.js','utf8');
const uiPath='admin-exam-credentials-ui.js';
const uiExists=fs.existsSync(uiPath);
const ui=uiExists?fs.readFileSync(uiPath,'utf8'):'';

test('Control Center CODE cell exposes ACCESS metadata without workspace data-id capture',()=>{
  assert.match(controller,/data-exam-access/);
  assert.match(controller,/data-exam-id/);
  assert.match(controller,/data-exam-code/);
  assert.match(controller,/data-exam-title/);
  assert.match(controller,/data-exam-state/);
  const match=controller.match(/<button[^>]*data-exam-access[^>]*>/);
  assert.ok(match,'ACCESS button markup missing');
  assert.doesNotMatch(match[0],/\bdata-id=/,'ACCESS button must not use data-id because workspace routing captures it');
  assert.match(match[0],/>ACCESS</);
});

test('credential UI controller exists and is loaded after Control Center',()=>{
  assert.equal(uiExists,true,'admin-exam-credentials-ui.js must exist');
  assert.match(nav,/admin-exam-credentials-ui\.js/);
  const controlIndex=nav.indexOf('admin-exam-control-center.js');
  const credentialIndex=nav.indexOf('admin-exam-credentials-ui.js');
  assert.ok(controlIndex>=0&&credentialIndex>controlIndex,'credential controller must load after Control Center');
});

if(uiExists){
  test('opening ACCESS checks status only and keeps password masked',()=>{
    assert.match(ui,/function openAccess/);
    const start=ui.indexOf('function openAccess');
    const end=ui.indexOf('function closeAccess',start);
    const block=ui.slice(start,end>start?end:start+5000);
    assert.match(block,/action:'status'/);
    assert.doesNotMatch(block,/action:'reveal'/);
    assert.match(ui,/PASSWORD/);
    assert.match(ui,/••••••|\*\*\*\*\*\*/);
  });

  test('SHOW is explicit and COPY reveals only when transient plaintext is absent',()=>{
    assert.match(ui,/revealedPassword/);
    assert.match(ui,/action:'reveal'/);
    assert.match(ui,/navigator\.clipboard\.writeText/);
    assert.match(ui,/showPassword/);
    assert.match(ui,/copyPassword/);
  });

  test('closing the modal clears transient plaintext and remasks it',()=>{
    const start=ui.indexOf('function closeAccess');
    assert.ok(start>=0,'closeAccess missing');
    const block=ui.slice(start,start+1500);
    assert.match(block,/revealedPassword\s*=\s*['"]['"]/);
    assert.match(block,/mask|masked|••••••|\*\*\*\*\*\*/i);
  });

  test('old exams become RESET REQUIRED and reset is six digits with non-draft confirmation',()=>{
    assert.match(ui,/RESET_REQUIRED/);
    assert.match(ui,/RESET REQUIRED/);
    assert.match(ui,/\^\\d\{6\}\$/);
    assert.match(ui,/confirmNonDraft/);
    assert.match(ui,/CONFIRM_NON_DRAFT_REQUIRED/);
    assert.match(ui,/window\.confirm|confirm\(/);
  });

  test('credential plaintext is never persisted in browser storage or URLs',()=>{
    assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/i);
    assert.doesNotMatch(ui,/URLSearchParams|location\.search|history\.pushState|history\.replaceState/);
  });
}
