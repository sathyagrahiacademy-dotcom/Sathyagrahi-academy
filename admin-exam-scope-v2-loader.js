(()=>{
  function waitForLegacyScope(){
    if(document.getElementById('adminExamScopeV2'))return;
    const legacyRow=document.querySelector('#scopeRows .scope-subtopic');
    if(!legacyRow){setTimeout(waitForLegacyScope,20);return;}
    const script=document.createElement('script');
    script.id='adminExamScopeV2';
    script.src='admin-exam-scope-v2-ui.js?v=20260905-2';
    document.body.appendChild(script);
  }
  waitForLegacyScope();
})();
