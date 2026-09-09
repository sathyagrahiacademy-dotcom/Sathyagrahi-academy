(()=>{
  if(window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED!==true)return;

  let examId='';
  let examCode='';
  let audienceMode='all';
  let students=[];
  let selectedIds=new Set();
  let assignedCount=0;
  let busy=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function activeStep(){return Number(document.querySelector('#mwSteps .mw-step.active')?.dataset?.step||0)}
  function host(){return document.getElementById('mwStepHost')}
  function footerNext(){return document.getElementById('mwNext')}
  function setMessage(text,ok=false){const el=document.getElementById('mwMsg');if(!el)return;el.textContent=text||'';el.classList.toggle('ok',!!ok)}

  async function callWizard(body){
    const c=window.sgaSupabase;
    const {data:{session}}=await c.auth.getSession();
    if(!session?.access_token)throw new Error('Admin session expired. Please sign in again.');
    const response=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exam-wizard`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY},
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Exam wizard request failed');
    return data;
  }

  function ensureStyles(){
    if(document.getElementById('mwReleaseStyles'))return;
    const style=document.createElement('style');
    style.id='mwReleaseStyles';
    style.textContent=`
      .mw-audience-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 0}.mw-audience-modes{display:flex;gap:8px;flex-wrap:wrap}.mw-mode{border:1px solid #cbd7e6;background:#fff;color:#07316d;border-radius:8px;padding:9px 12px;font-size:9px;font-weight:900;cursor:pointer}.mw-mode.active{background:#06275f;color:#fff;border-color:#06275f}.mw-audience-search{width:min(320px,100%);padding:9px 10px;border:1px solid #cbd7e6;border-radius:8px}.mw-audience-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.mw-audience-list{border:1px solid #dce5ef;border-radius:9px;overflow:hidden;max-height:330px;overflow-y:auto}.mw-student-row{display:grid;grid-template-columns:34px 1.2fr .8fr .55fr;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid #edf1f6}.mw-student-row:first-child{border-top:0}.mw-student-row small{color:#718096}.mw-assigned-badge{font-size:9px;font-weight:900;color:#087443}.mw-audience-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.mw-publish-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.mw-publish-card{border:1px solid #dce5ef;background:#f9fbfe;border-radius:9px;padding:12px}.mw-publish-card small{display:block;font-size:8px;font-weight:900;color:#718096}.mw-publish-card b{display:block;margin-top:4px;color:#06275f}.mw-publish-note{margin-top:12px;border:1px solid #dce7f3;background:#f8fbff;border-radius:9px;padding:12px;color:#53637a;font-size:10px;line-height:1.5}.mw-publish-action{display:flex;justify-content:flex-end;margin-top:14px}@media(max-width:700px){.mw-student-row{grid-template-columns:30px 1fr}.mw-student-row .mw-student-id,.mw-student-row .mw-student-state{grid-column:2}.mw-audience-summary,.mw-publish-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function updateAssignedCount(){
    assignedCount=audienceMode==='all'?students.length:selectedIds.size;
    const el=document.getElementById('mwAssignedCount');if(el)el.textContent=String(assignedCount);
  }

  function filteredStudents(){
    const q=String(document.getElementById('mwAudienceSearch')?.value||'').trim().toLowerCase();
    if(!q)return students;
    return students.filter(student=>`${student.full_name||''} ${student.student_id||''}`.toLowerCase().includes(q));
  }

  function renderStudentRows(){
    const rows=document.getElementById('mwAudienceRows');if(!rows)return;
    const visible=filteredStudents();
    rows.innerHTML=visible.length?visible.map(student=>{
      const checked=audienceMode==='all'||selectedIds.has(String(student.id));
      return `<label class="mw-student-row"><input class="mwStudentPick" type="checkbox" data-id="${esc(student.id)}" ${checked?'checked':''} ${audienceMode==='all'?'disabled':''}><div><b>${esc(student.full_name||'Unnamed Student')}</b><br><small>${esc(student.student_id||'No Student ID')}</small></div><div class="mw-student-id"><small>Student ID</small><br>${esc(student.student_id||'—')}</div><div class="mw-student-state"><span class="mw-assigned-badge">${checked?'ASSIGNED':'NOT ASSIGNED'}</span></div></label>`;
    }).join(''):'<div class="mw-note" style="padding:14px">No active students match this search.</div>';
    rows.querySelectorAll('.mwStudentPick').forEach(input=>input.addEventListener('change',event=>{
      const id=String(event.target.dataset.id||'');
      if(event.target.checked)selectedIds.add(id);else selectedIds.delete(id);
      updateAssignedCount();renderStudentRows();
    }));
  }

  function setMode(mode){
    audienceMode=mode==='selected'?'selected':'all';
    document.querySelectorAll('.mw-mode').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===audienceMode));
    const selectedActions=document.getElementById('mwSelectedAudienceActions');if(selectedActions)selectedActions.style.display=audienceMode==='selected'?'flex':'none';
    updateAssignedCount();renderStudentRows();
  }

  async function renderStep5(){
    if(!examId||activeStep()!==5)return;
    const target=host();if(!target)return;
    if(target.dataset.releaseStep==='5')return;
    target.dataset.releaseStep='5';
    ensureStyles();
    target.innerHTML='<div class="mw-placeholder"><b>Students / Audience</b>Loading active students…</div>';
    try{
      const data=await callWizard({action:'master_students',examId});
      if(activeStep()!==5)return;
      students=Array.isArray(data.students)?data.students:[];
      selectedIds=new Set(students.filter(student=>student.assigned).map(student=>String(student.id)));
      assignedCount=Number(data.assignedCount||0);
      audienceMode=data.exam?.audienceMode==='selected'?'selected':'all';
      if(audienceMode==='all'&&assignedCount!==students.length&&assignedCount>0)audienceMode='selected';
      target.innerHTML=`<div class="mw-coverage-head"><div><h4>STUDENTS / AUDIENCE</h4><div class="mw-note">Only active students are available. Publish requires at least one assigned student.</div></div></div>
        <div class="mw-audience-summary"><div class="mw-summary-card"><small>ACTIVE STUDENTS</small><b>${students.length}</b></div><div class="mw-summary-card"><small>ASSIGNED</small><b id="mwAssignedCount">0</b></div><div class="mw-summary-card"><small>MODE</small><b id="mwAudienceModeLabel">—</b></div></div>
        <div class="mw-audience-toolbar"><div class="mw-audience-modes"><button type="button" class="mw-mode" data-mode="all">ALL ACTIVE STUDENTS</button><button type="button" class="mw-mode" data-mode="selected">SELECTED STUDENTS</button></div><input id="mwAudienceSearch" class="mw-audience-search" placeholder="Search name or Student ID"></div>
        <div id="mwSelectedAudienceActions" class="mw-audience-actions"><button type="button" class="mw-btn" id="mwSelectAllStudents">SELECT ALL</button><button type="button" class="mw-btn" id="mwClearAllStudents">CLEAR ALL</button></div>
        <div id="mwAudienceRows" class="mw-audience-list"></div>`;
      document.querySelectorAll('.mw-mode').forEach(btn=>btn.addEventListener('click',()=>{setMode(btn.dataset.mode);document.getElementById('mwAudienceModeLabel').textContent=audienceMode==='all'?'ALL ACTIVE':'SELECTED'}));
      document.getElementById('mwAudienceSearch')?.addEventListener('input',renderStudentRows);
      document.getElementById('mwSelectAllStudents')?.addEventListener('click',()=>{selectedIds=new Set(students.map(student=>String(student.id)));updateAssignedCount();renderStudentRows()});
      document.getElementById('mwClearAllStudents')?.addEventListener('click',()=>{selectedIds.clear();updateAssignedCount();renderStudentRows()});
      document.getElementById('mwAudienceModeLabel').textContent=audienceMode==='all'?'ALL ACTIVE':'SELECTED';
      setMode(audienceMode);
      const next=footerNext();if(next){next.style.display='';next.textContent='SAVE STUDENTS & CONTINUE'}
    }catch(error){target.innerHTML=`<div class="mw-placeholder"><b>Students / Audience</b>${esc(error?.message||'Could not load students')}</div>`}
  }

  async function saveStep5(){
    if(busy)return;
    updateAssignedCount();
    if(assignedCount<=0){setMessage('Select at least one student before continuing.');return}
    busy=true;const next=footerNext();if(next)next.disabled=true;setMessage('Saving student audience…');
    try{
      const result=await callWizard({action:'save_master_audience',examId,mode:audienceMode,studentIds:audienceMode==='selected'?[...selectedIds]:[]});
      assignedCount=Number(result.assignedCount||0);
      if(assignedCount<=0){setMessage('Select at least one student before continuing.');return}
      setMessage(`${assignedCount} student(s) assigned.`,true);
      document.querySelector('#mwSteps .mw-step[data-step="6"]')?.click();
    }catch(error){setMessage(error?.message||'Could not save student audience')}
    finally{busy=false;if(next)next.disabled=false}
  }

  function releaseText(exam){
    if(exam?.resultPublishMode==='scheduled'&&exam?.resultPublishAt){
      const d=new Date(exam.resultPublishAt);return `SCHEDULED — ${Number.isNaN(d.getTime())?exam.resultPublishAt:d.toLocaleString()}`;
    }
    return 'MANUAL — Admin publishes after grading';
  }

  async function renderStep6(){
    if(!examId||activeStep()!==6)return;
    const target=host();if(!target)return;
    if(target.dataset.releaseStep==='6')return;
    target.dataset.releaseStep='6';
    ensureStyles();
    const next=footerNext();if(next)next.style.display='none';
    target.innerHTML='<div class="mw-placeholder"><b>Publish / Result Release</b>Loading final publish summary…</div>';
    try{
      const data=await callWizard({action:'master_students',examId});
      if(activeStep()!==6)return;
      const exam=data.exam||{};
      assignedCount=Number(data.assignedCount||0);
      const code=examCode||'Generated Exam Code';
      target.innerHTML=`<div class="mw-coverage-head"><div><h4>FINAL PUBLISH</h4><div class="mw-note">Server re-validates Blueprint, audience and result-release settings before publishing.</div></div></div>
        <div id="mwPublishSummary" class="mw-publish-grid">
          <div class="mw-publish-card"><small>EXAM</small><b>${esc(exam.title||'Master Exam')}</b><div class="mw-note">${esc(code)}</div></div>
          <div class="mw-publish-card"><small>STUDENTS</small><b>${assignedCount} assigned</b></div>
          <div class="mw-publish-card"><small>AVAILABILITY</small><b>Start Anytime while available</b><div class="mw-note">No common fixed start/end time. Personal countdown starts on START.</div></div>
          <div class="mw-publish-card"><small>RESULT RELEASE</small><b>${esc(releaseText(exam))}</b></div>
        </div>
        <div class="mw-publish-note"><b>Student Portal notification</b><br>Shows exam name, code, date, duration, marks, syllabus/coverage context, Start Anytime while available, and result-release wording. Exam password is not included. No publish email or WhatsApp is sent.</div>
        <div class="mw-publish-action"><button type="button" class="mw-btn primary" id="mwPublishExam">PUBLISH EXAM</button></div>`;
      document.getElementById('mwPublishExam')?.addEventListener('click',publishStep6);
    }catch(error){target.innerHTML=`<div class="mw-placeholder"><b>Publish / Result Release</b>${esc(error?.message||'Could not load publish summary')}</div>`}
  }

  async function publishStep6(){
    if(busy)return;
    if(assignedCount<=0){setMessage('Assign at least one student before publishing.');return}
    if(!confirm('Publish this exam to assigned students?'))return;
    busy=true;const btn=document.getElementById('mwPublishExam');if(btn){btn.disabled=true;btn.textContent='PUBLISHING…'};setMessage('Running final publish validation…');
    try{
      const result=await callWizard({action:'publish_master_exam',examId});
      if(result.ok!==true)throw new Error('Publish failed');
      setMessage(`Exam published • ${Number(result.assignedCount||assignedCount)} student(s) • Student Portal only.`,true);
      if(btn){btn.textContent='PUBLISHED';btn.disabled=true}
      window.dispatchEvent(new CustomEvent('sga:master-exam-published',{detail:{examId,examCode,status:'active'}}));
    }catch(error){setMessage(error?.message||'Could not publish exam');if(btn){btn.disabled=false;btn.textContent='PUBLISH EXAM'}}
    finally{busy=false}
  }

  function syncStep(){
    const step=activeStep();
    const next=footerNext();
    if(step!==6&&next)next.style.display='';
    if(step===5)renderStep5();
    if(step===6)renderStep6();
  }

  window.addEventListener('sga:master-exam-draft-saved',event=>{
    examId=String(event.detail?.examId||'');
    examCode=String(event.detail?.examCode||'');
  });

  document.addEventListener('click',event=>{
    const next=event.target?.closest?.('#mwNext');
    if(!next)return;
    const step=activeStep();
    if(step===5){event.preventDefault();event.stopImmediatePropagation();saveStep5()}
  },true);

  const observer=new MutationObserver(syncStep);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();