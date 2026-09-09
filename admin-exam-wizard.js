(()=>{
  if(window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED !== true)return;
  const c=window.sgaSupabase;
  const addBtn=document.getElementById('addBtn');
  if(!c||!addBtn)return;

  const TYPE_CODES={daily:'DT',weekly:'WT',monthly:'MT',grand:'GT'};
  const TYPE_LABELS={daily:'DAILY TEST',weekly:'WEEKLY TEST',monthly:'MONTHLY TEST',grand:'GRAND TEST'};
  const STEP_LABELS=['Basic Details','Coverage / Syllabus','Questions','Blueprint & Validation','Students / Audience','Publish / Result Release'];
  const state={examId:null,examCode:'',step:1,bootstrap:null,titleTouched:false,lastSuggestedTitle:''};

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const indiaDate=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const randomPassword=()=>{
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  };

  function injectStyle(){
    if(document.getElementById('masterExamWizardStyles'))return;
    const style=document.createElement('style');
    style.id='masterExamWizardStyles';
    style.textContent=`
      #masterExamWizardModal{z-index:90}.master-wizard-card{width:min(1120px,97vw);max-height:94vh;overflow:auto;background:#fff;border-radius:14px;padding:0;box-shadow:0 24px 70px #04152f55}.mw-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #e3eaf3;background:linear-gradient(135deg,#f7fbff,#fffaf4)}.mw-head h3{margin:0;color:#06275f}.mw-head p{margin:5px 0 0;font-size:10px;color:#718096}.mw-close{border:1px solid #cbd7e6;background:#fff;border-radius:7px;padding:8px 11px;font-weight:900;color:#53637a;cursor:pointer}.mw-steps{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border-bottom:1px solid #e3eaf3;background:#fbfcfe}.mw-step{padding:12px 8px;text-align:center;font-size:8px;font-weight:900;color:#7b8799;border:0;background:transparent}.mw-step span{display:block;width:22px;height:22px;line-height:22px;margin:0 auto 5px;border-radius:50%;background:#e9eef5;color:#53637a}.mw-step.active{color:#06275f;background:#f3f8ff}.mw-step.active span{background:#06275f;color:#fff}.mw-step.done span{background:#087443;color:#fff}.mw-body{padding:20px 22px}.mw-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.mw-field label{display:block;margin-bottom:5px;font-size:9px;font-weight:900;color:#43566f}.mw-field input,.mw-field select,.mw-field textarea{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cbd7e6;border-radius:7px;background:#fff;color:#17355d}.mw-field input[readonly]{background:#f5f8fc;color:#64748b}.mw-span2{grid-column:1/-1}.mw-score-strip{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;background:#f8fbff;border:1px solid #dce7f3;border-radius:9px}.mw-score-strip div{background:#fff;border:1px solid #e5ebf3;border-radius:7px;padding:9px}.mw-score-strip small{display:block;font-size:8px;font-weight:900;color:#79869a}.mw-score-strip b{display:block;margin-top:3px;color:#06275f;font-size:12px}.mw-password-row{display:flex;gap:6px}.mw-password-row input{flex:1}.mw-mini{border:1px solid #b9c9dc;background:#fff;color:#07316d;border-radius:6px;padding:7px 9px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}.mw-note{font-size:9px;color:#7b8799;margin-top:5px;line-height:1.45}.mw-placeholder{border:1px dashed #b9c9dc;background:#f8fbff;border-radius:10px;padding:24px;text-align:center;color:#53637a}.mw-placeholder b{display:block;color:#06275f;margin-bottom:6px}.mw-msg{min-height:19px;margin-top:12px;color:#b42318;font-size:10px}.mw-msg.ok{color:#087443}.mw-actions{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid #e8edf4}.mw-actions-right{display:flex;gap:8px}.mw-btn{padding:9px 13px;border:1px solid #b8c8de;background:#fff;color:#07316d;border-radius:7px;font-size:9px;font-weight:900;cursor:pointer}.mw-btn.primary{background:#06275f!important;color:#fff!important;border-color:#06275f!important}.mw-btn:disabled{opacity:.5;cursor:not-allowed}@media(max-width:900px){.mw-steps{grid-template-columns:repeat(3,1fr)}.mw-grid{grid-template-columns:1fr}.mw-span2,.mw-score-strip{grid-column:auto}.mw-score-strip{grid-template-columns:1fr 1fr}}`;
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
      <div class="mw-body"><div id="mwStepHost"></div><div class="mw-msg" id="mwMsg"></div><div class="mw-actions"><div class="mw-note" id="mwIdentityNote">New exam is saved as Draft after Step 1.</div><div class="mw-actions-right"><button type="button" class="mw-btn" id="mwBack">BACK</button><button type="button" class="mw-btn primary" id="mwNext">SAVE & CONTINUE</button></div></div></div>
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
    const type=document.getElementById('mwExamType')?.value||'daily';
    const typeCode=TYPE_CODES[type]||'';
    const batch=Number(document.getElementById('mwBatchNo')?.value||0);
    const date=document.getElementById('mwExamDate')?.value||'';
    if(!typeCode||!Number.isInteger(batch)||batch<1||batch>99||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const [,mm,dd]=date.split('-');
    return `SGA-${typeCode}-${String(batch).padStart(2,'0')}${dd}${mm}`;
  }

  function suggestedTitle(){
    const type=document.getElementById('mwExamType')?.value||'daily';
    const batch=Number(document.getElementById('mwBatchNo')?.value||0);
    const date=document.getElementById('mwExamDate')?.value||'';
    if(!TYPE_LABELS[type]||!batch||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const [year,month,day]=date.split('-');
    const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `SGA ${TYPE_LABELS[type]} | BATCH ${String(batch).padStart(2,'0')} | ${day} ${months[Number(month)-1]} ${year}`;
  }

  function updateBasicsPreview(){
    const expected=Number(document.getElementById('mwExpectedQuestions')?.value||0);
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
    const today=indiaDate();
    host.innerHTML=`<div class="mw-grid">
      <div class="mw-field"><label>Test Type</label><select id="mwExamType" ${state.examId?'disabled':''}><option value="daily">Daily Test (DT)</option><option value="weekly">Weekly Test (WT)</option><option value="monthly">Monthly Test (MT)</option><option value="grand">Grand Test (GT)</option></select></div>
      <div class="mw-field"><label>Academy Batch Number</label><input id="mwBatchNo" type="number" min="1" max="99" value="1" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Date</label><input id="mwExamDate" type="date" value="${today}" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Code</label><input id="mwExamCode" readonly placeholder="SGA-DT-010909"><div class="mw-note">Final code is generated by the server when the Draft is created.</div></div>
      <div class="mw-field mw-span2"><label>Exam Title</label><input id="mwTitle" placeholder="Academy exam title"></div>
      <div class="mw-field"><label>Expected Questions</label><input id="mwExpectedQuestions" type="number" min="1" value="45"></div>
      <div class="mw-field"><label>Duration (Minutes)</label><input id="mwDurationMinutes" type="number" min="1" value="45"><div class="mw-note">Student receives this full personal countdown after START. No common start/end time.</div></div>
      <div class="mw-score-strip"><div><small>MARKS / CORRECT</small><b>+4</b></div><div><small>WRONG</small><b>−1</b></div><div><small>UNATTEMPTED</small><b>0</b></div><div><small>MARKING</small><b>+4 / −1 / 0</b></div></div>
      <div class="mw-field"><label>Total Marks</label><input id="mwTotalMarks" readonly></div>
      <div class="mw-field"><label>Exam Password</label><div class="mw-password-row"><input id="mwPassword" type="password" readonly><button type="button" class="mw-mini" id="mwShowPassword">SHOW</button><button type="button" class="mw-mini" id="mwCopyPassword">COPY</button></div><div class="mw-password-row" style="margin-top:6px"><button type="button" class="mw-mini" id="mwRegeneratePassword">REGENERATE</button><button type="button" class="mw-mini" id="mwManualPassword">MANUAL CHANGE</button></div><div class="mw-note">Password is not included in Student Portal notification.</div></div>
      <div class="mw-field"><label>Result Publication Mode</label><select id="mwResultPublishMode"><option value="manual">Manual</option><option value="scheduled">Scheduled</option></select><div class="mw-note">Result release is separate from the student’s personal exam timer.</div></div>
      <div class="mw-field mw-span2" id="mwResultPublishAtWrap" style="display:none"><label>Scheduled Result Publication Date & Time</label><input id="mwResultPublishAt" type="datetime-local"></div>
      <div class="mw-field mw-span2"><label>Instructions</label><textarea id="mwInstructions" rows="3" placeholder="Instructions visible before the student starts"></textarea></div>
    </div>`;
    const password=document.getElementById('mwPassword');if(password)password.value=randomPassword();
    for(const id of ['mwExamType','mwBatchNo','mwExamDate','mwExpectedQuestions'])document.getElementById(id)?.addEventListener('input',updateBasicsPreview);
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
      const input=document.getElementById('mwPassword');if(!input)return;input.value=randomPassword();input.readOnly=true;setMessage('New password generated.',true);
    });
    document.getElementById('mwManualPassword')?.addEventListener('click',()=>{
      const input=document.getElementById('mwPassword');if(!input)return;input.readOnly=false;input.type='text';input.focus();input.select();
    });
    updateBasicsPreview();
    toggleReleaseTime();
  }

  function toggleReleaseTime(){
    const mode=document.getElementById('mwResultPublishMode')?.value||'manual';
    const wrap=document.getElementById('mwResultPublishAtWrap');if(wrap)wrap.style.display=mode==='scheduled'?'block':'none';
  }

  function renderPlaceholder(){
    const host=document.getElementById('mwStepHost');if(!host)return;
    const label=STEP_LABELS[state.step-1];
    const notes={2:'Structured Subject → Unit → Chapter → Topic coverage with planned question counts.',3:'Question Bank, Excel Import and Manual Question workflow.',4:'Pre-publish Blueprint validation and approval.',5:'All Active or Selected Student assignment.',6:'Final publish validation, portal notification and result release settings.'};
    host.innerHTML=`<div class="mw-placeholder"><b>${esc(label)}</b>${esc(notes[state.step]||'This setup step is being connected in Phase 2.')}</div>`;
  }

  function setStep(step){
    state.step=Math.min(6,Math.max(1,Number(step)||1));
    document.querySelectorAll('#mwSteps .mw-step').forEach(btn=>{
      const n=Number(btn.dataset.step);btn.classList.toggle('active',n===state.step);btn.classList.toggle('done',!!state.examId&&n<state.step);
    });
    const back=document.getElementById('mwBack');if(back)back.disabled=state.step===1;
    const next=document.getElementById('mwNext');if(next)next.textContent=state.step===1?(state.examId?'SAVE CHANGES & CONTINUE':'CREATE DRAFT & CONTINUE'):'CONTINUE';
    setMessage('');
    if(state.step===1)renderStep1();else renderPlaceholder();
  }

  async function callWizard(payload){
    const {data:{session}}=await c.auth.getSession();
    if(!session?.access_token)throw new Error('Admin session expired. Please sign in again.');
    const res=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exam-wizard`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY},
      body:JSON.stringify(payload)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Exam wizard request failed');
    return data;
  }

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
    setMessage(state.examId?'Saving changes…':'Creating Draft Exam…');
    try{
      const payload=basicPayload();
      const data=state.examId
        ? await callWizard({action:'update_master_basics',examId:state.examId,...payload})
        : await callWizard({action:'create_master_exam',...payload});
      if(!state.examId){
        state.examId=data.examId;
        state.examCode=data.examCode;
      }
      setMessage(`Draft saved${state.examCode?` • ${state.examCode}`:''}`,true);
      setStep(2);
      window.dispatchEvent(new CustomEvent('sga:master-exam-draft-saved',{detail:{examId:state.examId,examCode:state.examCode}}));
    }catch(error){setMessage(error?.message||'Could not save exam')}
    finally{if(btn)btn.disabled=false}
  }

  async function onNext(){
    if(state.step===1){await saveStep1();return;}
    if(state.step<6)setStep(state.step+1);
  }

  function setMessage(message,ok=false){const el=document.getElementById('mwMsg');if(!el)return;el.textContent=message||'';el.classList.toggle('ok',!!ok)}

  async function loadBootstrap(){
    if(state.bootstrap)return state.bootstrap;
    state.bootstrap=await callWizard({action:'wizard_bootstrap'});
    return state.bootstrap;
  }

  async function openWizard(){
    state.examId=null;state.examCode='';state.step=1;state.titleTouched=false;state.lastSuggestedTitle='';
    const modal=ensureModal();modal.classList.add('open');setStep(1);
    try{await loadBootstrap()}catch(error){setMessage(error?.message||'Could not load exam setup')}
  }
  function closeWizard(){document.getElementById('masterExamWizardModal')?.classList.remove('open')}

  addBtn.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();openWizard();
  },true);
})();
