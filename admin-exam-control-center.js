(()=>{
  const c=window.sgaSupabase;
  const ui=window.ExamControlCenterUI;
  const rows=document.getElementById('rows');
  const search=document.getElementById('search');
  const toolbar=document.querySelector('.toolbar');
  const countLine=document.getElementById('countLine');
  if(!c||!ui||!rows||!search||!toolbar||!countLine)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[ch]));
  const typeLabel=t=>({daily:'DT',weekly:'WT',monthly:'MT',grand:'GT',unit:'LEGACY UNIT'}[String(t||'').toLowerCase()]||String(t||'LEGACY').toUpperCase());
  const dateLabel=v=>{if(!v)return '—';const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};
  const style=document.createElement('style');
  style.id='examControlCenterStyles';
  style.textContent=`
  .exam-summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0}.exam-summary-card{background:#fff;border:1px solid #d9e3ef;border-radius:11px;padding:13px 14px}.exam-summary-card small{display:block;font-size:8px;font-weight:900;letter-spacing:.55px;color:#74839a}.exam-summary-card b{display:block;margin-top:5px;font-size:21px;color:#06275f}.exam-summary-card.attention b{color:#b42318}.exam-priority-card{display:grid;grid-template-columns:1.7fr repeat(4,minmax(90px,.7fr));gap:10px;align-items:center;background:linear-gradient(135deg,#f7fbff,#fffaf4);border:1px solid #ccdbee;border-radius:12px;padding:14px 16px;margin-bottom:13px}.exam-priority-main small,.exam-priority-stat small{display:block;font-size:8px;font-weight:900;letter-spacing:.45px;color:#7b8799}.exam-priority-main h3{margin:4px 0;color:#06275f;font-size:14px}.exam-priority-main p{margin:0;color:#64748b;font-size:10px}.exam-priority-stat b{display:block;margin-top:4px;color:#17355d;font-size:11px}.exam-attention{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:12px 14px;margin-bottom:13px}.exam-attention-head{display:flex;justify-content:space-between;align-items:center}.exam-attention-head b{font-size:12px;color:#06275f}.exam-attention-item{display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #eef2f6;font-size:10px}.exam-attention-item strong{color:#b42318}.exam-attention-item span{flex:1;color:#53637a}.exam-lifecycle-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.exam-lifecycle-tabs button{border:1px solid #cbd8e8;background:#fff;color:#36516f;border-radius:20px;padding:7px 11px;font-size:9px;font-weight:900;cursor:pointer}.exam-lifecycle-tabs button.active{background:#06275f;color:#fff;border-color:#06275f}.exam-control-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.exam-control-filters select{padding:9px 10px;border:1px solid #ccd7e5;border-radius:7px;background:#fff;color:#17355d;font-size:10px}.exam-status{display:inline-block;padding:5px 8px;border-radius:20px;font-size:8px;font-weight:900;background:#edf2f7;color:#475569}.exam-status.available,.exam-status.ready{background:#eef6ff;color:#0b4a9e}.exam-status.live,.exam-status.result_published{background:#eaf8f1;color:#087443}.exam-status.results_ready{background:#fff7ed;color:#9a3412}.exam-status.archived{background:#f2f4f7;color:#667085}.exam-month-row td{background:#f7f9fc!important;color:#53637a!important;font-size:9px!important;font-weight:900!important;letter-spacing:.45px!important}.exam-empty{padding:24px!important;text-align:center!important;color:#78859a!important}@media(max-width:1100px){.exam-summary-grid{grid-template-columns:repeat(3,1fr)}.exam-priority-card{grid-template-columns:1fr 1fr 1fr}.exam-priority-main{grid-column:1/-1}}@media(max-width:760px){.exam-summary-grid{grid-template-columns:1fr 1fr}.exam-priority-card{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  let exams=[],today='',activeTab='all',observer=null,loading=false;

  async function call(body){
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Admin session expired');
    const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exams`,{
      method:'POST',headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(body)
    });
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;
  }

  function ensureShell(){
    let summary=document.getElementById('examSummaryCards');
    if(!summary){summary=document.createElement('div');summary.id='examSummaryCards';summary.className='exam-summary-grid';toolbar.insertAdjacentElement('beforebegin',summary)}
    let priority=document.getElementById('todayExamCard');
    if(!priority){priority=document.createElement('div');priority.id='todayExamCard';toolbar.insertAdjacentElement('beforebegin',priority)}
    let attention=document.getElementById('needsAttention');
    if(!attention){attention=document.createElement('div');attention.id='needsAttention';toolbar.insertAdjacentElement('beforebegin',attention)}
    let tabs=document.getElementById('examLifecycleTabs');
    if(!tabs){tabs=document.createElement('div');tabs.id='examLifecycleTabs';tabs.className='exam-lifecycle-tabs';toolbar.insertAdjacentElement('afterend',tabs)}
    let filters=document.getElementById('examControlFilters');
    if(!filters){
      filters=document.createElement('div');filters.id='examControlFilters';filters.className='exam-control-filters';
      filters.innerHTML='<select id="examTypeFilter"><option value="all">All Types</option></select><select id="examBatchFilter"><option value="all">All Batches</option></select><select id="examMonthFilter"><option value="all">All Months</option></select>';
      tabs.insertAdjacentElement('afterend',filters)
    }
    const head=rows.closest('table')?.querySelector('thead tr');
    if(head)head.innerHTML='<th>EXAM NAME</th><th>TYPE</th><th>BATCH</th><th>DATE</th><th>CODE</th><th>QUESTIONS</th><th>STUDENTS</th><th>STATUS</th><th>NEXT ACTION</th>';
  }

  function fillSelect(id,values,label){
    const el=document.getElementById(id);if(!el)return;
    const current=el.value||'all';
    el.innerHTML=`<option value="all">All ${label}</option>${values.map(v=>`<option value="${esc(v.value)}">${esc(v.label)}</option>`).join('')}`;
    if([...el.options].some(o=>o.value===current))el.value=current;
  }

  function renderFilters(){
    const types=[...new Set(exams.map(x=>x.examType).filter(Boolean))].sort().map(v=>({value:v,label:typeLabel(v)}));
    const batches=[...new Set(exams.map(x=>x.batchNo).filter(v=>v!=null))].sort((a,b)=>Number(a)-Number(b)).map(v=>({value:String(v),label:`Batch ${String(v).padStart(2,'0')}`}));
    const months=[...new Set(exams.map(x=>String(x.examDate||'').slice(0,7)).filter(v=>/^\d{4}-\d{2}$/.test(v)))].sort().reverse().map(v=>({value:v,label:new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${v}-01T00:00:00Z`))}));
    fillSelect('examTypeFilter',types,'Types');fillSelect('examBatchFilter',batches,'Batches');fillSelect('examMonthFilter',months,'Months');
  }

  function renderSummary(summary={}){
    document.getElementById('examSummaryCards').innerHTML=[
      ["TODAY'S EXAMS",summary.today||0,''],['UPCOMING / AVAILABLE',summary.upcomingAvailable||0,''],['LIVE NOW',summary.liveNow||0,''],['RESULTS PENDING',summary.resultsPending||0,''],['ACTION REQUIRED',summary.actionRequired||0,'attention']
    ].map(([label,value,cls])=>`<div class="exam-summary-card ${cls}"><small>${label}</small><b>${value}</b></div>`).join('');
  }

  function actionButton(x){
    const id=esc(x.id),action=String(x.nextAction||'View Exam');
    if(action==='Continue Setup')return `<button class="small-btn edit" data-id="${id}">CONTINUE SETUP</button>`;
    if(action==='Publish Exam')return `<button class="small-btn audience" data-id="${id}" data-publish="true">PUBLISH EXAM</button>`;
    if(action==='Monitor Exam')return `<button class="small-btn manage" data-id="${id}">MONITOR EXAM</button>`;
    if(action==='Review Results'||action==='Publish Results')return `<button class="small-btn control-next" data-route="results" data-id="${id}">${esc(action.toUpperCase())}</button>`;
    if(action==='View Performance')return `<button class="small-btn control-next" data-route="performance" data-id="${id}">VIEW PERFORMANCE</button>`;
    return `<button class="small-btn control-next" data-route="questions" data-id="${id}">VIEW EXAM</button>`;
  }

  function renderPriority(){
    const x=ui.priorityExam(exams,{today}),host=document.getElementById('todayExamCard');
    if(!x){host.innerHTML='';return}
    host.innerHTML=`<div class="exam-priority-card"><div class="exam-priority-main"><small>PRIORITY EXAM</small><h3>${esc(x.title)}</h3><p>${esc(x.examCode||'No code')} • ${esc(ui.statusLabel(x.state))}</p></div><div class="exam-priority-stat"><small>QUESTIONS</small><b>${x.questionCount}/${x.expectedQuestions??x.questionCount}</b></div><div class="exam-priority-stat"><small>MAPPING</small><b>${x.mappedQuestions}/${x.questionCount}</b></div><div class="exam-priority-stat"><small>STUDENTS</small><b>${x.assignedCount}</b></div><div class="exam-priority-stat"><small>RESULT MODE</small><b>${esc(String(x.resultPublishMode||'manual').toUpperCase())}</b></div></div>`;
  }

  function renderAttention(){
    const host=document.getElementById('needsAttention'),items=[];
    for(const x of exams)for(const issue of (x.issues||[]))items.push({exam:x,issue});
    if(!items.length){host.innerHTML='';return}
    host.className='exam-attention';
    host.innerHTML=`<div class="exam-attention-head"><b>ACTION REQUIRED</b><small>${items.length} issue${items.length===1?'':'s'}</small></div>${items.slice(0,8).map(({exam,issue})=>`<div class="exam-attention-item"><strong>${esc(String(issue.severity||'').toUpperCase())}</strong><span>${esc(exam.title)} — ${esc(issue.label)}</span><button class="small-btn control-fix" data-id="${esc(exam.id)}" data-target="${esc(issue.target)}">${esc(issue.action)}</button></div>`).join('')}`;
  }

  function renderTabs(){
    const tabs=[['all','ALL'],['draft','DRAFT'],['upcoming','UPCOMING / AVAILABLE'],['live','LIVE'],['conducted','CONDUCTED'],['archived','ARCHIVED']];
    document.getElementById('examLifecycleTabs').innerHTML=tabs.map(([key,label])=>`<button type="button" data-tab="${key}" class="${activeTab===key?'active':''}">${label}</button>`).join('');
  }

  function filtered(){return ui.filterControlCenterExams(exams,{tab:activeTab,search:search.value,type:document.getElementById('examTypeFilter')?.value,batch:document.getElementById('examBatchFilter')?.value,month:document.getElementById('examMonthFilter')?.value})}
  function rowHtml(x){
    const issue=(x.issues||[]).length?'<span style="color:#b42318">●</span> ':'';
    const draftDelete=x.state==='draft'?` <button class="small-btn delete-draft" data-id="${esc(x.id)}" data-delete-draft="1">DELETE DRAFT EXAM</button>`:'';
    const access=`<button type="button" class="small-btn exam-access-btn" data-exam-access="1" data-exam-id="${esc(x.id)}" data-exam-code="${esc(x.examCode||'')}" data-exam-title="${esc(x.title)}" data-exam-state="${esc(x.state)}">ACCESS</button>`;
    return `<tr data-control-row="1"><td><strong>${issue}${esc(x.title)}</strong></td><td><span class="type-badge">${esc(typeLabel(x.examType))}</span></td><td>${x.batchNo==null?'—':esc(String(x.batchNo).padStart(2,'0'))}</td><td>${esc(dateLabel(x.examDate))}</td><td><strong>${esc(x.examCode||'—')}</strong><br>${access}</td><td>${x.questionCount}/${x.expectedQuestions??x.questionCount}</td><td>${x.assignedCount}</td><td><span class="exam-status ${esc(x.state)}">${esc(ui.statusLabel(x.state))}</span></td><td class="exam-next" data-id="${esc(x.id)}">${actionButton(x)} <button class="small-btn questions" data-id="${esc(x.id)}">QUESTIONS</button>${draftDelete}</td></tr>`;
  }

  function renderTable(){
    const list=filtered();
    if(observer)observer.disconnect();
    if(activeTab==='conducted'){
      const groups=ui.groupConductedByMonth(list);
      rows.innerHTML=groups.length?groups.map(g=>`<tr class="exam-month-row" data-control-row="1"><td colspan="9">${esc(g.label)}</td></tr>${g.exams.map(rowHtml).join('')}`).join(''):'<tr data-control-row="1"><td colspan="9" class="exam-empty">No conducted exams found.</td></tr>';
    }else rows.innerHTML=list.length?list.map(rowHtml).join(''):'<tr data-control-row="1"><td colspan="9" class="exam-empty">No exams found for this view.</td></tr>';
    countLine.textContent=`${list.length} exam${list.length===1?'':'s'} shown • ${ui.statusLabel(activeTab==='upcoming'?'available':activeTab)}`;
    if(observer)observer.observe(rows,{childList:true});
  }

  function route(id,target){
    if(target==='results')location.href=`admin-results.html?exam=${encodeURIComponent(id)}`;
    else if(target==='performance')location.href=`admin-performance.html?exam=${encodeURIComponent(id)}`;
    else location.href=`admin-exam-questions.html?exam=${encodeURIComponent(id)}`;
  }

  async function loadControlCenter(){
    if(loading)return;loading=true;
    try{
      const data=await call({action:'control_center'});today=data.today||'';exams=Array.isArray(data.exams)?data.exams:[];
      ensureShell();renderSummary(data.summary||{});renderPriority();renderAttention();renderTabs();renderFilters();renderTable();
    }catch(err){countLine.textContent=`Control Center unavailable: ${err.message||'Request failed'}`}
    finally{document.querySelector('.content')?.classList.remove('exam-master-pending');loading=false}
  }

  function wire(){
    search.placeholder='Search exam name or code';search.oninput=renderTable;
    document.getElementById('examLifecycleTabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;activeTab=b.dataset.tab;renderTabs();renderTable()};
    document.getElementById('examControlFilters').onchange=renderTable;
    document.getElementById('needsAttention').onclick=e=>{const b=e.target.closest('.control-fix');if(!b)return;const target=b.dataset.target;if(target==='QUESTIONS')route(b.dataset.id,'questions');else{activeTab='all';renderTabs();renderTable();document.querySelector(`#rows [data-id="${CSS.escape(b.dataset.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'})}};
    rows.addEventListener('click',async e=>{
      const del=e.target.closest('[data-delete-draft]');
      if(del){
        e.preventDefault();e.stopPropagation();
        const exam=exams.find(x=>String(x.id)===String(del.dataset.id));
        if(!exam||exam.state!=='draft')return;
        const confirmCode=window.prompt(`DELETE DRAFT EXAM\n\nType the exact Exam Code to confirm:\n${exam.examCode||''}`,'');
        if(confirmCode==null)return;
        del.disabled=true;
        try{await call({action:'delete',examId:exam.id,confirmCode});await loadControlCenter()}
        catch(err){window.alert(err?.message||'Could not delete draft exam')}
        finally{del.disabled=false}
        return;
      }
      const b=e.target.closest('.control-next');if(b){e.preventDefault();e.stopPropagation();route(b.dataset.id,b.dataset.route)}
    });
    observer=new MutationObserver(()=>{if(rows.querySelector('[data-control-row]'))return;setTimeout(loadControlCenter,0)});observer.observe(rows,{childList:true});
  }

  function waitForLegacy(){
    if(typeof rows.onclick!=='function'){setTimeout(waitForLegacy,25);return}
    ensureShell();wire();loadControlCenter();
  }
  waitForLegacy();
})();