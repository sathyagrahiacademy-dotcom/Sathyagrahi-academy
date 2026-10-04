(()=>{
  if(window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED !== true)return;
  const c=window.sgaSupabase;
  const addBtn=document.getElementById('addBtn');
  const passwordUtils=window.ExamPasswordUtils;
  if(!c||!addBtn||!passwordUtils)return;

  const TYPE_CODES={daily:'DT',weekly:'WT',monthly:'MT',grand:'GT'};
  const TYPE_LABELS={daily:'DAILY TEST',weekly:'WEEKLY TEST',monthly:'MONTHLY TEST',grand:'GRAND TEST'};
  const SUBJECTS=['Physics','Chemistry','Biology'];
  const STEP_LABELS=['Basic Details','Questions','Validation','Students / Audience','Review & Publish'];
  const state={examId:null,examCode:'',step:1,bootstrap:null,basics:null,blueprintValidation:null,titleTouched:false,lastSuggestedTitle:''};

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const indiaDate=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const randomPassword=()=>passwordUtils.generateSixDigitPassword();
  const localDateTimeValue=value=>{
    if(!value)return '';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  function injectStyle(){
    if(document.getElementById('masterExamWizardStyles'))return;
    const style=document.createElement('style');
    style.id='masterExamWizardStyles';
    style.textContent=`
      #masterExamWizardModal{z-index:90}
      .master-wizard-card{width:min(1120px,97vw);height:min(760px,94vh);max-height:94vh;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:14px;padding:0;box-shadow:0 24px 70px #04152f55}
      .mw-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #e3eaf3;background:linear-gradient(135deg,#f7fbff,#fffaf4);flex:0 0 auto}.mw-head h3{margin:0;color:#06275f}.mw-head p{margin:5px 0 0;font-size:10px;color:#718096}.mw-close{border:1px solid #cbd7e6;background:#fff;border-radius:7px;padding:8px 11px;font-weight:900;color:#53637a;cursor:pointer}.mw-steps{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border-bottom:1px solid #e3eaf3;background:#fbfcfe;flex:0 0 auto}.mw-step{padding:12px 8px;text-align:center;font-size:8px;font-weight:900;color:#7b8799;border:0;background:transparent}.mw-step span{display:block;width:22px;height:22px;line-height:22px;margin:0 auto 5px;border-radius:50%;background:#e9eef5;color:#53637a}.mw-step.active{color:#06275f;background:#f3f8ff}.mw-step.active span{background:#06275f;color:#fff}.mw-step.done span{background:#087443;color:#fff}.mw-body{padding:0;display:flex;flex:1 1 auto;min-height:0;flex-direction:column}.mw-step-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 22px 0}.mw-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.mw-field label{display:block;margin-bottom:5px;font-size:9px;font-weight:900;color:#43566f}.mw-field input,.mw-field select,.mw-field textarea{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cbd7e6;border-radius:7px;background:#fff;color:#17355d}.mw-field input[readonly]{background:#f5f8fc;color:#64748b}.mw-span2{grid-column:1/-1}.mw-score-strip{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;background:#f8fbff;border:1px solid #dce7f3;border-radius:9px}.mw-score-strip div{background:#fff;border:1px solid #e5ebf3;border-radius:7px;padding:9px}.mw-score-strip small{display:block;font-size:8px;font-weight:900;color:#79869a}.mw-score-strip b{display:block;margin-top:3px;color:#06275f;font-size:12px}.mw-password-row{display:flex;gap:6px}.mw-password-row input{flex:1}.mw-mini{border:1px solid #b9c9dc;background:#fff;color:#07316d;border-radius:6px;padding:7px 9px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}.mw-note{font-size:9px;color:#7b8799;margin-top:5px;line-height:1.45}.mw-placeholder{border:1px dashed #b9c9dc;background:#f8fbff;border-radius:10px;padding:24px;text-align:center;color:#53637a}.mw-placeholder b{display:block;color:#06275f;margin-bottom:6px}.mw-msg{min-height:19px;margin-top:12px;color:#b42318;font-size:10px}.mw-msg.ok{color:#087443}.mw-actions{display:flex;justify-content:space-between;gap:8px;align-items:center;flex:0 0 auto;margin:0;padding:14px 22px 18px;border-top:1px solid #e8edf4;background:#fff}.mw-actions-right{display:flex;gap:8px}.mw-btn{padding:9px 13px;border:1px solid #b8c8de;background:#fff;color:#07316d;border-radius:7px;font-size:9px;font-weight:900;cursor:pointer}.mw-btn.primary{background:#06275f!important;color:#fff!important;border-color:#06275f!important}.mw-btn:disabled{opacity:.5;cursor:not-allowed}.mw-coverage-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.mw-coverage-head h4{margin:0;color:#06275f}.mw-coverage-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.mw-summary-card{border:1px solid #dce5ef;border-radius:8px;padding:9px 10px;background:#f9fbfe}.mw-summary-card small{display:block;font-size:8px;font-weight:900;color:#7b8799}.mw-summary-card b{display:block;margin-top:3px;color:#06275f}.mw-coverage-table{overflow:auto;border:1px solid #dce5ef;border-radius:9px}.mw-coverage-row{display:grid;grid-template-columns:.8fr 1.15fr 1.3fr 1.25fr .65fr auto;gap:8px;align-items:end;padding:10px;border-top:1px solid #edf1f6;min-width:900px}.mw-coverage-row:first-child{border-top:0}.mw-coverage-row label{display:block;font-size:8px;font-weight:900;color:#63738a;margin-bottom:4px}.mw-coverage-row select,.mw-coverage-row input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd7e6;border-radius:6px;background:#fff;color:#17355d;font-size:9px}.mw-remove{border:1px solid #e8b4b4;background:#fff;color:#b42318;border-radius:6px;padding:8px 9px;font-size:8px;font-weight:900;cursor:pointer}.mw-coverage-alert{margin-top:9px;border-radius:7px;padding:9px 10px;font-size:9px;display:none}.mw-coverage-alert.show{display:block}.mw-coverage-alert.bad{background:#fff1f0;border:1px solid #ffc9c5;color:#a61b1b}.mw-coverage-alert.good{background:#edf9f2;border:1px solid #bfe4cf;color:#087443}.mw-question-methods{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.mw-question-method{border:1px solid #cbd7e6;background:#f8fbff;border-radius:10px;padding:16px;text-align:left;cursor:pointer;color:#07316d}.mw-question-method b{display:block;font-size:11px}.mw-question-method small{display:block;margin-top:5px;color:#718096;line-height:1.45}.mw-question-note{margin-top:12px;border:1px solid #dce7f3;background:#f8fbff;border-radius:9px;padding:11px;color:#53637a;font-size:9px;line-height:1.5}.mw-blueprint-status{border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0;background:#f8fafc}.mw-blueprint-status.ready{background:#edf9f2;border-color:#bfe4cf}.mw-blueprint-status.action{background:#fff7ed;border-color:#fed7aa}.mw-blueprint-status strong{display:block;font-size:18px;color:#06275f}.mw-blueprint-status span{display:block;margin-top:5px;font-size:10px;color:#667085}.mw-blueprint-metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0}.mw-blueprint-issue{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #f0d3b8;background:#fffaf4;border-radius:8px;padding:10px 12px;margin-top:8px}.mw-blueprint-issue b{display:block;color:#8a4b17;font-size:10px}.mw-blueprint-issue small{display:block;color:#667085;margin-top:3px}.mw-blueprint-approve{margin-top:14px;display:flex;justify-content:flex-end}@media(max-width:900px){.mw-steps{grid-template-columns:repeat(3,1fr)}.mw-grid{grid-template-columns:1fr}.mw-span2,.mw-score-strip{grid-column:auto}.mw-score-strip,.mw-coverage-summary{grid-template-columns:1fr 1fr}.mw-question-methods{grid-template-columns:1fr}.mw-blueprint-metrics{grid-template-columns:1fr 1fr 1fr}.mw-blueprint-issue{align-items:flex-start;flex-direction:column}}@media(max-height:720px),(max-width:700px){.master-wizard-card{height:94vh}.mw-step-scroll{padding:16px 14px 0}.mw-actions{padding:12px 14px 14px}}`;
    document.head.appendChild(style);
  }

  function ensureModal(){
    let modal=document.getElementById('masterExamWizardModal');
    if(modal)return modal;
    injectStyle();
    modal=document.createElement('div');
    modal.className='modal master-wizard-modal';
    modal.id='masterExamWizardModal';
    modal.innerHTML=`<div class="master-wizard-card">
      <div class="mw-head"><div><h3>CREATE EXAM</h3><p>Master Exam Setup • Draft → Validate → Publish</p></div><button type="button" class="mw-close" id="mwClose">CLOSE</button></div>
      <div class="mw-steps" id="mwSteps">${STEP_LABELS.map((label,i)=>`<button type="button" class="mw-step" data-step="${i+1}"><span>${i+1}</span>${esc(label)}</button>`).join('')}</div>
      <div class="mw-body"><div class="mw-step-scroll"><div id="mwStepHost"></div><div class="mw-msg" id="mwMsg"></div></div><div class="mw-actions"><div class="mw-note" id="mwIdentityNote">New exam is saved as Draft after Step 1.</div><div class="mw-actions-right"><button type="button" class="mw-btn" id="mwBack">BACK</button><button type="button" class="mw-btn primary" id="mwNext">SAVE & CONTINUE</button></div></div></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#mwClose')?.addEventListener('click',closeWizard);
    modal.addEventListener('click',e=>{if(e.target===modal)closeWizard()});
    modal.querySelector('#mwBack')?.addEventListener('click',()=>{if(state.step>1)setStep(state.step-1)});
    modal.querySelector('#mwNext')?.addEventListener('click',onNext);
    modal.querySelector('#mwSteps')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-step]');if(!btn)return;
      const step=Number(btn.dataset.step||0);
      if(step===1||state.examId)setStep(step);
    });
    return modal;
  }

  function buildCodePreview(){
    const type=document.getElementById('mwExamType')?.value||state.basics?.examType||'daily';
    const typeCode=TYPE_CODES[type]||'';
    const batch=Number(document.getElementById('mwBatchNo')?.value||state.basics?.batchNo||0);
    const date=document.getElementById('mwExamDate')?.value||state.basics?.examDate||'';
    if(!typeCode||!Number.isInteger(batch)||batch<1||batch>99||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const [,mm,dd]=date.split('-');
    return `SGA-${typeCode}-${String(batch).padStart(2,'0')}${dd}${mm}`;
  }

  function suggestedTitle(){
    const type=document.getElementById('mwExamType')?.value||state.basics?.examType||'daily';
    const batch=Number(document.getElementById('mwBatchNo')?.value||state.basics?.batchNo||0);
    const date=document.getElementById('mwExamDate')?.value||state.basics?.examDate||'';
    if(!TYPE_LABELS[type]||!batch||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const [year,month,day]=date.split('-');
    const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `SGA ${TYPE_LABELS[type]} | BATCH ${String(batch).padStart(2,'0')} | ${day} ${months[Number(month)-1]} ${year}`;
  }

  function updateBasicsPreview(){
    const physics=Math.max(0,Number(document.getElementById('mwPhysicsQuestions')?.value||0));
    const chemistry=Math.max(0,Number(document.getElementById('mwChemistryQuestions')?.value||0));
    const biology=Math.max(0,Number(document.getElementById('mwBiologyQuestions')?.value||0));
    const expected=physics + chemistry + biology;
    const expectedEl=document.getElementById('mwExpectedQuestions');if(expectedEl)expectedEl.value=expected?String(expected):'';
    const total=Number.isInteger(expected)&&expected>0?expected * 4:0;
    const totalEl=document.getElementById('mwTotalMarks');if(totalEl)totalEl.value=total?String(total):'';
    const codeEl=document.getElementById('mwExamCode');if(codeEl)codeEl.value=state.examCode||buildCodePreview();
    const titleEl=document.getElementById('mwTitle');
    if(titleEl){
      const next=suggestedTitle();
      if(!state.titleTouched||titleEl.value===state.lastSuggestedTitle)titleEl.value=next;
      state.lastSuggestedTitle=next;
    }
  }

  function renderStep1(){
    const host=document.getElementById('mwStepHost');if(!host)return;
    const b=state.basics||{};
    const today=b.examDate||indiaDate();
    host.innerHTML=`<div class="mw-grid">
      <div class="mw-field"><label>Test Type</label><select id="mwExamType" ${state.examId?'disabled':''}><option value="daily">Daily Test (DT)</option><option value="weekly">Weekly Test (WT)</option><option value="monthly">Monthly Test (MT)</option><option value="grand">Grand Test (GT)</option></select></div>
      <div class="mw-field"><label>Academy Batch Number</label><input id="mwBatchNo" type="number" min="1" max="99" value="${esc(b.batchNo||1)}" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Date</label><input id="mwExamDate" type="date" value="${esc(today)}" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Code</label><input id="mwExamCode" readonly placeholder="SGA-DT-010909"><div class="mw-note">Final code is generated by the server when the Draft is created.</div></div>
      <div class="mw-field mw-span2"><label>Exam Title</label><input id="mwTitle" placeholder="Academy exam title" value="${esc(b.title||'')}"></div>
      <div class="mw-field mw-span2"><label>Subject Question Distribution</label><div class="mw-score-strip"><div><small>PHYSICS QUESTIONS</small><input id="mwPhysicsQuestions" type="number" min="0" step="1" value="${esc(b.physicsQuestions ?? b.physicsQuestionCount ?? 15)}"></div><div><small>CHEMISTRY QUESTIONS</small><input id="mwChemistryQuestions" type="number" min="0" step="1" value="${esc(b.chemistryQuestions ?? b.chemistryQuestionCount ?? 15)}"></div><div><small>BIOLOGY QUESTIONS</small><input id="mwBiologyQuestions" type="number" min="0" step="1" value="${esc(b.biologyQuestions ?? b.biologyQuestionCount ?? 15)}"></div><div><small>TOTAL QUESTIONS</small><input id="mwExpectedQuestions" readonly></div></div><div class="mw-note">Only subject-wise counts are needed here. Unit / Chapter / Topic are derived automatically from the questions you add.</div></div>
      <div class="mw-field"><label>Duration (Minutes)</label><input id="mwDurationMinutes" type="number" min="1" value="${esc(b.durationMinutes||45)}"><div class="mw-note">Student receives this full personal countdown after START. No common start/end time.</div></div>
      <div class="mw-score-strip"><div><small>MARKS / CORRECT</small><b>+4</b></div><div><small>WRONG</small><b>−1</b></div><div><small>UNATTEMPTED</small><b>0</b></div><div><small>MARKING</small><b>+4 / −1 / 0</b></div></div>
      <div class="mw-field"><label>Total Marks</label><input id="mwTotalMarks" readonly></div>
      <div class="mw-field"><label>Exam Password</label><div class="mw-password-row"><input id="mwPassword" type="password" readonly inputmode="numeric" pattern="[0-9]{6}" maxlength="6"><button type="button" class="mw-mini" id="mwShowPassword">SHOW</button><button type="button" class="mw-mini" id="mwCopyPassword">COPY</button></div><div class="mw-password-row" style="margin-top:6px"><button type="button" class="mw-mini" id="mwRegeneratePassword">REGENERATE</button><button type="button" class="mw-mini" id="mwManualPassword">MANUAL CHANGE</button></div><div class="mw-note">Exactly 6 numeric digits. Password is not included in Student Portal notification.</div></div>
      <div class="mw-field"><label>Result Publication Mode</label><select id="mwResultPublishMode"><option value="manual">Manual</option><option value="scheduled">Scheduled</option></select><div class="mw-note">Result release is separate from the student’s personal exam timer.</div></div>
      <div class="mw-field mw-span2" id="mwResultPublishAtWrap" style="display:none"><label>Scheduled Result Publication Date & Time</label><input id="mwResultPublishAt" type="datetime-local" value="${esc(localDateTimeValue(b.resultPublishAt))}"></div>
      <div class="mw-field mw-span2"><label>Instructions</label><textarea id="mwInstructions" rows="3" placeholder="Instructions visible before the student starts">${esc(b.instructions||'')}</textarea></div>
    </div>`;
    const type=document.getElementById('mwExamType');if(type)type.value=b.examType||'daily';
    const release=document.getElementById('mwResultPublishMode');if(release)release.value=b.resultPublishMode||'manual';
    const password=document.getElementById('mwPassword');if(password)password.value=b.examPassword||randomPassword();
    for(const id of ['mwExamType','mwBatchNo','mwExamDate','mwPhysicsQuestions','mwChemistryQuestions','mwBiologyQuestions'])document.getElementById(id)?.addEventListener('input',updateBasicsPreview);
    document.getElementById('mwTitle')?.addEventListener('input',()=>{state.titleTouched=true});
    document.getElementById('mwResultPublishMode')?.addEventListener('change',toggleReleaseTime);
    document.getElementById('mwShowPassword')?.addEventListener('click',()=>{
      const input=document.getElementById('mwPassword');if(!input)return;
      input.type=input.type==='password'?'text':'password';
      document.getElementById('mwShowPassword').textContent=input.type==='password'?'SHOW':'HIDE';
    });
    document.getElementById('mwCopyPassword')?.addEventListener('click',async()=>{
      const value=document.getElementById('mwPassword')?.value||'';
      if(value&&navigator.clipboard)await navigator.clipboard.writeText(value);
      setMessage(value?'Password copied.':'No password to copy.',!!value);
    });
    document.getElementById('mwRegeneratePassword')?.addEventListener('click',()=>{
      const input=document.getElementById('mwPassword');if(!input)return;input.value=randomPassword();input.readOnly=true;input.type='password';setMessage('New 6-digit password generated.',true);
    });
    document.getElementById('mwManualPassword')?.addEventListener('click',()=>{
      const input=document.getElementById('mwPassword');if(!input)return;
      const next=prompt('Enter a new 6-digit Exam Password.',input.value);
      if(next==null)return;
      if(!passwordUtils.isValidSixDigitPassword(next)){alert('Exam Password must be exactly 6 digits.');return}
      input.value=next;input.readOnly=true;input.type='password';setMessage('Manual 6-digit password saved for this setup session.',true);
    });
    updateBasicsPreview();
    toggleReleaseTime();
  }

  function toggleReleaseTime(){
    const mode=document.getElementById('mwResultPublishMode')?.value||'manual';
    const wrap=document.getElementById('mwResultPublishAtWrap');if(wrap)wrap.style.display=mode==='scheduled'?'block':'none';
  }

  function openQuestionTool(url){
    const child=window.open(url,'_blank');
    if(child)child.focus();else location.href=url;
  }

  function renderStep2(){
    const host=document.getElementById('mwStepHost');if(!host||!state.examId)return;
    const exam=encodeURIComponent(state.examId);
    const questionSetup=`admin-exam-questions.html?exam=${exam}`;
    host.innerHTML=`<div class="mw-coverage-head"><div><h4>QUESTIONS</h4><div class="mw-note">Choose one of the approved methods. Existing Question Bank, Excel Import and Manual Question engines are reused.</div></div></div>
      <div class="mw-question-methods">
        <button type="button" class="mw-question-method" id="mwFromQuestionBank"><b>FROM QUESTION BANK</b><small>Select permanent bank questions and attach immutable exam snapshots with existing mapping.</small></button>
        <button type="button" class="mw-question-method" id="mwExcelImport"><b>EXCEL IMPORT</b><small>Open the existing syllabus-aware Excel validation and atomic import flow.</small></button>
        <button type="button" class="mw-question-method" id="mwManualQuestion"><b>MANUAL QUESTION</b><small>Open the existing manual question form and syllabus mapping workflow.</small></button>
      </div>
      <div class="mw-question-note">Question setup opens in a separate tab so this Draft wizard remains open. Use BACK TO EXAM SETUP there to return here, then continue to Blueprint & Validation.</div>`;
    document.getElementById('mwFromQuestionBank')?.addEventListener('click',()=>openQuestionTool(`admin-question-bank.html?exam=${exam}`));
    document.getElementById('mwExcelImport')?.addEventListener('click',()=>openQuestionTool(`${questionSetup}#bulkUploadSection`));
    document.getElementById('mwManualQuestion')?.addEventListener('click',()=>openQuestionTool(`${questionSetup}#manualQuestionSection`));
  }

  async function renderStep3(){
    const host=document.getElementById('mwStepHost');if(!host||!state.examId)return;
    const next=document.getElementById('mwNext');if(next)next.disabled=true;
    host.innerHTML='<div class="mw-placeholder"><b>Blueprint & Validation</b>Running server-authoritative validation…</div>';
    try{
      const data=await callAdminExams({action:'master_blueprint_validation',examId:state.examId});
      if(state.step!==3)return;
      const validation=data.validation||{},summary=validation.summary||{},issues=Array.isArray(validation.issues)?validation.issues:[];
      state.blueprintValidation=validation;
      const ready=validation.status==='EXAM READY'&&validation.ok===true;
      const statusText=ready?'EXAM READY':'ACTION REQUIRED';
      host.innerHTML=`
        <div id="mwBlueprintStatus" class="mw-blueprint-status ${ready?'ready':'action'}"><strong>${statusText}</strong><span>${ready?'Question count, marks, keys, syllabus mapping, subject plan and coverage checks are green.':'Resolve every issue below before Blueprint approval.'}${data.approvedAt?` • Previously approved: ${esc(new Date(data.approvedAt).toLocaleString())}`:''}</span></div>
        <div class="mw-blueprint-metrics">
          <div class="mw-summary-card"><small>EXPECTED Q</small><b>${esc(summary.expectedQuestions||0)}</b></div>
          <div class="mw-summary-card"><small>ADDED Q</small><b>${esc(summary.totalQuestions||0)}</b></div>
          <div class="mw-summary-card"><small>MAPPED</small><b>${esc(summary.mappedQuestions||0)}</b></div>
          <div class="mw-summary-card"><small>ANSWER KEYS</small><b>${esc(summary.answerKeyCount||0)}</b></div>
          <div class="mw-summary-card"><small>EXPECTED MARKS</small><b>${esc(summary.expectedMarks||0)}</b></div>
          <div class="mw-summary-card"><small>QUESTION MARKS</small><b>${esc(summary.questionMarksTotal||0)}</b></div>
        </div>
        <div id="mwBlueprintIssues">${issues.length?issues.map(issue=>`<div class="mw-blueprint-issue"><div><b>${esc(issue.code||'ACTION REQUIRED')}</b><small>${esc(issue.message||'Resolve this validation issue.')}</small></div><button type="button" class="mw-mini" data-blueprint-target="${esc(issue.target||'QUESTIONS')}">GO TO ${esc(issue.target||'QUESTIONS')}</button></div>`).join(''):'<div class="mw-note" style="padding:10px 0">No unresolved Blueprint issues.</div>'}</div>
        <div class="mw-blueprint-approve"><button type="button" id="mwApproveBlueprint" class="mw-btn primary" ${ready?'':'disabled'}>APPROVE BLUEPRINT & CONTINUE</button></div>`;
      host.querySelectorAll('[data-blueprint-target]').forEach(btn=>btn.addEventListener('click',()=>setStep(2)));
      document.getElementById('mwApproveBlueprint')?.addEventListener('click',approveStep3);
      if(next)next.disabled=!ready;
    }catch(error){
      state.blueprintValidation=null;
      host.innerHTML=`<div id="mwBlueprintStatus" class="mw-blueprint-status action"><strong>ACTION REQUIRED</strong><span>${esc(error?.message||'Could not validate Blueprint.')}</span></div><div id="mwBlueprintIssues"></div>`;
      if(next)next.disabled=true;
    }
  }

  async function approveStep3(){
    if(!state.blueprintValidation?.ok){setMessage('Blueprint is not ready for approval.');return}
    const buttons=[document.getElementById('mwNext'),document.getElementById('mwApproveBlueprint')].filter(Boolean);
    buttons.forEach(btn=>btn.disabled=true);
    setMessage('Approving Blueprint…');
    try{
      const data=await callAdminExams({action:'approve_master_blueprint',examId:state.examId});
      if(data.status!=='EXAM READY')throw new Error('Blueprint approval did not reach EXAM READY status.');
      setMessage('Blueprint approved. EXAM READY.',true);
      setStep(4);
    }catch(error){
      setMessage(error?.message||'Could not approve Blueprint.');
      await renderStep3();
    }finally{buttons.forEach(btn=>btn.disabled=false)}
  }

  function renderPlaceholder(){
    const host=document.getElementById('mwStepHost');if(!host)return;
    const label=STEP_LABELS[state.step-1];
    const notes={4:'All Active or Selected Student assignment.',5:'Final review, publish validation, portal notification and result release settings.'};
    host.innerHTML=`<div class="mw-placeholder"><b>${esc(label)}</b>${esc(notes[state.step]||'This setup step is being connected in Phase 2.')}</div>`;
  }

  function setStep(step){
    state.step=Math.min(5,Math.max(1,Number(step)||1));
    document.querySelectorAll('#mwSteps .mw-step').forEach(btn=>{
      const n=Number(btn.dataset.step);btn.classList.toggle('active',n===state.step);btn.classList.toggle('done',!!state.examId&&n<state.step);
    });
    const back=document.getElementById('mwBack');if(back)back.disabled=state.step===1;
    const next=document.getElementById('mwNext');if(next){next.disabled=false;next.textContent=state.step===1?(state.examId?'SAVE CHANGES & CONTINUE':'CREATE DRAFT & CONTINUE'):state.step===3?'APPROVE VALIDATION & CONTINUE':'CONTINUE';}
    setMessage('');
    if(state.step===1)renderStep1();else if(state.step===2)renderStep2();else if(state.step===3)renderStep3();else renderPlaceholder();
  }

  const WIZARD_ENDPOINT=`${window.SGA_SUPABASE_URL}/functions/v1/admin-exam-wizard`;
  const ADMIN_EXAMS_ENDPOINT=`${window.SGA_SUPABASE_URL}/functions/v1/admin-exams`;
  async function callEndpoint(endpoint,payload){
    const {data:{session}}=await c.auth.getSession();
    if(!session?.access_token)throw new Error('Admin session expired. Please sign in again.');
    const res=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY},
      body:JSON.stringify(payload)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok){const error=new Error(data.error||'Exam request failed');error.validation=data.validation||null;throw error}
    return data;
  }
  const callWizard=payload=>callEndpoint(WIZARD_ENDPOINT,payload);
  const callAdminExams=payload=>callEndpoint(ADMIN_EXAMS_ENDPOINT,payload);

  function releaseValue(){
    if(document.getElementById('mwResultPublishMode')?.value!=='scheduled')return null;
    const local=document.getElementById('mwResultPublishAt')?.value||'';
    if(!local)return null;
    const d=new Date(local);return Number.isNaN(d.getTime())?null:d.toISOString();
  }

  function basicPayload(){
    return {
      examType:document.getElementById('mwExamType')?.value||'',
      batchNo:Number(document.getElementById('mwBatchNo')?.value||0),
      examDate:document.getElementById('mwExamDate')?.value||'',
      title:(document.getElementById('mwTitle')?.value||'').trim(),
      physicsQuestions:Number(document.getElementById('mwPhysicsQuestions')?.value||0),
      chemistryQuestions:Number(document.getElementById('mwChemistryQuestions')?.value||0),
      biologyQuestions:Number(document.getElementById('mwBiologyQuestions')?.value||0),
      expectedQuestions:Number(document.getElementById('mwExpectedQuestions')?.value||0),
      durationMinutes:Number(document.getElementById('mwDurationMinutes')?.value||0),
      examPassword:document.getElementById('mwPassword')?.value||'',
      resultPublishMode:document.getElementById('mwResultPublishMode')?.value||'manual',
      resultPublishAt:releaseValue(),
      instructions:(document.getElementById('mwInstructions')?.value||'').trim()
    };
  }

  async function saveStep1(){
    const btn=document.getElementById('mwNext');if(btn)btn.disabled=true;
    const payload=basicPayload();
    if(!Number.isInteger(payload.expectedQuestions)||payload.expectedQuestions<=0){setMessage('Add at least one question across Physics, Chemistry or Biology.');if(btn)btn.disabled=false;return}
    if(!passwordUtils.isValidSixDigitPassword(payload.examPassword)){
      setMessage('Exam Password must be exactly 6 digits.');
      if(btn)btn.disabled=false;
      return;
    }
    setMessage(state.examId?'Saving changes…':'Creating Draft Exam…');
    try{
      const data=state.examId
        ? await callWizard({action:'update_master_basics',examId:state.examId,...payload})
        : await callWizard({action:'create_master_exam',...payload});
      if(!state.examId){state.examId=data.examId;state.examCode=data.examCode}
      state.basics = payload;
      state.blueprintValidation=null;
      setMessage(`Draft saved${state.examCode?` • ${state.examCode}`:''}`,true);
      setStep(2);
      window.dispatchEvent(new CustomEvent('sga:master-exam-draft-saved',{detail:{examId:state.examId,examCode:state.examCode}}));
    }catch(error){setMessage(error?.message||'Could not save exam')}
    finally{if(btn)btn.disabled=false}
  }

  async function onNext(){
    if(state.step===1){await saveStep1();return}
    if(state.step===3){await approveStep3();return}
    if(state.step<5)setStep(state.step+1);
  }

  function setMessage(message,ok=false){const el=document.getElementById('mwMsg');if(!el)return;el.textContent=message||'';el.classList.toggle('ok',!!ok)}

  async function loadBootstrap(){
    if(state.bootstrap)return state.bootstrap;
    state.bootstrap=await callWizard({action:'wizard_bootstrap'});
    return state.bootstrap;
  }

  async function openWizard(){
    state.examId=null;state.examCode='';state.step=1;state.basics=null;state.blueprintValidation=null;state.titleTouched=false;state.lastSuggestedTitle='';
    const modal=ensureModal();modal.classList.add('open');setStep(1);
    try{await loadBootstrap()}catch(error){setMessage(error?.message||'Could not load exam setup')}
  }
  function closeWizard(){document.getElementById('masterExamWizardModal')?.classList.remove('open')}

  addBtn.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();openWizard();
  },true);
})();