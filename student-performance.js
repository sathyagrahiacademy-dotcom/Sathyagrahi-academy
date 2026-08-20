(()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const num=v=>Number(v||0);
const fmt=v=>v?new Date(v).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
let studentId=null,subjectCache={},syllabusCache={},taskScopeCache={};

const uniqExams=list=>[...new Map((list||[]).map(x=>[x.exam_id,x])).values()];
const orderedExams=list=>uniqExams(list).sort((a,b)=>{
  const av=new Date(a.exam_created_at||a.scheduled_start||0).getTime()||0;
  const bv=new Date(b.exam_created_at||b.scheduled_start||0).getTime()||0;
  return av-bv || String(a.title||'').localeCompare(String(b.title||''));
});

function examState(e){
  if(e.attempt_id){
    if(e.result_is_published&&e.percentage!=null)return{label:'Attempted',cls:'attempted'};
    if(['submitted','auto_submitted','graded'].includes(String(e.attempt_status||'')))return{label:'Submitted',cls:'pending'};
    return{label:'In Progress',cls:'pending'};
  }
  return{label:'Not Attempted',cls:''};
}
function chipClass(e){
  const s=examState(e);
  if(s.cls==='attempted')return'done';
  if(s.cls==='pending')return'pending';
  return'';
}

function renderExamDetail(e){
  const st=examState(e);
  const resultState=e.result_is_published?'Published':(e.attempt_id?'Pending':'Not Attempted');
  const score=e.result_is_published&&e.total_score!=null
    ? `${num(e.total_score).toFixed(0)} / ${num(e.total_marks).toFixed(0)}`
    : '—';

  return `<div class="exam-detail-head">
    <div><b>${esc(e.title||'Exam')}</b><small>${esc(e.syllabus||e.subject||'')}</small></div>
    <span class="${st.cls}">${esc(st.label)}</span>
  </div>
  <div class="exam-detail-grid">
    <div><small>EXAM CODE</small><strong>${esc(e.exam_code||'—')}</strong></div>
    <div><small>RESULT</small><strong>${esc(resultState)}</strong></div>
    <div><small>SCORE</small><strong>${esc(score)}</strong></div>
    <div><small>PERCENTAGE</small><strong>${e.result_is_published&&e.percentage!=null?num(e.percentage).toFixed(1)+'%':'—'}</strong></div>
    <div><small>CORRECT</small><strong>${e.result_is_published?num(e.correct_count):'—'}</strong></div>
    <div><small>WRONG</small><strong>${e.result_is_published?num(e.wrong_count):'—'}</strong></div>
    <div><small>UNATTEMPTED</small><strong>${e.result_is_published?num(e.unattempted_count):'—'}</strong></div>
    <div><small>SUBMITTED</small><strong>${e.submitted_at?fmt(e.submitted_at):'—'}</strong></div>
  </div>`;
}

async function loadSyllabus(subject){
  if(syllabusCache[subject])return syllabusCache[subject];

  const {data:units,error:ue}=await c
    .from('neet_syllabus_units')
    .select('id,subject,unit_no,unit_title,sort_order')
    .eq('subject',subject)
    .order('sort_order');

  if(ue)throw ue;

  const unitIds=(units||[]).map(x=>x.id);
  let topics=[];
  if(unitIds.length){
    const {data,error}=await c
      .from('neet_syllabus_topics')
      .select('id,unit_id,topic_title,sort_order')
      .in('unit_id',unitIds)
      .order('sort_order');
    if(error)throw error;
    topics=data||[];
  }

  const result=(units||[]).map(u=>({
    ...u,
    topics:topics.filter(t=>String(t.unit_id)===String(u.id))
  }));
  syllabusCache[subject]=result;
  return result;
}

function topicExams(examRows,topicId){
  return orderedExams((examRows||[]).filter(e=>String(e.topic_id||'')===String(topicId||'')));
}

function renderTopic(topic,examRows,taskRows){
  const exams=topicExams(examRows,topic.id);
  const tasks=topicTaskExams(taskRows,topic.id);
  const attempted=exams.filter(e=>e.attempt_id).length;

  return `<div class="topic-exam-row" data-topic="${esc(topic.id)}">
    <div class="topic-exam-name">
      <b>${esc(topic.topic_title)}</b>
      <small>${tasks.length?`${tasks.length} assigned topic exam${tasks.length===1?'':'s'}${exams.length?` · ${attempted} attempted`:''}`:(exams.length?`${exams.length} exam${exams.length===1?'':'s'} · ${attempted} attempted`:'No exam created for this topic yet')}</small>
    </div>
    <div class="topic-exam-actions">
      ${tasks.length
        ? tasks.map((t,i)=>`<span class="exam-chip ${String(t.status||'')==='completed'?'done':'pending'}" title="${esc(t.topic||'Topic Exam')}">E${i+1}</span>`).join('')
        : (exams.length
            ? exams.map((e,i)=>`<button type="button" class="exam-chip ${chipClass(e)}" data-exam-id="${esc(e.exam_id)}" title="${esc(e.title||'Exam')}">E${i+1}</button>`).join('')
            : '<span class="no-exam-badge">No Exam Yet</span>')}
    </div>
    ${exams.length?'<div class="topic-exam-detail" data-exam-detail></div>':''}
  </div>`;
}


function taskScopeKey(row){
  return `${row.scope_type||''}:${row.unit_id||''}:${row.topic_id||''}`;
}
async function loadExamTaskScopes(subject){
  if(taskScopeCache[subject])return taskScopeCache[subject];
  const {data,error}=await c
    .from('preparation_tasks')
    .select('id,subject,chapter,topic,topic_id,unit_id,scope_type,task_type,target_date,created_at,status')
    .eq('student_id',studentId)
    .eq('subject',subject)
    .eq('task_type','exam')
    .order('created_at',{ascending:true});
  if(error)throw error;
  taskScopeCache[subject]=data||[];
  return taskScopeCache[subject];
}
function chapterTaskExams(tasks,unitId){
  return (tasks||[]).filter(x=>x.scope_type==='chapter'&&String(x.unit_id||'')===String(unitId||''));
}
function topicTaskExams(tasks,topicId){
  return (tasks||[]).filter(x=>x.scope_type==='topic'&&String(x.topic_id||'')===String(topicId||''));
}

function renderUnit(unit,examRows,taskRows){
  const chapterTasks=chapterTaskExams(taskRows,unit.id);
  const allTopicExams=unit.topics.flatMap(t=>topicExams(examRows,t.id));
  const testedTopics=unit.topics.filter(t=>topicTaskExams(taskRows,t.id).length>0||topicExams(examRows,t.id).length>0).length;
  const remaining=Math.max(0,unit.topics.length-testedTopics);
  const totalExams=chapterTasks.length + unit.topics.reduce((s,t)=>s+topicTaskExams(taskRows,t.id).length,0);

  return `<section class="unit-exam-card">
    <div class="unit-exam-head" role="button" tabindex="0">
      <div class="unit-exam-title">
        <small>UNIT ${esc(unit.unit_no)}</small>
        <b>${esc(unit.unit_title)}</b>
        <div class="unit-compact-note">Click to view topics and exam status</div>
        ${chapterTasks.length?`<div class="exam-chip-row" style="margin-top:8px">${chapterTasks.map((t,i)=>`<span class="exam-chip ${String(t.status||'')==='completed'?'done':'pending'}" title="Full Chapter Exam">E${i+1}</span>`).join('')}</div>`:''}
      </div>
      <div class="unit-exam-meta">
        <span><strong>${testedTopics}/${unit.topics.length}</strong> tested</span>
        <span><strong>${remaining}</strong> remaining</span>
        <span><strong>${totalExams}</strong> exams</span>
        <span class="unit-arrow">⌄</span>
      </div>
    </div>
    <div class="topic-exam-list">
      ${unit.topics.length?unit.topics.map(t=>renderTopic(t,examRows,taskRows)).join(''):'<div class="exam-empty">No topics found.</div>'}
    </div>
  </section>`;
}

async function loadSubject(subject){
  document.querySelectorAll('.subperf').forEach(x=>x.classList.toggle('active',x.dataset.subject===subject));
  const box=$('examDrill');
  box.innerHTML='<div class="exam-empty">Loading complete chapter exam coverage...</div>';

  try{
    let examRows=subjectCache[subject];
    if(!examRows){
      const r=await c.rpc('get_my_subject_exam_coverage',{p_subject:subject});
      if(r.error)throw r.error;
      examRows=r.data||[];
      subjectCache[subject]=examRows;
    }

    const units=await loadSyllabus(subject);
    const taskRows=await loadExamTaskScopes(subject);
    const allTopics=units.flatMap(u=>u.topics);
    const testedTopics=allTopics.filter(t=>topicTaskExams(taskRows,t.id).length>0||topicExams(examRows,t.id).length>0);
    const totalExams=taskRows.length || uniqExams(examRows.filter(e=>e.topic_id)).length;
    const attemptedExams=uniqExams(examRows.filter(e=>e.topic_id&&e.attempt_id)).length;
    const remaining=allTopics.length-testedTopics.length;

    box.innerHTML=`<div class="exam-drill-head">
      <div>
        <h3>${esc(subject)} — Complete Chapter Exam Coverage</h3>
        <p>All official units are shown in compact form. Open a unit to view its chapters and E1/E2/E3 exams.</p>
      </div>
    </div>

    <div class="coverage-summary">
      <div><span>TOTAL CHAPTERS</span><strong>${allTopics.length}</strong></div>
      <div><span>CHAPTERS TESTED</span><strong>${testedTopics.length}</strong></div>
      <div><span>REMAINING</span><strong>${remaining}</strong></div>
      <div><span>TOTAL EXAMS</span><strong>${totalExams}</strong></div>
    </div>

    <div class="chapter-exam-list">
      ${units.map(u=>renderUnit(u,examRows,taskRows)).join('')}
    </div>`;
  }catch(err){
    box.innerHTML=`<div class="exam-empty">${esc(err.message||'Unable to load chapter exam coverage.')}</div>`;
  }
}

async function load(){
  const {data:{session}}=await c.auth.getSession();
  if(!session){location.replace('index.html#student-portal');return}
  studentId=session.user.id;

  const {data:p}=await c.from('profiles')
    .select('full_name,student_id,role,is_active')
    .eq('id',studentId)
    .single();

  if(!p||p.role!=='student'||!p.is_active){
    location.replace('index.html#student-portal');
    return;
  }

  $('studentName').textContent=p.full_name||'Student';
  $('studentCode').textContent='ID: '+(p.student_id||'—');
  $('greeting').textContent=(p.full_name||'Student')+' — Exam Performance';

  const {data:r,error}=await c.from('exam_results')
    .select('total_score,correct_count,wrong_count,unattempted_count,percentage,is_published,graded_at,exam_attempts!inner(student_id,status,submitted_at,exams!inner(title,subject,total_marks))')
    .eq('exam_attempts.student_id',studentId)
    .eq('is_published',true)
    .order('graded_at',{ascending:false});

  if(error){
    $('historyRows').innerHTML='<tr><td colspan="7" class="empty">Unable to load performance.</td></tr>';
    return;
  }

  const a=r||[];
  $('mExams').textContent=a.length;

  const avg=a.length?a.reduce((s,x)=>s+num(x.percentage),0)/a.length:0;
  const best=a.length?Math.max(...a.map(x=>num(x.percentage))):0;
  const correct=a.reduce((s,x)=>s+num(x.correct_count),0);
  const wrong=a.reduce((s,x)=>s+num(x.wrong_count),0);
  const acc=(correct+wrong)?correct/(correct+wrong)*100:0;

  $('mAverage').textContent=avg.toFixed(1)+'%';
  $('mBest').textContent=best.toFixed(1)+'%';
  $('mAccuracy').textContent=acc.toFixed(1)+'%';

  const subjects=['Physics','Chemistry','Biology'];
  $('subjectGrid').innerHTML=subjects.map(name=>{
    const z=a.filter(x=>(x.exam_attempts.exams.subject||'').toLowerCase()===name.toLowerCase());
    const av=z.length?z.reduce((s,x)=>s+num(x.percentage),0)/z.length:0;
    return `<div class="subperf" data-subject="${name}">
      <div class="row"><span>${name}</span><span>${av.toFixed(1)}%</span></div>
      <div class="bar"><i style="width:${Math.min(100,av)}%"></i></div>
      <div style="font-size:10px;color:#748197">${z.length} exam${z.length===1?'':'s'} completed</div>
      <span class="view-note">View complete chapter coverage →</span>
    </div>`;
  }).join('');

  $('historyRows').innerHTML=a.length?a.map(x=>{
    const e=x.exam_attempts.exams;
    return `<tr>
      <td><b>${esc(e.title)}</b></td>
      <td>${esc(e.subject)}</td>
      <td class="score">${num(x.total_score)} / ${num(e.total_marks)}</td>
      <td>${x.correct_count}</td>
      <td>${x.wrong_count}</td>
      <td>${x.unattempted_count}</td>
      <td><span class="trend">${num(x.percentage).toFixed(2)}%</span></td>
    </tr>`;
  }).join(''):'<tr><td colspan="7" class="empty">No published examination results yet.</td></tr>';
}

$('subjectGrid').onclick=e=>{
  const card=e.target.closest('[data-subject]');
  if(card)loadSubject(card.dataset.subject);
};

$('examDrill').onclick=e=>{
  const chip=e.target.closest('[data-exam-id]');
  if(chip){
    e.preventDefault();
    e.stopPropagation();

    const row=chip.closest('.topic-exam-row');
    const box=row?.querySelector('[data-exam-detail]');
    const subject=document.querySelector('.subperf.active')?.dataset.subject;
    const rows=subjectCache[subject]||[];
    const exam=orderedExams(rows).find(x=>String(x.exam_id)===String(chip.dataset.examId));

    if(!box||!exam)return;

    if(box.classList.contains('open')&&box.dataset.openExamId===String(exam.exam_id)){
      box.classList.remove('open');
      box.innerHTML='';
      box.dataset.openExamId='';
      return;
    }

    box.innerHTML=renderExamDetail(exam);
    box.dataset.openExamId=String(exam.exam_id);
    box.classList.add('open');
    return;
  }

  const unitHead=e.target.closest('.unit-exam-head');
  if(unitHead){
    const card=unitHead.closest('.unit-exam-card');
    if(!card)return;

    // Keep only one unit open at a time for easy scrolling.
    document.querySelectorAll('.unit-exam-card.open').forEach(x=>{
      if(x!==card)x.classList.remove('open');
    });

    card.classList.toggle('open');
  }
};

$('logoutBtn').onclick=async()=>{
  await c.auth.signOut();
  location.replace('index.html#student-portal');
};

$('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
document.querySelectorAll('[data-coming]').forEach(a=>a.onclick=e=>e.preventDefault());

load();
})();