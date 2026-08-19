
(async function(){
  const c=window.sgaSupabase;
  const status=document.getElementById('syllabusStatus');
  const list=document.getElementById('syllabusList');
  const search=document.getElementById('syllabusSearch');
  const unitCount=document.getElementById('unitCount');
  const topicCount=document.getElementById('topicCount');
  const subjectView=document.getElementById('subjectView');

  let units=[],topics=[],subject='All',forceExpand=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const subjectClass=s=>String(s||'').toLowerCase();

  function highlight(text,q){
    const safe=esc(text);
    if(!q)return safe;
    const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return safe.replace(new RegExp(`(${escaped})`,'ig'),'<mark>$1</mark>');
  }

  
  function renderVisualMap(){
    const targets={
      Physics:document.getElementById('physicsMap'),
      Chemistry:document.getElementById('chemistryMap'),
      Biology:document.getElementById('biologyMap')
    };

    Object.entries(targets).forEach(([sub,target])=>{
      if(!target)return;
      const rows=units
        .filter(u=>u.subject===sub)
        .sort((a,b)=>(a.unit_no||0)-(b.unit_no||0));

      target.innerHTML=rows.map(u=>`
        <div class="map-unit">
          <span>${String(u.unit_no).padStart(2,'0')}</span>
          <b>${esc(u.unit_title)}</b>
        </div>
      `).join('') || '<span class="map-loading">No units available.</span>';
    });
  }

function render(){
    const q=(search.value||'').trim().toLowerCase();
    const filteredUnits=units.filter(u=>subject==='All'||u.subject===subject);
    let visibleUnits=0,visibleTopics=0,html='';

    filteredUnits.forEach(u=>{
      const allTopics=topics.filter(t=>t.unit_id===u.id);
      const unitMatches=!q||`${u.unit_title}`.toLowerCase().includes(q);
      const matchedTopics=allTopics.filter(t=>!q||`${t.topic_title} ${t.official_detail||''}`.toLowerCase().includes(q));
      if(q && !unitMatches && !matchedTopics.length)return;

      const shownTopics=q ? (unitMatches ? allTopics : matchedTopics) : allTopics;
      visibleUnits++;
      visibleTopics+=shownTopics.length;

      html+=`<section class="unit ${subjectClass(u.subject)} ${(q||forceExpand)?'open':''}">
        <button class="unit-head" type="button">
          <span class="unit-code">${esc(u.subject.slice(0,1))}${String(u.unit_no).padStart(2,'0')}</span>
          <span class="unit-title"><b>${highlight(u.unit_title,q)}</b><small>${esc(u.subject)} · Unit ${esc(u.unit_no)}</small></span>
          <span class="unit-count">${shownTopics.length} topics</span>
          <span class="unit-toggle">+</span>
        </button>
        <div class="unit-body">
          ${shownTopics.map((t,i)=>`<article class="topic"><b>${String(i+1).padStart(2,'0')} · ${highlight(t.topic_title,q)}</b>${t.official_detail?`<p>${highlight(t.official_detail,q)}</p>`:''}</article>`).join('')}
        </div>
      </section>`;
    });

    list.innerHTML=html||'<div class="empty-state">No matching official syllabus topic found. Try a broader word or switch to ALL subjects.</div>';
    unitCount.textContent=visibleUnits;
    topicCount.textContent=visibleTopics;
    subjectView.textContent=subject.toUpperCase();

    list.querySelectorAll('.unit-head').forEach(btn=>{
      btn.addEventListener('click',()=>btn.closest('.unit').classList.toggle('open'));
    });
  }

  function setSubject(next){
    subject=next;
    forceExpand=false;
    document.querySelectorAll('[data-subject]').forEach(b=>b.classList.toggle('active',b.dataset.subject===next));
    document.getElementById('explorer')?.scrollIntoView({behavior:'smooth',block:'start'});
    render();
  }

  document.querySelectorAll('[data-subject]').forEach(b=>b.addEventListener('click',()=>setSubject(b.dataset.subject)));
  document.querySelectorAll('[data-subject-jump]').forEach(b=>b.addEventListener('click',()=>setSubject(b.dataset.subjectJump)));
  search.addEventListener('input',()=>{forceExpand=false;render()});
  document.getElementById('expandAll').addEventListener('click',()=>{forceExpand=true;render()});
  document.getElementById('collapseAll').addEventListener('click',()=>{
    forceExpand=false;
    render();
    list.querySelectorAll('.unit').forEach(x=>x.classList.remove('open'));
  });

  try{
    if(!c)throw new Error('Supabase connection not available');
    const [u,t]=await Promise.all([
      c.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('sort_order'),
      c.from('neet_syllabus_topics').select('id,unit_id,topic_title,official_detail,sort_order,is_experimental').order('sort_order')
    ]);
    if(u.error)throw u.error;
    if(t.error)throw t.error;
    units=u.data||[];
    topics=t.data||[];
    status.textContent=`Official syllabus loaded successfully: ${units.length} units and ${topics.length} topic entries.`;
    status.classList.add('good');
    renderVisualMap();
    render();
  }catch(e){
    status.textContent='Official syllabus could not be loaded. Please refresh once. '+(e?.message||'');
    status.classList.add('warning');
    list.innerHTML='<div class="empty-state">The live syllabus explorer needs the Academy Supabase connection. Existing visual guides below can still be viewed.</div>';
  }
})();
