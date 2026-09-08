(()=>{
  const c=window.sgaSupabase;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  let units=[];
  let topics=[];
  let subject='Physics';
  let forceExpand=false;

  async function auth(){
    const {data:{session}}=await c.auth.getSession();
    if(!session){location.replace('index.html#student-portal');return null;}

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

  function render(){
    const q=($('syllabusSearch').value||'').trim().toLowerCase();
    const subjectUnits=units.filter(u=>u.subject===subject);
    let visibleUnits=0;
    let visibleTopics=0;
    let html='';

    subjectUnits.forEach(u=>{
      const allTopics=topics.filter(t=>t.unit_id===u.id);
      const unitMatch=!q||`${u.unit_title}`.toLowerCase().includes(q);
      const matchingTopics=allTopics.filter(t=>!q||`${t.topic_title} ${t.official_detail||''}`.toLowerCase().includes(q));
      if(q&&!unitMatch&&!matchingTopics.length)return;

      const shownTopics=q?(unitMatch?allTopics:matchingTopics):allTopics;
      visibleUnits++;
      visibleTopics+=shownTopics.length;

      html+=`<article class="syllabus-unit ${(q||forceExpand)?'open':''}">
        <button class="syllabus-unit-head" type="button">
          <span class="syllabus-unit-code">UNIT ${esc(u.unit_no)}</span>
          <span><strong>${esc(u.unit_title)}</strong><small>${esc(subject)}</small></span>
          <span class="syllabus-unit-count">${shownTopics.length} topics</span>
        </button>
        <div class="syllabus-unit-body">
          ${shownTopics.map((t,i)=>`<div class="syllabus-topic"><b>${String(i+1).padStart(2,'0')} · ${esc(t.topic_title)}</b>${t.official_detail?`<p>${esc(t.official_detail)}</p>`:''}</div>`).join('')}
        </div>
      </article>`;
    });

    $('subjectTitle').textContent=`${subject} Syllabus`;
    $('unitMeta').textContent=`Units: ${visibleUnits}`;
    $('topicMeta').textContent=`Topics: ${visibleTopics}`;
    $('syllabusList').innerHTML=html||'<div class="syllabus-empty">No matching syllabus item found.</div>';

    document.querySelectorAll('.subject-card').forEach(btn=>btn.classList.toggle('active',btn.dataset.subject===subject));
    $('syllabusList').querySelectorAll('.syllabus-unit-head').forEach(btn=>{
      btn.onclick=()=>btn.closest('.syllabus-unit').classList.toggle('open');
    });
  }

  async function load(){
    const profile=await auth();
    if(!profile)return;

    $('studentName').textContent=profile.full_name||'Student';
    $('studentCode').textContent=profile.student_id||'—';

    const [u,t]=await Promise.all([
      c.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('sort_order'),
      c.from('neet_syllabus_topics').select('id,unit_id,topic_title,official_detail,sort_order,is_experimental').order('sort_order')
    ]);

    if(u.error||t.error){
      $('syllabusStatus').textContent='Syllabus could not be loaded. Please refresh once.';
      $('syllabusList').innerHTML='<div class="syllabus-empty">Unable to load the syllabus master.</div>';
      return;
    }

    units=u.data||[];
    topics=t.data||[];
    $('syllabusStatus').textContent='Official Academy syllabus master loaded.';
    render();
  }

  document.querySelectorAll('.subject-card').forEach(btn=>btn.onclick=()=>{
    subject=btn.dataset.subject;
    forceExpand=false;
    $('syllabusSearch').value='';
    render();
  });
  $('syllabusSearch').oninput=()=>{forceExpand=false;render();};
  $('expandAll').onclick=()=>{forceExpand=true;render();};
  $('collapseAll').onclick=()=>{
    forceExpand=false;
    render();
    $('syllabusList').querySelectorAll('.syllabus-unit').forEach(x=>x.classList.remove('open'));
  };
  $('menuBtn').onclick=()=>document.getElementById('sidebar')?.classList.toggle('open');
  $('logoutBtn').onclick=async()=>{await c.auth.signOut();location.replace('index.html#student-portal');};

  load();
})();
