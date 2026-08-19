(async()=>{
  const c=window.sgaSupabase,$=id=>document.getElementById(id);
  let students=[],selectedId=null,currentSubjectExams=[];
  const esc=(v='')=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const num=v=>Number(v||0);
  const pct=v=>`${num(v).toFixed(1)}%`;
  const hours=m=>{m=num(m);const h=Math.floor(m/60),r=m%60;return h?`${h}h ${r}m`:`${r}m`};
  const date=v=>{if(!v)return '—';const d=new Date(String(v).length===10?v+'T00:00:00+05:30':v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'})};
  const dateTime=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})};

  const {data:{session}}=await c.auth.getSession();
  if(!session)return location.replace('admin-login.html');
  const {data:admin}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();
  if(!admin||admin.role!=='admin'||!admin.is_active)return location.replace('admin-login.html');

  function lastStudyLabel(s){return s.last_study_date?date(s.last_study_date):'No study log yet'}
  function renderList(){
    const q=$('search').value.trim().toLowerCase();
    const list=students.filter(s=>!q||`${s.full_name||''} ${s.academy_student_id||''}`.toLowerCase().includes(q));
    $('studentList').innerHTML=list.length?list.map(s=>`<button class="student-item ${selectedId===s.student_uuid?'active':''}" data-id="${s.student_uuid}"><b>${esc(s.full_name||'Student')}</b><small>${esc(s.academy_student_id||'')}</small><div class="mini"><span>${pct(s.syllabus_completion)} complete</span><span>${esc(lastStudyLabel(s))}</span></div></button>`).join(''):'<div class="empty">No matching students.</div>';
  }

  async function loadStudents(){
    const r=await c.rpc('admin_student_monitoring_list');
    if(r.error)throw r.error;
    students=r.data||[];renderList();
    if(students.length){await openStudent(students[0].student_uuid)}
  }

  function summaryCard(label,value){return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`}
  function subjectCard(s){const p=Math.max(0,Math.min(100,num(s.progress_percent)));return `<div class="subject-card" data-subject="${esc(s.subject)}"><b>${esc(s.subject)}</b><span class="pct">${p.toFixed(1)}%</span><div class="bar"><i style="width:${p}%"></i></div><span class="open-note">View chapters & revisions →</span></div>`}


  const statusLabel=v=>({not_started:'Not Started',studying:'Studying',practice:'Practice',completed:'Completed'}[v]||v||'Not Started');
  const uniqExams=list=>[...new Map((list||[]).map(x=>[x.exam_id,x])).values()];

  function examState(e){
    if(e.attempt_id){
      if(e.result_is_published && e.percentage!=null)return {label:'Attempted',cls:'attempted',score:pct(e.percentage)};
      if(['submitted','auto_submitted','graded'].includes(String(e.attempt_status||'')))return {label:'Submitted',cls:'pending',score:'Result Pending'};
      return {label:'In Progress',cls:'pending',score:'—'};
    }
    return {label:'Not Attempted',cls:'',score:'—'};
  }


  function orderedExams(list){
    return uniqExams(list).sort((a,b)=>{
      const av=new Date(a.exam_created_at||a.scheduled_start||0).getTime()||0;
      const bv=new Date(b.exam_created_at||b.scheduled_start||0).getTime()||0;
      return av-bv || String(a.title||'').localeCompare(String(b.title||''));
    });
  }

  function examChipClass(e){
    const st=examState(e);
    if(st.cls==='attempted')return 'done';
    if(st.cls==='pending')return 'pending';
    return '';
  }

  function renderExamDetail(e){
    const st=examState(e);
    const resultState=e.result_is_published?'Published':(e.attempt_id?'Pending':'Not Attempted');
    const score=e.result_is_published && e.total_score!=null
      ? `${num(e.total_score).toFixed(0)} / ${num(e.total_marks).toFixed(0)}`
      : '—';
    return `<div class="exam-detail-head">
      <div><b>${esc(e.title||'Exam')}</b><div class="topic-meta">${esc(e.syllabus||e.subject||'')}</div></div>
      <span class="${st.cls}">${esc(st.label)}</span>
    </div>
    <div class="exam-detail-grid">
      <div><small>EXAM CODE</small><strong>${esc(e.exam_code||'—')}</strong></div>
      <div><small>RESULT</small><strong>${esc(resultState)}</strong></div>
      <div><small>SCORE</small><strong>${esc(score)}</strong></div>
      <div><small>PERCENTAGE</small><strong>${e.result_is_published&&e.percentage!=null?esc(pct(e.percentage)):'—'}</strong></div>
      <div><small>CORRECT</small><strong>${e.result_is_published?num(e.correct_count):'—'}</strong></div>
      <div><small>WRONG</small><strong>${e.result_is_published?num(e.wrong_count):'—'}</strong></div>
      <div><small>UNATTEMPTED</small><strong>${e.result_is_published?num(e.unattempted_count):'—'}</strong></div>
      <div><small>SUBMITTED</small><strong>${e.submitted_at?dateTime(e.submitted_at):'—'}</strong></div>
    </div>`;
  }

  function renderExamItem(e){
    const st=examState(e);
    const when=e.scheduled_start?dateTime(e.scheduled_start):'Schedule not set';
    return `<div class="exam-item">
      <div><b>${esc(e.title)}</b><small>${esc(e.syllabus||e.subject||'')} · ${when}</small></div>
      <span class="exam-state ${st.cls}">${esc(st.label)}</span>
      <span class="exam-score">${esc(st.score)}</span>
    </div>`;
  }

  function groupSubjectRows(rows){
    const map=new Map();
    for(const r of rows||[]){
      const key=String(r.unit_id);
      if(!map.has(key))map.set(key,{unit_id:r.unit_id,unit_no:r.unit_no,unit_title:r.unit_title,topics:[]});
      map.get(key).topics.push(r);
    }
    return [...map.values()].sort((a,b)=>num(a.unit_no)-num(b.unit_no));
  }

  function renderTopicRow(t,examRows=[]){
    const due=t.next_revision_at && new Date(t.next_revision_at).getTime()<=Date.now();
    const topicExams=orderedExams((examRows||[]).filter(e=>String(e.topic_id||'')===String(t.topic_id||'')));
    const examChips=topicExams.length
      ? `<span class="topic-exam-chips">${topicExams.map((e,i)=>`<button type="button" class="exam-chip ${examChipClass(e)}" data-topic-exam-chip="${esc(e.exam_id)}" title="${esc(e.title||'Exam')}">E${i+1}</button>`).join('')}</span>`
      : '';

    return `<div class="topic-row ${topicExams.length?'has-exam':''}">
      <div>
        <div class="topic-title-line">
          <div class="topic-name">${esc(t.topic_title)}</div>
          ${examChips}
        </div>
        <div class="topic-meta">${t.last_studied_at?`Last studied: ${dateTime(t.last_studied_at)}`:'Not studied yet'}</div>
      </div>
      <div><span class="topic-status ${esc(t.status)}">${esc(statusLabel(t.status))}</span></div>
      <div class="topic-meta">${hours(t.study_minutes)}<br>${num(t.questions_practised)} questions</div>
      <div>
        <div class="revision-line">
          <span class="rev-chip ${t.revision_1_at?'done':''}">R1 ${t.revision_1_at?'✓':'—'}</span>
          <span class="rev-chip ${t.revision_2_at?'done':''}">R2 ${t.revision_2_at?'✓':'—'}</span>
          <span class="rev-chip ${t.revision_3_at?'done':''}">R3 ${t.revision_3_at?'✓':'—'}</span>
          ${due?`<span class="rev-chip due">Revision Due</span>`:''}
        </div>
      </div>
      ${topicExams.length?`<div class="topic-exam-detail" data-topic-exam-detail></div>`:''}
    </div>`;
  }

  function renderChapter(c,examRows=[]){
    const total=c.topics.length;
    const completed=c.topics.filter(t=>t.status==='completed').length;
    const studied=c.topics.filter(t=>t.status!=='not_started'||num(t.study_minutes)>0||num(t.questions_practised)>0).length;
    const mins=c.topics.reduce((a,t)=>a+num(t.study_minutes),0);
    const revs=c.topics.reduce((a,t)=>a+(t.revision_1_at?1:0)+(t.revision_2_at?1:0)+(t.revision_3_at?1:0),0);
    const progress=total?Math.round(completed*100/total):0;

    // Count only exams that are mapped to an actual topic/chapter in this unit.
    const chapterTopicIds=new Set(c.topics.map(t=>String(t.topic_id)));
    const mappedExams=orderedExams((examRows||[]).filter(e=>
      e.topic_id && chapterTopicIds.has(String(e.topic_id))
    ));

    return `<div class="chapter-card" data-unit="${esc(c.unit_id)}">
      <div class="chapter-head" role="button" tabindex="0">
        <div class="chapter-title">
          <small>UNIT ${esc(c.unit_no)}</small>
          <b>${esc(c.unit_title)}</b>
          <div class="chapter-progress"><i style="width:${progress}%"></i></div>
        </div>
        <div class="chapter-stats">
          <span><strong>${completed}/${total}</strong> completed</span>
          <span><strong>${studied}</strong> studied</span>
          <span><strong>${hours(mins)}</strong></span>
          <span><strong>${revs}</strong> revisions</span>
          <span><strong>${mappedExams.length}</strong> exams</span>
        </div>
      </div>
      <div class="chapter-body">
        ${mappedExams.length?`<div class="exam-hint">E1, E2, E3… are shown beside the exact chapter/topic for which the exam was created. Click once to open details; click the same E again to close.</div>`:'<div class="no-exam">No Exam Yet</div>'}
        ${c.topics.map(t=>renderTopicRow(t,examRows)).join('')}
      </div>
    </div>`;
  }

  async function loadSubjectDetail(subject){
    if(!selectedId)return;
    document.querySelectorAll('.subject-card').forEach(x=>x.classList.toggle('selected',x.dataset.subject===subject));
    const box=$('subjectDetail');
    if(!box)return;
    box.innerHTML='<div class="loading">Loading chapter-wise progress and exam coverage...</div>';

    const [r,examR]=await Promise.all([
      c.rpc('admin_get_student_subject_detail',{p_student_id:selectedId,p_subject:subject}),
      c.rpc('admin_get_student_subject_exams',{p_student_id:selectedId,p_subject:subject})
    ]);

    if(r.error){box.innerHTML=`<div class="subject-empty">${esc(r.error.message)}</div>`;return}
    const rows=r.data||[];
    const examRows=examR.error?[]:(examR.data||[]); currentSubjectExams=examRows;
    const chapters=groupSubjectRows(rows);

    const totalTopics=rows.length;
    const completed=rows.filter(t=>t.status==='completed').length;
    const studiedTopics=rows.filter(t=>t.status!=='not_started'||num(t.study_minutes)>0||num(t.questions_practised)>0).length;
    const studiedChapters=chapters.filter(ch=>ch.topics.some(t=>t.status!=='not_started'||num(t.study_minutes)>0||num(t.questions_practised)>0)).length;
    const totalMinutes=rows.reduce((a,t)=>a+num(t.study_minutes),0);
    const due=rows.filter(t=>t.next_revision_at&&new Date(t.next_revision_at).getTime()<=Date.now()).length;

    const allExams=uniqExams(examRows);
    const attemptedExams=allExams.filter(e=>e.attempt_id);
    const unmatched=uniqExams(examRows.filter(e=>!e.unit_id));
    const mappedExamRows=examRows.filter(e=>e.unit_id);

    const unmappedBlock=unmatched.length
      ? `<div class="unmapped-exams"><b>Other ${esc(subject)} Exams</b><span>${unmatched.map(e=>`${esc(e.title)} (${esc(e.syllabus||'scope not mapped')})`).join(' · ')}</span></div>`
      : '';

    box.innerHTML=`<div class="subject-detail-head"><div><h3>${esc(subject)} — Chapter-wise Progress</h3><p>Click any chapter to see what was studied, revised and tested.</p></div></div>
      <div class="subject-mini-summary">
        <div><span>Chapters Started</span><strong>${studiedChapters} / ${chapters.length}</strong></div>
        <div><span>Topics Studied</span><strong>${studiedTopics} / ${totalTopics}</strong></div>
        <div><span>Topics Completed</span><strong>${completed}</strong></div>
        <div><span>Study Time</span><strong>${hours(totalMinutes)}</strong></div>
        <div><span>Revision Due</span><strong>${due}</strong></div>
        <div><span>Exams Set</span><strong>${allExams.length}</strong></div>
        <div><span>Exams Attempted</span><strong>${attemptedExams.length}</strong></div>
      </div>
      ${unmappedBlock}
      <div class="chapter-list">${chapters.map(c=>renderChapter(c,mappedExamRows)).join('')}</div>`;

    const firstActive=chapters.find(ch=>
      ch.topics.some(t=>t.status!=='not_started'||num(t.study_minutes)>0||num(t.questions_practised)>0) ||
      mappedExamRows.some(e=>String(e.unit_id||'')===String(ch.unit_id||''))
    );
    if(firstActive){
      const el=box.querySelector(`.chapter-card[data-unit="${CSS.escape(String(firstActive.unit_id))}"]`);
      if(el)el.classList.add('open');
    }
  }

  async function openStudent(id){
    selectedId=id;renderList();$('detail').innerHTML='<div class="card loading">Loading performance details...</div>';
    const r=await c.rpc('admin_get_student_monitoring',{p_student_id:id});
    if(r.error){$('detail').innerHTML=`<div class="card empty">${esc(r.error.message)}</div>`;return}
    renderDetail(r.data||{});
  }

  function renderDetail(d){
    const p=d.profile||{},s=d.summary||{},subjects=d.subjects||[],logs=d.recent_study||[],dues=d.revision_due_topics||[],completed=d.recent_completed||[],exams=d.exams||[],attendance=d.attendance||[];
    const remaining=Math.max(0,num(s.total_topics)-num(s.completed_topics));
    const activeStudent=students.find(x=>x.student_uuid===p.id);
    const recentLabel=activeStudent?.last_study_date?`Last study: ${date(activeStudent.last_study_date)}`:'No study log yet';
    const statusClass=activeStudent?.last_study_date?'good':'attention';
    const attendPresent=attendance.filter(x=>x.status==='present').length;

    $('detail').innerHTML=`
      <section class="card">
        <div class="detail-head">
          <div class="student-title"><img class="avatar" src="${esc(p.photo_url||'assets/favicon.png')}" onerror="this.src='assets/favicon.png'"><div><h2>${esc(p.full_name||'Student')}</h2><p>${esc(p.student_id||'')} · ${esc(p.batch||'')} ${p.current_class?'· '+esc(p.current_class):''}</p></div></div>
          <span class="status-chip ${statusClass}">${esc(recentLabel)}</span>
        </div>
        <div class="summary">
          ${summaryCard('Syllabus Completed',`${num(s.completed_topics)} / ${num(s.total_topics)}`)}
          ${summaryCard('Remaining Topics',remaining)}
          ${summaryCard('Overall Progress',pct(s.syllabus_completion))}
          ${summaryCard('Study Time',hours(s.total_study_minutes))}
          ${summaryCard('Revision Due',num(s.revision_due))}
          ${summaryCard('Rev-1 Done',num(s.revision1_done))}
          ${summaryCard('Rev-2 Done',num(s.revision2_done))}
          ${summaryCard('Rev-3 Done',num(s.revision3_done))}
          ${summaryCard('Questions',num(s.total_questions_practised))}
          ${summaryCard('Exam Average',pct(s.exam_average))}
        </div>
      </section>

      <section class="card section">
        <div class="section-head"><h3>Subject Progress</h3><span class="muted">Click a subject to see chapter-wise study, revision and E1/E2/E3 exam history</span></div>
        <div class="subject-grid">${subjects.length?subjects.map(subjectCard).join(''):'<div class="empty">No subject progress yet.</div>'}</div>
        <div id="subjectDetail" class="subject-detail"><div class="subject-empty">Select Physics, Chemistry or Biology to view chapter-wise preparation.</div></div>
      </section>

      <div class="two-col section">
        <section class="card"><div class="section-head"><h3>Revision Due</h3><span class="muted">${dues.length} shown</span></div><div class="revision-list">${dues.length?dues.map(x=>`<div class="row-card"><b>${esc(x.topic_title)}</b><small>${esc(x.subject)} · ${esc(x.unit_title)}</small><small class="due">Due: ${dateTime(x.next_revision_at)} · R1 ${x.revision1_done?'✓':'—'} · R2 ${x.revision2_done?'✓':'—'} · R3 ${x.revision3_done?'✓':'—'}</small></div>`).join(''):'<div class="empty">No revision due now.</div>'}</div></section>
        <section class="card"><div class="section-head"><h3>Recently Completed</h3><span class="muted">Latest topics</span></div><div class="completed-list">${completed.length?completed.map(x=>`<div class="row-card"><b>${esc(x.topic_title)}</b><small>${esc(x.subject)} · ${esc(x.unit_title)}</small><small>${dateTime(x.completed_at)} · ${hours(x.study_minutes)} · ${num(x.questions_practised)} questions</small></div>`).join(''):'<div class="empty">No completed topics yet.</div>'}</div></section>
      </div>

      <section class="card section">
        <div class="section-head"><h3>Recent Study Log</h3><span class="muted">Student-entered learning / revision / practice</span></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Subject</th><th>Unit / Chapter</th><th>Topic</th><th>Activity</th><th>Time</th><th>Questions</th></tr></thead><tbody>${logs.length?logs.map(x=>`<tr><td>${date(x.session_date)}</td><td>${esc(x.subject)}</td><td>${esc(x.chapter)}</td><td>${esc(x.topic)}</td><td><span class="activity">${esc(x.activity_type)}</span></td><td>${hours(x.minutes)}</td><td>${num(x.questions_attempted)}${num(x.correct_answers)?` / ${num(x.correct_answers)} correct`:''}</td></tr>`).join(''):'<tr><td colspan="7">No study log yet.</td></tr>'}</tbody></table></div>
      </section>

      <div class="two-col section">
        <section class="card"><div class="section-head"><h3>Exam Performance</h3><span class="muted">Recent attempts</span></div><div class="table-wrap"><table><thead><tr><th>Exam</th><th>Status</th><th>Score</th><th>%</th></tr></thead><tbody>${exams.length?exams.map(x=>`<tr><td><b>${esc(x.title)}</b><br><small>${esc(x.subject||'')}</small></td><td>${esc(x.status)}</td><td>${x.total_score==null?'—':esc(x.total_score)}</td><td>${x.percentage==null?'—':pct(x.percentage)}</td></tr>`).join(''):'<tr><td colspan="4">No exam attempts yet.</td></tr>'}</tbody></table></div></section>
        <section class="card"><div class="section-head"><h3>Attendance</h3><span class="muted">Recent ${attendance.length} records · Present ${attendPresent}</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Marked</th></tr></thead><tbody>${attendance.length?attendance.map(x=>`<tr><td>${date(x.attendance_date)}</td><td>${esc(x.status)}</td><td>${dateTime(x.marked_at)}</td></tr>`).join(''):'<tr><td colspan="3">No attendance records yet.</td></tr>'}</tbody></table></div></section>
      </div>`;
  }

  $('detail').onclick=e=>{
    const topicExamChip=e.target.closest('[data-topic-exam-chip]');
    if(topicExamChip){
      e.preventDefault();
      e.stopPropagation();

      const row=topicExamChip.closest('.topic-row');
      const detailBox=row?.querySelector('[data-topic-exam-detail]');
      const examId=String(topicExamChip.dataset.topicExamChip||'');
      const exam=orderedExams(currentSubjectExams).find(x=>String(x.exam_id)===examId);

      if(!detailBox||!exam)return;

      // Same E-chip clicked again -> close details.
      if(detailBox.classList.contains('open') && detailBox.dataset.openExamId===examId){
        detailBox.classList.remove('open');
        detailBox.innerHTML='';
        detailBox.dataset.openExamId='';
        return;
      }

      // Open/replace with selected exam details.
      detailBox.innerHTML=renderExamDetail(exam);
      detailBox.dataset.openExamId=examId;
      detailBox.classList.add('open');
      return;
    }

    const subject=e.target.closest('[data-subject]');
    if(subject){loadSubjectDetail(subject.dataset.subject);return}

    const chapter=e.target.closest('.chapter-head');
    if(chapter){chapter.closest('.chapter-card')?.classList.toggle('open')}
  };
  $('studentList').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openStudent(b.dataset.id)};
  $('search').oninput=renderList;
  $('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
  try{await loadStudents()}catch(err){$('studentList').innerHTML=`<div class="empty">${esc(err?.message||'Unable to load students.')}</div>`}
})();
