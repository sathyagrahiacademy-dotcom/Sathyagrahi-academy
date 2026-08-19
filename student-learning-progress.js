(()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
let profile=null,rows=[],active=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
const num=v=>Number(v||0);
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
const dateOnly=v=>v?new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';

async function auth(){
  const{data:{session}}=await c.auth.getSession();
  if(!session){location.replace('index.html#student-portal');return null}
  const r=await c.from('profiles')
    .select('id,full_name,student_id,role,is_active')
    .eq('id',session.user.id)
    .single();

  if(r.error||r.data?.role!=='student'||!r.data?.is_active){
    location.replace('index.html#student-portal');
    return null;
  }
  return r.data;
}

function statusLabel(v){
  return ({
    not_started:'NOT STARTED',
    studying:'LEARNING',
    practice:'PRACTICE',
    completed:'COMPLETED'
  }[v]||String(v||'').toUpperCase());
}

function revisionCount(x){
  return (x.revision_1_at?1:0)+(x.revision_2_at?1:0)+(x.revision_3_at?1:0);
}

function revisionHtml(x){
  const count=revisionCount(x);
  const due=x.next_revision_at && new Date(x.next_revision_at).getTime()<=Date.now();

  let reminder='';
  if(x.revision_3_at){
    reminder='<div class="rev-reminder complete">Revision cycle completed</div>';
  }else if(due){
    reminder='<div class="rev-reminder due">Revision Due Now</div>';
  }else if(x.next_revision_at){
    reminder=`<div class="rev-reminder">Next Revision: ${dateOnly(x.next_revision_at)}</div>`;
  }else if(x.status==='completed'){
    reminder='<div class="rev-reminder">Revision schedule will appear here.</div>';
  }else{
    reminder='<div class="rev-reminder">Complete the topic to begin revisions.</div>';
  }

  return `<div class="revision-box">
    <div class="revision-line">
      <span class="rev-chip ${x.revision_1_at?'done':''}">R1 ${x.revision_1_at?'✓':'—'}</span>
      <span class="rev-chip ${x.revision_2_at?'done':''}">R2 ${x.revision_2_at?'✓':'—'}</span>
      <span class="rev-chip ${x.revision_3_at?'done':''}">R3 ${x.revision_3_at?'✓':'—'}</span>
      ${due&&!x.revision_3_at?'<span class="rev-chip due">DUE</span>':''}
    </div>
    ${reminder}
  </div>`;
}

function renderSubjectCards(){
  const names=['Physics','Chemistry','Biology'];
  $('subjectCards').innerHTML=names.map(name=>{
    const all=rows.filter(x=>x.subject===name);
    const done=all.filter(x=>x.status==='completed').length;
    const due=all.filter(x=>x.next_revision_at && new Date(x.next_revision_at).getTime()<=Date.now() && !x.revision_3_at).length;
    const p=all.length?done/all.length*100:0;
    const cls=$('subject').value===name?' active':'';

    return `<div class="lp-subject${cls}" data-subject="${name}">
      <div class="lp-subject-top"><b>${name}</b><strong>${p.toFixed(1)}%</strong></div>
      <div class="lp-subject-bar"><i style="width:${Math.min(100,p)}%"></i></div>
      <small>${done} of ${all.length} completed · ${due} revision due</small>
    </div>`;
  }).join('');
}

function fillUnits(){
  const subject=$('subject').value;
  const current=$('unit').value;
  const units=[...new Map(
    rows.filter(x=>x.subject===subject)
      .map(x=>[x.unit_no,x.unit_title])
  ).entries()];

  $('unit').innerHTML='<option value="all">All Units</option>'+
    units.map(([n,t])=>`<option value="${n}">Unit ${n} — ${esc(t)}</option>`).join('');

  if([...$('unit').options].some(o=>o.value===current))$('unit').value=current;
}

function render(){
  const subject=$('subject').value;
  const unit=$('unit').value;
  const status=$('statusFilter').value;
  const search=$('search').value.toLowerCase().trim();

  const allSubjectRows=rows.filter(x=>x.subject===subject);

  const filtered=allSubjectRows.filter(x=>
    (unit==='all'||String(x.unit_no)===unit) &&
    (status==='all'||x.status===status) &&
    (!search||(x.topic_title+' '+(x.official_detail||'')).toLowerCase().includes(search))
  );

  const totalDone=rows.filter(x=>x.status==='completed').length;
  const totalDue=rows.filter(x=>
    x.next_revision_at &&
    new Date(x.next_revision_at).getTime()<=Date.now() &&
    !x.revision_3_at
  ).length;

  $('overall').textContent=rows.length?Math.round(totalDone/rows.length*100)+'%':'0%';
  $('done').textContent=totalDone;
  $('studying').textContent=rows.filter(x=>x.status==='studying').length;
  $('revision').textContent=totalDue;

  const groups={};
  filtered.forEach(x=>(groups[x.unit_no]??=[]).push(x));

  $('units').innerHTML=Object.keys(groups).length
    ? Object.entries(groups).map(([unitNo,items])=>{
        const fullUnit=allSubjectRows.filter(x=>String(x.unit_no)===String(unitNo));
        const completed=fullUnit.filter(x=>x.status==='completed').length;
        const totalRevisions=fullUnit.reduce((sum,x)=>sum+revisionCount(x),0);
        const due=fullUnit.filter(x=>
          x.next_revision_at &&
          new Date(x.next_revision_at).getTime()<=Date.now() &&
          !x.revision_3_at
        ).length;
        const progress=fullUnit.length?Math.round(completed/fullUnit.length*100):0;

        return `<article class="unit-card">
          <div class="unit-head">
            <div class="unit-head-main">
              <span>UNIT ${esc(unitNo)}</span>
              <h3>${esc(items[0].unit_title)}</h3>
              <div class="unit-progress">
                <b>${progress}%</b>
                <i><em style="width:${progress}%"></em></i>
              </div>
            </div>
            <div class="unit-head-stats">
              <span><strong>${completed}/${fullUnit.length}</strong> completed</span>
              <span><strong>${totalRevisions}</strong> revisions</span>
              <span><strong>${due}</strong> due</span>
              <span class="unit-arrow">⌄</span>
            </div>
          </div>

          <div class="topics">
            ${items.map(x=>`
              <div class="topic-row">
                <div class="topic-title">
                  <strong>${esc(x.topic_title)}</strong>
                  <small>${esc(x.official_detail||'')}</small>
                </div>

                <span class="status ${x.status}">${statusLabel(x.status)}</span>

                ${revisionHtml(x)}

                <div class="topic-actions">
                  <button type="button" data-detail="${x.topic_id}">DETAILS</button>
                  <button type="button" class="primary" data-update="${x.topic_id}">UPDATE</button>
                </div>
              </div>
            `).join('')}
          </div>
        </article>`;
      }).join('')
    : '<div class="empty-state">No topics match this filter.</div>';
}

function openModal(id){
  active=rows.find(x=>String(x.topic_id)===String(id));
  if(!active)return;

  $('modalTopic').innerHTML=
    `<strong>${esc(active.topic_title)}</strong><br>`+
    `<small>${esc(active.subject)} · Unit ${active.unit_no} · ${esc(active.unit_title)}</small>`;

  $('mStatus').value=active.status==='not_started'?'studying':active.status;
  $('mMinutes').value=0;
  $('mQuestions').value=0;
  $('mRevision').checked=false;
  $('modal').classList.add('open');
}

$('subjectCards').onclick=e=>{
  const card=e.target.closest('[data-subject]');
  if(!card)return;

  $('subject').value=card.dataset.subject;
  $('unit').value='all';
  fillUnits();
  renderSubjectCards();
  render();
};

$('units').onclick=e=>{
  const head=e.target.closest('.unit-head');
  if(head){
    const card=head.closest('.unit-card');
    document.querySelectorAll('.unit-card.open').forEach(x=>{
      if(x!==card)x.classList.remove('open');
    });
    card.classList.toggle('open');
    return;
  }

  const update=e.target.closest('[data-update]');
  if(update){
    openModal(update.dataset.update);
    return;
  }

  const detail=e.target.closest('[data-detail]');
  if(detail){
    const x=rows.find(r=>String(r.topic_id)===String(detail.dataset.detail));
    if(!x)return;

    const revs=revisionCount(x);
    const due=x.next_revision_at &&
      new Date(x.next_revision_at).getTime()<=Date.now() &&
      !x.revision_3_at;

    alert(
      `${x.topic_title}\n\n`+
      `${x.official_detail||'No additional detail.'}\n\n`+
      `Status: ${statusLabel(x.status)}\n`+
      `Study: ${num(x.study_minutes)} min\n`+
      `Questions: ${num(x.questions_practised)}\n`+
      `Revisions Done: ${revs}/3\n`+
      `R1: ${x.revision_1_at?'Done':'Pending'}\n`+
      `R2: ${x.revision_2_at?'Done':'Pending'}\n`+
      `R3: ${x.revision_3_at?'Done':'Pending'}\n`+
      (x.revision_3_at
        ? `Revision: Cycle Completed`
        : due
          ? `Revision: DUE NOW`
          : x.next_revision_at
            ? `Next Revision: ${dateOnly(x.next_revision_at)}`
            : `Next Revision: —`)
    );
  }
};

$('form').onsubmit=async e=>{
  e.preventDefault();
  if(!active)return;

  const r=await c.rpc('update_my_learning_progress',{
    p_topic_id:active.topic_id,
    p_status:$('mStatus').value,
    p_add_study_minutes:Number($('mMinutes').value||0),
    p_add_questions:Number($('mQuestions').value||0),
    p_mark_revision:$('mRevision').checked,
    p_test_score:null
  });

  if(r.error){
    toast(r.error.message);
    return;
  }

  $('modal').classList.remove('open');
  toast('Progress saved');
  await load();
};

$('unit').onchange=render;
$('statusFilter').onchange=render;
$('search').oninput=render;

['close','cancel'].forEach(id=>{
  $(id).onclick=()=>$('modal').classList.remove('open');
});

$('logoutBtn').onclick=async()=>{
  await c.auth.signOut();
  location.replace('index.html#student-portal');
};

$('menuBtn').onclick=()=>{
  document.getElementById('sidebar').classList.toggle('open');
};

async function load(){
  const r=await c.from('student_learning_progress')
    .select('*')
    .eq('student_id',profile.id)
    .order('unit_no')
    .order('sort_order');

  if(r.error){
    toast(r.error.message);
    return;
  }

  rows=r.data||[];
  fillUnits();
  renderSubjectCards();
  render();
}

(async()=>{
  profile=await auth();
  if(!profile)return;

  $('studentName').textContent=profile.full_name;
  $('studentCode').textContent='ID: '+profile.student_id;
  await load();
})();
})();