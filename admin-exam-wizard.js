(()=>{
  if(window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED !== true)return;
  const c=window.sgaSupabase;
  const addBtn=document.getElementById('addBtn');
  if(!c||!addBtn)return;

  const TYPE_CODES={daily:'DT',weekly:'WT',monthly:'MT',grand:'GT'};
  const TYPE_LABELS={daily:'DAILY TEST',weekly:'WEEKLY TEST',monthly:'MONTHLY TEST',grand:'GRAND TEST'};
  const SUBJECTS=['Physics','Chemistry','Biology'];
  const STEP_LABELS=['Basic Details','Coverage / Syllabus','Questions','Blueprint & Validation','Students / Audience','Publish / Result Release'];
  const state={examId:null,examCode:'',step:1,bootstrap:null,basics:null,coverage:[],coverageLoaded:false,blueprintValidation:null,titleTouched:false,lastSuggestedTitle:''};

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
      #masterExamWizardModal{z-index:90}.master-wizard-card{width:min(1120px,97vw);max-height:94vh;overflow:auto;background:#fff;border-radius:14px;padding:0;box-shadow:0 24px 70px #04152f55}.mw-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #e3eaf3;background:linear-gradient(135deg,#f7fbff,#fffaf4)}.mw-head h3{margin:0;color:#06275f}.mw-head p{margin:5px 0 0;font-size:10px;color:#718096}.mw-close{border:1px solid #cbd7e6;background:#fff;border-radius:7px;padding:8px 11px;font-weight:900;color:#53637a;cursor:pointer}.mw-steps{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border-bottom:1px solid #e3eaf3;background:#fbfcfe}.mw-step{padding:12px 8px;text-align:center;font-size:8px;font-weight:900;color:#7b8799;border:0;background:transparent}.mw-step span{display:block;width:22px;height:22px;line-height:22px;margin:0 auto 5px;border-radius:50%;background:#e9eef5;color:#53637a}.mw-step.active{color:#06275f;background:#f3f8ff}.mw-step.active span{background:#06275f;color:#fff}.mw-step.done span{background:#087443;color:#fff}.mw-body{padding:20px 22px}.mw-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.mw-field label{display:block;margin-bottom:5px;font-size:9px;font-weight:900;color:#43566f}.mw-field input,.mw-field select,.mw-field textarea{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cbd7e6;border-radius:7px;background:#fff;color:#17355d}.mw-field input[readonly]{background:#f5f8fc;color:#64748b}.mw-span2{grid-column:1/-1}.mw-score-strip{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;background:#f8fbff;border:1px solid #dce7f3;border-radius:9px}.mw-score-strip div{background:#fff;border:1px solid #e5ebf3;border-radius:7px;padding:9px}.mw-score-strip small{display:block;font-size:8px;font-weight:900;color:#79869a}.mw-score-strip b{display:block;margin-top:3px;color:#06275f;font-size:12px}.mw-password-row{display:flex;gap:6px}.mw-password-row input{flex:1}.mw-mini{border:1px solid #b9c9dc;background:#fff;color:#07316d;border-radius:6px;padding:7px 9px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}.mw-note{font-size:9px;color:#7b8799;margin-top:5px;line-height:1.45}.mw-placeholder{border:1px dashed #b9c9dc;background:#f8fbff;border-radius:10px;padding:24px;text-align:center;color:#53637a}.mw-placeholder b{display:block;color:#06275f;margin-bottom:6px}.mw-msg{min-height:19px;margin-top:12px;color:#b42318;font-size:10px}.mw-msg.ok{color:#087443}.mw-actions{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid #e8edf4}.mw-actions-right{display:flex;gap:8px}.mw-btn{padding:9px 13px;border:1px solid #b8c8de;background:#fff;color:#07316d;border-radius:7px;font-size:9px;font-weight:900;cursor:pointer}.mw-btn.primary{background:#06275f!important;color:#fff!important;border-color:#06275f!important}.mw-btn:disabled{opacity:.5;cursor:not-allowed}.mw-coverage-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.mw-coverage-head h4{margin:0;color:#06275f}.mw-coverage-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.mw-summary-card{border:1px solid #dce5ef;border-radius:8px;padding:9px 10px;background:#f9fbfe}.mw-summary-card small{display:block;font-size:8px;font-weight:900;color:#7b8799}.mw-summary-card b{display:block;margin-top:3px;color:#06275f}.mw-coverage-table{overflow:auto;border:1px solid #dce5ef;border-radius:9px}.mw-coverage-row{display:grid;grid-template-columns:.8fr 1.15fr 1.3fr 1.25fr .65fr auto;gap:8px;align-items:end;padding:10px;border-top:1px solid #edf1f6;min-width:900px}.mw-coverage-row:first-child{border-top:0}.mw-coverage-row label{display:block;font-size:8px;font-weight:900;color:#63738a;margin-bottom:4px}.mw-coverage-row select,.mw-coverage-row input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd7e6;border-radius:6px;background:#fff;color:#17355d;font-size:9px}.mw-remove{border:1px solid #e8b4b4;background:#fff;color:#b42318;border-radius:6px;padding:8px 9px;font-size:8px;font-weight:900;cursor:pointer}.mw-coverage-alert{margin-top:9px;border-radius:7px;padding:9px 10px;font-size:9px;display:none}.mw-coverage-alert.show{display:block}.mw-coverage-alert.bad{background:#fff1f0;border:1px solid #ffc9c5;color:#a61b1b}.mw-coverage-alert.good{background:#edf9f2;border:1px solid #bfe4cf;color:#087443}.mw-question-methods{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.mw-question-method{border:1px solid #cbd7e6;background:#f8fbff;border-radius:10px;padding:16px;text-align:left;cursor:pointer;color:#07316d}.mw-question-method b{display:block;font-size:11px}.mw-question-method small{display:block;margin-top:5px;color:#718096;line-height:1.45}.mw-question-note{margin-top:12px;border:1px solid #dce7f3;background:#f8fbff;border-radius:9px;padding:11px;color:#53637a;font-size:9px;line-height:1.5}.mw-blueprint-status{border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0;background:#f8fafc}.mw-blueprint-status.ready{background:#edf9f2;border-color:#bfe4cf}.mw-blueprint-status.action{background:#fff7ed;border-color:#fed7aa}.mw-blueprint-status strong{display:block;font-size:18px;color:#06275f}.mw-blueprint-status span{display:block;margin-top:5px;font-size:10px;color:#667085}.mw-blueprint-metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0}.mw-blueprint-issue{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #f0d3b8;background:#fffaf4;border-radius:8px;padding:10px 12px;margin-top:8px}.mw-blueprint-issue b{display:block;color:#8a4b17;font-size:10px}.mw-blueprint-issue small{display:block;color:#667085;margin-top:3px}.mw-blueprint-approve{margin-top:14px;display:flex;justify-content:flex-end}@media(max-width:900px){.mw-steps{grid-template-columns:repeat(3,1fr)}.mw-grid{grid-template-columns:1fr}.mw-span2,.mw-score-strip{grid-column:auto}.mw-score-strip,.mw-coverage-summary{grid-template-columns:1fr 1fr}.mw-question-methods{grid-template-columns:1fr}.mw-blueprint-metrics{grid-template-columns:1fr 1fr 1fr}.mw-blueprint-issue{align-items:flex-start;flex-direction:column}}`;
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
    const b=state.basics||{};
    const today=b.examDate||indiaDate();
    host.innerHTML=`<div class="mw-grid">
      <div class="mw-field"><label>Test Type</label><select id="mwExamType" ${state.examId?'disabled':''}><option value="daily">Daily Test (DT)</option><option value="weekly">Weekly Test (WT)</option><option value="monthly">Monthly Test (MT)</option><option value="grand">Grand Test (GT)</option></select></div>
      <div class="mw-field"><label>Academy Batch Number</label><input id="mwBatchNo" type="number" min="1" max="99" value="${esc(b.batchNo||1)}" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Date</label><input id="mwExamDate" type="date" value="${esc(today)}" ${state.examId?'readonly':''}></div>
      <div class="mw-field"><label>Exam Code</label><input id="mwExamCode" readonly placeholder="SGA-DT-010909"><div class="mw-note">Final code is generated by the server when the Draft is created.</div></div>
      <div class="mw-field mw-span2"><label>Exam Title</label><input id="mwTitle" placeholder="Academy exam title" value="${esc(b.title||'')}"></div>
      <div class="mw-field"><label>Expected Questions</label><input id="mwExpectedQuestions" type="number" min="1" value="${esc(b.expectedQuestions||45)}"></div>
      <div class="mw-field"><label>Duration (Minutes)</label><input id="mwDurationMinutes" type="number" min="1" value="${esc(b.durationMinutes||45)}"><div class="mw-note">Student receives this full personal countdown after START. No common start/end time.</div></div>
      <div class="mw-score-strip"><div><small>MARKS / CORRECT</small><b>+4</b></div><div><small>WRONG</small><b>−1</b></div><div><small>UNATTEMPTED</small><b>0</b></div><div><small>MARKING</small><b>+4 / −1 / 0</b></div></div>
      <div class="mw-field"><label>Total Marks</label><input id="mwTotalMarks" readonly></div>
      <div class="mw-field"><label>Exam Password</label><div class="mw-password-row"><input id="mwPassword" type="password" readonly><button type="button" class="mw-mini" id="mwShowPassword">SHOW</button><button type="button" class="mw-mini" id="mwCopyPassword">COPY</button></div><div class="mw-password-row" style="margin-top:6px"><button type="button" class="mw-mini" id="mwRegeneratePassword">REGENERATE</button><button type="button" class="mw-mini" id="mwManualPassword">MANUAL CHANGE</button></div><div class="mw-note">Password is not included in Student Portal notification.</div></div>
      <div class="mw-field"><label>Result Publication Mode</label><select id="mwResultPublishMode"><option value="manual">Manual</option><option value="scheduled">Scheduled</option></select><div class="mw-note">Result release is separate from the student’s personal exam timer.</div></div>
      <div class="mw-field mw-span2" id="mwResultPublishAtWrap" style="display:none"><label>Scheduled Result Publication Date & Time</label><input id="mwResultPublishAt" type="datetime-local" value="${esc(localDateTimeValue(b.resultPublishAt))}"></div>
      <div class="mw-field mw-span2"><label>Instructions</label><textarea id="mwInstructions" rows="3" placeholder="Instructions visible before the student starts">${esc(b.instructions||'')}</textarea></div>
    </div>`;
    const type=document.getElementById('mwExamType');if(type)type.value=b.examType||'daily';
    const release=document.getElementById('mwResultPublishMode');if(release)release.value=b.resultPublishMode||'manual';
    const password=document.getElementById('mwPassword');if(password)password.value=b.examPassword||randomPassword();
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

  function syllabusUnits(subject){
    return (state.bootstrap?.syllabus||[]).filter(unit=>unit.subject===subject);
  }
  function unitById(id){return (state.bootstrap?.syllabus||[]).find(unit=>String(unit.id)===String(id))||null}
  function chapterById(id){
    for(const unit of state.bootstrap?.syllabus||[]){const found=(unit.chapters||[]).find(ch=>String(ch.id)===String(id));if(found)return found}
    return null;
  }
  function subjectForUnit(id){return unitById(id)?.subject||''}

  function coverageIssues(items){
    const issues=[];const seen=new Set();const whole=new Set();const topic=new Set();
    items.forEach((row,index)=>{
      const chapterKey=`${row.subject}|${row.unitId}|${row.chapterId}`;
      const exact=`${chapterKey}|${row.subtopicId||'WHOLE'}`;
      if(seen.has(exact))issues.push({code:'DUPLICATE_SCOPE',row:index+1,message:'Duplicate coverage row'});
      seen.add(exact);
      if(row.subtopicId)topic.add(chapterKey);else whole.add(chapterKey);
    });
    whole.forEach(key=>{if(topic.has(key))issues.push({code:'WHOLE_CHAPTER_TOPIC_OVERLAP',message:'Whole Chapter overlaps a Specific Topic in the same Chapter'})});
    return issues;
  }

  function coverageItems(){
    return state.coverage.map((row,index)=>({
      subject:row.subject,
      unitId:row.unitId,
      chapterId:row.chapterId,
      subtopicId:row.subtopicId||null,
      plannedQuestions:Number(row.plannedQuestions||0),
      sortOrder:index
    }));
  }

  function coverageSummary(){
    const counts={Physics:0,Chemistry:0,Biology:0};
    for(const row of state.coverage){if(counts[row.subject]!=null)counts[row.subject]+=Number(row.plannedQuestions||0)}
    return {...counts,total:counts.Physics+counts.Chemistry+counts.Biology};
  }

  function updateCoverageSummary(){
    const summary=coverageSummary();
    for(const subject of SUBJECTS){const el=document.getElementById(`mw${subject}Planned`);if(el)el.textContent=String(summary[subject])}
    const total=document.getElementById('mwTotalPlanned');if(total)total.textContent=String(summary.total);
    const expected=Number(state.basics?.expectedQuestions||0);
    const alert=document.getElementById('mwCoverageAlert');if(!alert)return;
    const issues=coverageIssues(coverageItems());
    if(issues.length){alert.textContent=issues[0].message;alert.className='mw-coverage-alert show bad';return}
    if(summary.total!==expected){alert.textContent=`Total Planned ${summary.total} / ${expected}. Match the Expected Questions before continuing.`;alert.className='mw-coverage-alert show bad';return}
    alert.textContent=`Coverage complete: ${summary.total} / ${expected} questions planned.`;alert.className='mw-coverage-alert show good';
  }

  function renderCoverageRows(){
    const host=document.getElementById('mwCoverageRows');if(!host)return;
    host.innerHTML=state.coverage.map((row,index)=>{
      const units=syllabusUnits(row.subject);
      const unit=unitById(row.unitId);
      const chapters=unit?.chapters||[];
      const chapter=chapterById(row.chapterId);
      const topics=chapter?.subtopics||[];
      return `<div class="mw-coverage-row" data-index="${index}">
        <div><label>Subject</label><select data-field="subject"><option value="">Select</option>${SUBJECTS.map(x=>`<option value="${x}" ${row.subject===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div><label>Unit</label><select data-field="unitId" ${row.subject?'':'disabled'}><option value="">Select Unit</option>${units.map(x=>`<option value="${x.id}" ${String(row.unitId)===String(x.id)?'selected':''}>${esc(`Unit ${x.unit_no ?? ''} ${x.unit_title||''}`.trim())}</option>`).join('')}</select></div>
        <div><label>Chapter</label><select data-field="chapterId" ${unit?'':'disabled'}><option value="">Select Chapter</option>${chapters.map(x=>`<option value="${x.id}" ${String(row.chapterId)===String(x.id)?'selected':''}>${esc(x.topic_title||`Chapter ${x.id}`)}</option>`).join('')}</select></div>
        <div><label>Topic / Whole Chapter</label><select data-field="subtopicId" ${chapter?'':'disabled'}><option value="">WHOLE CHAPTER</option>${topics.map(x=>`<option value="${x.id}" ${String(row.subtopicId)===String(x.id)?'selected':''}>${esc(x.subtopic_title||`Topic ${x.id}`)}</option>`).join('')}</select></div>
        <div><label>Questions Planned</label><input data-field="plannedQuestions" type="number" min="1" value="${esc(row.plannedQuestions||'')}"></div>
        <button type="button" class="mw-remove" data-remove="${index}">REMOVE</button>
      </div>`;
    }).join('')||'<div class="mw-note" style="padding:14px">Add at least one syllabus coverage row.</div>';
    host.querySelectorAll('select,input').forEach(control=>control.addEventListener('change',onCoverageFieldChange));
    host.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{state.coverage.splice(Number(btn.dataset.remove),1);renderCoverageRows();updateCoverageSummary()}));
    updateCoverageSummary();
  }

  function onCoverageFieldChange(event){
    const rowEl=event.target.closest('[data-index]');if(!rowEl)return;
    const index=Number(rowEl.dataset.index);const row=state.coverage[index];if(!row)return;
    const field=event.target.dataset.field;const value=event.target.value;
    if(field==='subject'){row.subject=value;row.unitId='';row.chapterId='';row.subtopicId=''}
    if(field==='unitId'){row.unitId=value;row.chapterId='';row.subtopicId=''}
    if(field==='chapterId'){row.chapterId=value;row.subtopicId=''}
    if(field==='subtopicId')row.subtopicId=value;
    if(field==='plannedQuestions')row.plannedQuestions=value;
    if(field!=='plannedQuestions')renderCoverageRows();else updateCoverageSummary();
  }

  function addCoverageRow(seed={}){
    state.coverage.push({subject:seed.subject||'Physics',unitId:seed.unitId||'',chapterId:seed.chapterId||'',subtopicId:seed.subtopicId||'',plannedQuestions:seed.plannedQuestions||''});
    renderCoverageRows();
  }

  async function renderStep2(){
    const host=document.getElementById('mwStepHost');if(!host)return;
    host.innerHTML='<div class="mw-placeholder"><b>Coverage / Syllabus</b>Loading canonical syllabus…</div>';
    try{
      await loadBootstrap();
      if(!state.coverageLoaded){
        const data=await callWizard({action:'get_master_scope',examId:state.examId});
        if(!state.basics&&data.expectedQuestions)state.basics={expectedQuestions:Number(data.expectedQuestions)};
        state.coverage=(data.items||[]).map(row=>({
          subject:subjectForUnit(row.unit_id),unitId:String(row.unit_id||''),chapterId:String(row.chapter_id||''),subtopicId:row.subtopic_id==null?'':String(row.subtopic_id),plannedQuestions:Number(row.planned_questions||0)||''
        }));
        state.coverageLoaded=true;
      }
      if(state.step!==2)return;
      host.innerHTML=`<div class="mw-coverage-head"><div><h4>STRUCTURED COVERAGE</h4><div class="mw-note">Canonical Subject → Unit → Chapter → Topic only. Use WHOLE CHAPTER when every approved topic in that chapter is in scope.</div></div><button type="button" class="mw-btn" id="mwAddCoverage">+ ADD COVERAGE</button></div>
        <div class="mw-coverage-summary"><div class="mw-summary-card"><small>Physics</small><b id="mwPhysicsPlanned">0</b></div><div class="mw-summary-card"><small>Chemistry</small><b id="mwChemistryPlanned">0</b></div><div class="mw-summary-card"><small>Biology</small><b id="mwBiologyPlanned">0</b></div><div class="mw-summary-card"><small>Total Planned</small><b><span id="mwTotalPlanned">0</span> / ${esc(state.basics?.expectedQuestions||0)}</b></div></div>
        <div class="mw-coverage-table"><div id="mwCoverageRows"></div></div><div id="mwCoverageAlert" class="mw-coverage-alert"></div>`;
      document.getElementById('mwAddCoverage')?.addEventListener('click',()=>addCoverageRow());
      if(!state.coverage.length)addCoverageRow();else renderCoverageRows();
    }catch(error){setMessage(error?.message||'Could not load coverage')}
  }

  function openQuestionTool(url){
    const child=window.open(url,'_blank');
    if(child)child.focus();else location.href=url;
  }

  function renderStep3(){
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

  async function renderStep4(){
    const host=document.getElementById('mwStepHost');if(!host||!state.examId)return;
    const next=document.getElementById('mwNext');if(next)next.disabled=true;
    host.innerHTML='<div class="mw-placeholder"><b>Blueprint & Validation</b>Running server-authoritative validation…</div>';
    try{
      const data=await callAdminExams({action:'master_blueprint_validation',examId:state.examId});
      if(state.step!==4)return;
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
      host.querySelectorAll('[data-blueprint-target]').forEach(btn=>btn.addEventListener('click',()=>setStep(btn.dataset.blueprintTarget==='COVERAGE'?2:3)));
      document.getElementById('mwApproveBlueprint')?.addEventListener('click',approveStep4);
      if(next)next.disabled=!ready;
    }catch(error){
      state.blueprintValidation=null;
      host.innerHTML=`<div id="mwBlueprintStatus" class="mw-blueprint-status action"><strong>ACTION REQUIRED</strong><span>${esc(error?.message||'Could not validate Blueprint.')}</span></div><div id="mwBlueprintIssues"></div>`;
      if(next)next.disabled=true;
    }
  }

  async function approveStep4(){
    if(!state.blueprintValidation?.ok){setMessage('Blueprint is not ready for approval.');return}
    const buttons=[document.getElementById('mwNext'),document.getElementById('mwApproveBlueprint')].filter(Boolean);
    buttons.forEach(btn=>btn.disabled=true);
    setMessage('Approving Blueprint…');
    try{
      const data=await callAdminExams({action:'approve_master_blueprint',examId:state.examId});
      if(data.status!=='EXAM READY')throw new Error('Blueprint approval did not reach EXAM READY status.');
      setMessage('Blueprint approved. EXAM READY.',true);
      setStep(5);
    }catch(error){
      setMessage(error?.message||'Could not approve Blueprint.');
      await renderStep4();
    }finally{buttons.forEach(btn=>btn.disabled=false)}
  }

  function renderPlaceholder(){
    const host=document.getElementById('mwStepHost');if(!host)return;
    const label=STEP_LABELS[state.step-1];
    const notes={5:'All Active or Selected Student assignment.',6:'Final publish validation, portal notification and result release settings.'};
    host.innerHTML=`<div class="mw-placeholder"><b>${esc(label)}</b>${esc(notes[state.step]||'This setup step is being connected in Phase 2.')}</div>`;
  }

  function setStep(step){
    state.step=Math.min(6,Math.max(1,Number(step)||1));
    document.querySelectorAll('#mwSteps .mw-step').forEach(btn=>{
      const n=Number(btn.dataset.step);btn.classList.toggle('active',n===state.step);btn.classList.toggle('done',!!state.examId&&n<state.step);
    });
    const back=document.getElementById('mwBack');if(back)back.disabled=state.step===1;
    const next=document.getElementById('mwNext');if(next){next.disabled=false;next.textContent=state.step===1?(state.examId?'SAVE CHANGES & CONTINUE':'CREATE DRAFT & CONTINUE'):state.step===2?'SAVE COVERAGE & CONTINUE':state.step===4?'APPROVE BLUEPRINT & CONTINUE':'CONTINUE';}
    setMessage('');
    if(state.step===1)renderStep1();else if(state.step===2)renderStep2();else if(state.step===3)renderStep3();else if(state.step===4)renderStep4();else renderPlaceholder();
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
      if(!state.examId){state.examId=data.examId;state.examCode=data.examCode}
      state.basics = payload;
      state.coverageLoaded=false;
      state.blueprintValidation=null;
      setMessage(`Draft saved${state.examCode?` • ${state.examCode}`:''}`,true);
      setStep(2);
      window.dispatchEvent(new CustomEvent('sga:master-exam-draft-saved',{detail:{examId:state.examId,examCode:state.examCode}}));
    }catch(error){setMessage(error?.message||'Could not save exam')}
    finally{if(btn)btn.disabled=false}
  }

  async function saveStep2(){
    const items=coverageItems();
    if(!items.length){setMessage('Add at least one coverage row.');return}
    if(items.some(row=>!row.subject||!row.unitId||!row.chapterId||!Number.isInteger(row.plannedQuestions)||row.plannedQuestions<=0)){setMessage('Complete Subject, Unit, Chapter and positive Questions Planned for every row.');return}
    const issues=coverageIssues(items);
    if(issues.some(x=>x.code==='DUPLICATE_SCOPE')){setMessage('Duplicate coverage row. Remove the duplicate before continuing.');return}
    if(issues.some(x=>x.code==='WHOLE_CHAPTER_TOPIC_OVERLAP')){setMessage('Whole Chapter and Specific Topic cannot overlap in the same Chapter.');return}
    const planned=items.reduce((sum,row)=>sum+row.plannedQuestions,0);
    const expected=Number(state.basics.expectedQuestions||0);
    if(planned!==expected){setMessage(`Total Planned must equal Expected Questions: ${planned} / ${expected}.`);return}
    const btn=document.getElementById('mwNext');if(btn)btn.disabled=true;
    setMessage('Saving structured coverage…');
    try{
      await callWizard({action:'replace_master_scope',examId:state.examId,items});
      state.coverageLoaded=true;
      state.blueprintValidation=null;
      setMessage('Coverage saved.',true);
      setStep(3);
    }catch(error){setMessage(error?.message||'Could not save coverage')}
    finally{if(btn)btn.disabled=false}
  }

  async function onNext(){
    if(state.step===1){await saveStep1();return}
    if(state.step===2){await saveStep2();return}
    if(state.step===4){await approveStep4();return}
    if(state.step<6)setStep(state.step+1);
  }

  function setMessage(message,ok=false){const el=document.getElementById('mwMsg');if(!el)return;el.textContent=message||'';el.classList.toggle('ok',!!ok)}

  async function loadBootstrap(){
    if(state.bootstrap)return state.bootstrap;
    state.bootstrap=await callWizard({action:'wizard_bootstrap'});
    return state.bootstrap;
  }

  async function openWizard(){
    state.examId=null;state.examCode='';state.step=1;state.basics=null;state.coverage=[];state.coverageLoaded=false;state.blueprintValidation=null;state.titleTouched=false;state.lastSuggestedTitle='';
    const modal=ensureModal();modal.classList.add('open');setStep(1);
    try{await loadBootstrap()}catch(error){setMessage(error?.message||'Could not load exam setup')}
  }
  function closeWizard(){document.getElementById('masterExamWizardModal')?.classList.remove('open')}

  addBtn.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();openWizard();
  },true);
})();