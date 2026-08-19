(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let rows=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const fmt=d=>new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
function toast(t){const x=$('toast');x.textContent=t;x.style.display='block';setTimeout(()=>x.style.display='none',1800)}
async function auth(){const {data:{session}}=await c.auth.getSession();if(!session)return location.replace('admin-login.html');const p=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();if(p.error||p.data?.role!=='admin'||!p.data?.is_active)return location.replace('admin-login.html')}
async function load(){const r=await c.from('enrollments').select('*').order('created_at',{ascending:false});if(r.error){$('list').innerHTML=`<div class="empty">${esc(r.error.message)}</div>`;return}rows=r.data||[];renderStats();render()}
function renderStats(){const n=s=>rows.filter(x=>x.status===s).length;$('sNew').textContent=n('new');$('sContacted').textContent=n('contacted');$('sInterested').textContent=n('interested');$('sEnrolled').textContent=n('enrolled');$('sNotJoined').textContent=n('not_joined')}
function render(){
 const q=$('search').value.toLowerCase().trim(),f=$('statusFilter').value;
 const a=rows.filter(x=>(f==='all'||x.status===f)&&(!q||[x.student_name,x.mobile,x.parent_name,x.parent_mobile,x.school_college,x.location].join(' ').toLowerCase().includes(q)));
 $('list').innerHTML=a.length?a.map(x=>`<article class="card" data-id="${x.id}">
 <div class="card-top"><div><h3>${esc(x.student_name)}</h3><div class="meta"><span class="chip ${esc(x.status)}">${esc(x.status.replace('_',' ').toUpperCase())}</span><span class="chip">${esc(x.target_exam||'NEET')}</span><span class="chip">${fmt(x.created_at)}</span></div></div>
 <a class="btn link" href="tel:${esc(x.mobile)}">CALL ${esc(x.mobile)}</a></div>
 <div class="details">
  <div class="detail"><span>STUDENT MOBILE</span><b>${esc(x.mobile)}</b></div>
  <div class="detail"><span>PARENT / GUARDIAN</span><b>${esc(x.parent_name||'—')} ${x.parent_mobile?'· '+esc(x.parent_mobile):''}</b></div>
  <div class="detail"><span>CURRENT CLASS</span><b>${esc(x.current_class||'—')}</b></div>
  <div class="detail"><span>SCHOOL / COLLEGE</span><b>${esc(x.school_college||'—')}</b></div>
  <div class="detail"><span>LOCATION</span><b>${esc(x.location||'—')}</b></div>
  <div class="detail"><span>UPDATED</span><b>${fmt(x.updated_at||x.created_at)}</b></div>
 </div>
 ${x.message?`<div class="message">${esc(x.message)}</div>`:''}
 <div class="actions">
  <label>Status<select class="status">
   <option value="new" ${x.status==='new'?'selected':''}>New</option>
   <option value="contacted" ${x.status==='contacted'?'selected':''}>Contacted</option>
   <option value="interested" ${x.status==='interested'?'selected':''}>Interested</option>
   <option value="enrolled" ${x.status==='enrolled'?'selected':''}>Enrolled</option>
   <option value="not_joined" ${x.status==='not_joined'?'selected':''}>Not Joined</option>
  </select></label>
  <label>Admin Notes<textarea class="notes" placeholder="Private admin note...">${esc(x.admin_notes||'')}</textarea></label>
  <button class="btn primary save">SAVE UPDATE</button>
  <button class="btn danger delete" data-delete-state="idle">DELETE</button>
  ${x.status==='enrolled'?'<a class="btn link" href="admin-students.html">OPEN STUDENTS →</a>':''}
 </div>
 </article>`).join(''):'<div class="empty">No enrollment applications found.</div>';
}
$('search').oninput=render;$('statusFilter').onchange=render;
document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{$('statusFilter').value=x.dataset.filter;render()});
$('list').onclick=async e=>{
 const saveBtn=e.target.closest('.save');
 if(saveBtn){
   const card=saveBtn.closest('[data-id]');
   const id=card.dataset.id;
   const status=card.querySelector('.status').value;
   const notes=card.querySelector('.notes').value.trim();

   saveBtn.disabled=true;
   const r=await c.from('enrollments')
     .update({status,admin_notes:notes||null,updated_at:new Date().toISOString()})
     .eq('id',id);
   saveBtn.disabled=false;

   if(r.error){toast(r.error.message);return;}
   toast('Enrollment updated');
   await load();
   return;
 }

 const delBtn=e.target.closest('.delete');
 if(delBtn){
   const card=delBtn.closest('[data-id]');
   const id=card.dataset.id;

   if(delBtn.dataset.deleteState!=='confirm'){
     delBtn.dataset.deleteState='confirm';
     delBtn.textContent='CONFIRM DELETE';
     delBtn.classList.add('confirm-danger');
     toast('Click CONFIRM DELETE to remove this test enrollment.');

     setTimeout(()=>{
       if(document.body.contains(delBtn)){
         delBtn.dataset.deleteState='idle';
         delBtn.textContent='DELETE';
         delBtn.classList.remove('confirm-danger');
       }
     },5000);
     return;
   }

   delBtn.disabled=true;
   const r=await c.from('enrollments').delete().eq('id',id);
   if(r.error){
     delBtn.disabled=false;
     toast(r.error.message);
     return;
   }

   toast('Enrollment deleted');
   await load();
 }
};
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
document.querySelectorAll('[data-coming]').forEach(x=>x.onclick=()=>toast('This module will be connected next.'));
await auth();await load();
})();