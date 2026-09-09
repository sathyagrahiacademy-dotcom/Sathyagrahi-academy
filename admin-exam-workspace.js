(()=>{
  const c=window.sgaSupabase;
  const params=new URLSearchParams(location.search);
  const examId=String(params.get('exam')||'');
  const host=document.getElementById('workspaceHost');
  const tabs=document.getElementById('workspaceTabs');
  const title=document.getElementById('wsTitle');
  const subtitle=document.getElementById('wsSubtitle');
  if(!c||!host||!tabs||!examId){if(host)host.innerHTML='<div class="ws-empty">Exam ID is missing.</div>';return}

  let control=null,audience=null,scope=null,blueprint=null,bootstrap=null;
  let activeTab=['overview','coverage','questions','blueprint','students'].includes(String(params.get('tab')||'').toLowerCase())?String(params.get('tab')).toLowerCase():'overview';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[ch]));
  const typeLabel=t=>({daily:'DT',weekly:'WT',monthly:'MT',grand:'GT'}[String(t||'').toLowerCase()]||String(t||'—').toUpperCase());
  const dateLabel=v=>{if(!v)return '—';const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};

  async function authHeaders(){
    const {data:{session}}=await c.auth.getSession();
    if(!session?.access_token)throw new Error('Admin session expired.');
    return {'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`};
  }
  async function callFunction(name,body){
    const response=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/${name}`,{method:'POST',headers:await authHeaders(),body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Request failed');
    return data;
  }
  const callAdminExams=body=>callFunction('admin-exams',body);
  const callWizard=body=>callFunction('admin-exam-wizard',body);

  async function loadCore(){
    const [center,students,validation]=await Promise.all([
      callAdminExams({action:'control_center'}),
      callWizard({action:'master_students',examId}),
      callAdminExams({action:'master_blueprint_validation',examId})
    ]);
    control=(center.exams||[]).find(exam=>String(exam.id)===examId)||null;
    if(!control)throw new Error('Exam not found in Control Center.');
    audience=students;
    blueprint=validation;
    title.textContent=control.title||'EXAM WORKSPACE';
    subtitle.textContent=`${control.examCode||'No code'} • ${typeLabel(control.examType)} • Batch ${control.batchNo==null?'—':String(control.batchNo).padStart(2,'0')} • ${dateLabel(control.examDate)}`;
  }

  function issueRows(){
    const issues=Array.isArray(control?.issues)?control.issues:[];
    if(!issues.length)return '<div class="ws-status good">NO SETUP ISSUES</div>';
    return issues.map(issue=>`<div class="ws-issue"><b>${esc(String(issue.severity||'').toUpperCase())}</b> — ${esc(issue.label||issue.code||'Action required')} <small>• ${esc(issue.action||'Review')}</small></div>`).join('');
  }

  function overview(){
    const exam=audience?.exam||{};
    const nextTarget=(control?.issues||[])[0]?.target||'';
    return `<div class="ws-grid">
      <div class="ws-metric"><small>Exam Code</small><b>${esc(control.examCode||'—')}</b></div>
      <div class="ws-metric"><small>Test Type</small><b>${esc(typeLabel(control.examType))}</b></div>
      <div class="ws-metric"><small>Batch</small><b>${control.batchNo==null?'—':esc(String(control.batchNo).padStart(2,'0'))}</b></div>
      <div class="ws-metric"><small>Exam Date</small><b>${esc(dateLabel(control.examDate))}</b></div>
      <div class="ws-metric"><small>Duration</small><b>${Number(exam.durationMinutes||0)||'—'} min</b></div>
      <div class="ws-metric"><small>Questions Ready</small><b>${Number(control.questionCount||0)} / ${Number(control.expectedQuestions||0)}</b></div>
      <div class="ws-metric"><small>Mapping</small><b>${Number(control.mappedQuestions||0)} / ${Number(control.questionCount||0)}</b></div>
      <div class="ws-metric"><small>Assigned Students</small><b>${Number(control.assignedCount||0)}</b></div>
      <div class="ws-metric"><small>Result Mode</small><b>${esc(String(control.resultPublishMode||'manual').toUpperCase())}</b></div>
      <div class="ws-metric"><small>Blueprint</small><b>${control.blueprintApproved?'APPROVED':'PENDING'}</b></div>
      <div class="ws-metric"><small>Lifecycle</small><b>${esc(String(control.state||'draft').replaceAll('_',' ').toUpperCase())}</b></div>
      <div class="ws-metric"><small>Next Action</small><b>${esc(control.nextAction||'Review Exam')}</b></div>
    </div>
    <div class="ws-section"><h2>Setup Health</h2>${issueRows()}</div>
    <div class="ws-actions"><button class="ws-btn primary" data-open-tab="${esc(String(nextTarget||'overview').toLowerCase())}">OPEN NEXT ACTION</button><a class="ws-btn" href="admin-exam-questions.html?exam=${encodeURIComponent(examId)}">OPEN QUESTIONS</a></div>`;
  }

  async function ensureScope(){
    if(scope&&bootstrap)return;
    [scope,bootstrap]=await Promise.all([callWizard({action:'get_master_scope',examId}),callWizard({action:'wizard_bootstrap'})]);
  }
  function scopeNames(row){
    for(const unit of bootstrap?.syllabus||[]){
      if(String(unit.id)!==String(row.unit_id))continue;
      const chapter=(unit.chapters||[]).find(ch=>String(ch.id)===String(row.chapter_id));
      const topic=row.subtopic_id==null?null:(chapter?.subtopics||[]).find(sub=>String(sub.id)===String(row.subtopic_id));
      return {subject:unit.subject||'—',unit:unit.unit_title||'—',chapter:chapter?.topic_title||'—',topic:topic?.subtopic_title||'WHOLE CHAPTER'};
    }
    return {subject:'—',unit:'—',chapter:'—',topic:'—'};
  }
  async function coverage(){
    await ensureScope();
    const items=scope?.items||[];
    const total=items.reduce((sum,row)=>sum+Number(row.planned_questions||0),0);
    return `<div class="ws-section" style="margin-top:0;border-top:0;padding-top:0"><h2>COVERAGE</h2><div class="ws-grid"><div class="ws-metric"><small>ROWS</small><b>${items.length}</b></div><div class="ws-metric"><small>PLANNED</small><b>${total} / ${Number(scope?.expectedQuestions||0)}</b></div></div>${items.length?items.map(row=>{const n=scopeNames(row);return `<div class="ws-row"><div><b>${esc(n.subject)} • ${esc(n.unit)}</b><br><small>${esc(n.chapter)} → ${esc(n.topic)}</small></div><b>${Number(row.planned_questions||0)} Q</b></div>`}).join(''):'<div class="ws-empty">No structured coverage yet.</div>'}</div>`;
  }
  function questions(){
    return `<div class="ws-section" style="margin-top:0;border-top:0;padding-top:0"><h2>QUESTIONS</h2><div class="ws-grid"><div class="ws-metric"><small>EXPECTED</small><b>${Number(control.expectedQuestions||0)}</b></div><div class="ws-metric"><small>ADDED</small><b>${Number(control.questionCount||0)}</b></div><div class="ws-metric"><small>MAPPED</small><b>${Number(control.mappedQuestions||0)}</b></div><div class="ws-metric"><small>ANSWER KEYS</small><b>${Number(control.keyedQuestions||0)}</b></div></div><div class="ws-actions"><a class="ws-btn primary" href="admin-exam-questions.html?exam=${encodeURIComponent(examId)}">OPEN QUESTION SETUP</a></div></div>`;
  }
  function blueprintView(){
    const validation=blueprint?.validation||{};
    const issues=validation.issues||[];
    return `<div class="ws-section" style="margin-top:0;border-top:0;padding-top:0"><h2>BLUEPRINT</h2><div class="ws-status ${validation.ok?'good':''}">${esc(validation.status||'ACTION REQUIRED')}</div><div class="ws-grid" style="margin-top:12px"><div class="ws-metric"><small>QUESTIONS</small><b>${Number(validation.summary?.totalQuestions||0)} / ${Number(validation.summary?.expectedQuestions||0)}</b></div><div class="ws-metric"><small>MAPPED</small><b>${Number(validation.summary?.mappedQuestions||0)}</b></div><div class="ws-metric"><small>ANSWER KEYS</small><b>${Number(validation.summary?.answerKeyCount||0)}</b></div><div class="ws-metric"><small>APPROVAL</small><b>${blueprint?.approvedAt?'APPROVED':'PENDING'}</b></div></div>${issues.length?issues.map(issue=>`<div class="ws-issue"><b>${esc(issue.code||'ISSUE')}</b> — ${esc(issue.message||'Review setup')}</div>`).join(''):'<div class="ws-empty" style="margin-top:12px">Blueprint validation is green.</div>'}</div>`;
  }
  function studentsView(){
    const rows=(audience?.students||[]).filter(student=>student.assigned);
    return `<div class="ws-section" style="margin-top:0;border-top:0;padding-top:0"><h2>STUDENTS</h2><div class="ws-grid"><div class="ws-metric"><small>Assigned Students</small><b>${Number(audience?.assignedCount||0)}</b></div><div class="ws-metric"><small>Audience Mode</small><b>${esc(String(audience?.exam?.audienceMode||'all').toUpperCase())}</b></div></div>${rows.length?rows.map(student=>`<div class="ws-row"><div><b>${esc(student.full_name||'Unnamed Student')}</b><br><small>${esc(student.student_id||'No Student ID')}</small></div><span class="ws-status good">ASSIGNED</span></div>`).join(''):'<div class="ws-empty">No active students assigned.</div>'}</div>`;
  }

  async function render(){
    tabs.querySelectorAll('[data-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===activeTab));
    host.innerHTML='<div class="ws-empty">Loading...</div>';
    try{
      if(activeTab==='overview')host.innerHTML=overview();
      else if(activeTab==='coverage')host.innerHTML=await coverage();
      else if(activeTab==='questions')host.innerHTML=questions();
      else if(activeTab==='blueprint')host.innerHTML=blueprintView();
      else if(activeTab==='students')host.innerHTML=studentsView();
      host.querySelector('[data-open-tab]')?.addEventListener('click',event=>{
        const target=String(event.currentTarget.dataset.openTab||'overview');
        activeTab=['coverage','questions','blueprint','students'].includes(target)?target:'overview';render();
      });
    }catch(error){host.innerHTML=`<div class="ws-empty">${esc(error?.message||'Could not load Workspace.')}</div>`}
  }

  tabs.addEventListener('click',event=>{
    const btn=event.target.closest('[data-tab]');if(!btn||btn.disabled)return;
    activeTab=btn.dataset.tab;history.replaceState(null,'',`?exam=${encodeURIComponent(examId)}&tab=${encodeURIComponent(activeTab)}`);render();
  });

  loadCore().then(render).catch(error=>{host.innerHTML=`<div class="ws-empty">${esc(error?.message||'Could not load Workspace.')}</div>`});
})();
