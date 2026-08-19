(async()=>{
  const c=window.sgaSupabase,$=id=>document.getElementById(id);
  let students=[],tasks=[],units=[],topics=[];

  const {data:{session}}=await c.auth.getSession();
  if(!session)return location.replace('admin-login.html');
  const {data:admin}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();
  if(!admin||admin.role!=='admin'||!admin.is_active)return location.replace('admin-login.html');

  const todayIST=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  $('date').value=todayIST();

  function msg(text,ok=false){$('msg').textContent=text;$('msg').style.color=ok?'#237647':'#9a2f2f'}
  function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

  async function loadMaster(){
    const [u,t]=await Promise.all([
      c.from('neet_syllabus_units').select('id,subject,unit_no,unit_title,sort_order').order('sort_order'),
      c.from('neet_syllabus_topics').select('id,unit_id,topic_title,official_detail,sort_order').order('sort_order')
    ]);
    if(u.error)throw u.error;if(t.error)throw t.error;
    units=u.data||[];topics=t.data||[];
    renderUnits();
  }

  function renderUnits(){
    const subject=$('subject').value;
    const list=units.filter(x=>x.subject===subject);
    $('unit').innerHTML=list.map(x=>`<option value="${x.id}">Unit ${x.unit_no} — ${esc(x.unit_title)}</option>`).join('');
    renderTopics();
  }

  function renderTopics(){
    const unitId=Number($('unit').value||0);
    const list=topics.filter(x=>Number(x.unit_id)===unitId);
    $('topic').innerHTML=list.map(x=>`<option value="${x.id}">${esc(x.topic_title)}</option>`).join('');
    updatePreview();
  }

  function updatePreview(){
    const unit=units.find(x=>String(x.id)===$('unit').value);
    const topic=topics.find(x=>String(x.id)===$('topic').value);
    $('topicPreview').innerHTML=topic?`<b>Selected topic:</b> ${esc(unit?.unit_title||'')} → ${esc(topic.topic_title)}${topic.official_detail?`<div class="helper">${esc(topic.official_detail)}</div>`:''}`:'<b>Selected topic:</b> Choose a unit and topic.';
  }

  async function load(){
    const [s,t]=await Promise.all([
      c.from('profiles').select('id,student_id,full_name').eq('role','student').eq('is_active',true).order('full_name'),
      c.from('preparation_tasks').select('*').order('target_date',{ascending:false}).order('created_at',{ascending:false})
    ]);
    if(s.error)throw s.error;if(t.error)throw t.error;
    students=s.data||[];tasks=t.data||[];
    const currentStudent=$('student').value;
    $('student').innerHTML=students.map(x=>`<option value="${x.id}">${esc(x.student_id||'')} — ${esc(x.full_name||'Student')}</option>`).join('');
    if(currentStudent&&students.some(x=>x.id===currentStudent))$('student').value=currentStudent;
    const currentFilter=$('filterStudent').value||'all';
    $('filterStudent').innerHTML='<option value="all">All Students</option>'+students.map(x=>`<option value="${x.id}">${esc(x.full_name||'Student')}</option>`).join('');
    if(currentFilter==='all'||students.some(x=>x.id===currentFilter))$('filterStudent').value=currentFilter;
    render();
  }

  function render(){
    const f=$('filterStudent').value||'all';
    const a=f==='all'?tasks:tasks.filter(x=>x.student_id===f);
    const name=id=>students.find(s=>s.id===id)?.full_name||'Student';
    $('pending').textContent=tasks.filter(x=>x.status==='pending').length;
    $('completed').textContent=tasks.filter(x=>x.status==='completed').length;
    $('dueToday').textContent=tasks.filter(x=>x.status==='pending'&&x.target_date<=todayIST()).length;
    $('studentCount').textContent=students.length;
    $('rows').innerHTML=a.length?a.map(x=>`<tr><td>${esc(name(x.student_id))}</td><td>${esc(x.target_date||'')}</td><td>${esc(x.subject||'')}</td><td>${esc(x.task_type||'')}</td><td><b>${esc(x.topic||'')}</b><br><small>${esc(x.chapter||'')}</small></td><td>${esc(x.priority||'')}</td><td>${esc(x.status||'')}</td><td><button class="btn" data-del="${x.id}">DELETE</button></td></tr>`).join(''):'<tr><td colspan="8">No preparation tasks found.</td></tr>';
  }

  $('subject').onchange=renderUnits;
  $('unit').onchange=renderTopics;
  $('topic').onchange=updatePreview;
  $('filterStudent').onchange=render;

  $('taskForm').onsubmit=async e=>{
    e.preventDefault();
    const unit=units.find(x=>String(x.id)===$('unit').value);
    const topic=topics.find(x=>String(x.id)===$('topic').value);
    if(!unit||!topic)return msg('Please select an official Unit and Topic.');
    $('assignBtn').disabled=true;msg('Assigning task...');
    const payload={
      student_id:$('student').value,
      subject:unit.subject,
      chapter:unit.unit_title,
      topic:topic.topic_title,
      topic_id:topic.id,
      task_type:$('type').value,
      target_date:$('date').value,
      target_minutes:Number($('minutes').value||0),
      priority:$('priority').value,
      assigned_by:session.user.id
    };
    const r=await c.from('preparation_tasks').insert(payload);
    $('assignBtn').disabled=false;
    if(r.error)return msg(r.error.message);
    msg('Official syllabus task assigned successfully.',true);
    await load();
  };

  $('rows').onclick=async e=>{
    const b=e.target.closest('[data-del]');if(!b)return;
    if(!confirm('Delete this preparation task?'))return;
    const r=await c.from('preparation_tasks').delete().eq('id',b.dataset.del);
    if(r.error)return alert(r.error.message);
    load();
  };

  $('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};

  try{await loadMaster();await load()}catch(err){msg(err?.message||'Unable to load Preparation Guide.')}
})();
