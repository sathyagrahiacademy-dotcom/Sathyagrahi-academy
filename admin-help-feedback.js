(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let rows=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const fmt=d=>new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
function toast(t){const x=$('toast');x.textContent=t;x.style.display='block';setTimeout(()=>x.style.display='none',1800)}
async function auth(){
 const {data:{session}}=await c.auth.getSession();if(!session)return location.replace('admin-login.html');
 const p=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();
 if(p.error||p.data?.role!=='admin'||!p.data?.is_active)return location.replace('admin-login.html');
}
async function load(){
 const r=await c.from('feedback').select('id,student_id,category,subject,message,attachment_url,status,admin_reply,created_at,updated_at,profiles!feedback_student_id_fkey(full_name,student_id)').order('created_at',{ascending:false});
 if(r.error){$('list').innerHTML=`<div class="empty">${esc(r.error.message)}</div>`;return}
 rows=r.data||[];renderStats();render();
}
function renderStats(){
 $('sNew').textContent=rows.filter(x=>x.status==='new').length;
 $('sProgress').textContent=rows.filter(x=>x.status==='in_progress').length;
 $('sResolved').textContent=rows.filter(x=>x.status==='resolved').length;
 $('sTotal').textContent=rows.length;
}
function render(){
 const q=$('search').value.toLowerCase().trim(),f=$('statusFilter').value;
 const a=rows.filter(x=>{
   const p=x.profiles||{};
   const hay=[p.full_name,p.student_id,x.category,x.subject,x.message,x.admin_reply].join(' ').toLowerCase();
   return (f==='all'||x.status===f)&&(!q||hay.includes(q));
 });
 $('list').innerHTML=a.length?a.map(x=>{
   const p=x.profiles||{};
   return `<article class="ticket" data-id="${x.id}">
   <div class="head"><div><div class="chips"><span class="chip ${esc(x.status)}">${esc(x.status.replace('_',' ').toUpperCase())}</span><span class="chip">${esc(x.category)}</span></div>
   <h3>${esc(x.subject)}</h3><div class="student"><b>${esc(p.full_name||'Student')}</b> · ID ${esc(p.student_id||'—')} · ${fmt(x.created_at)}</div></div></div>
   <p>${esc(x.message)}</p>
   ${x.attachment_url?`<a class="attach" href="${esc(x.attachment_url)}" target="_blank" rel="noopener">VIEW ATTACHMENT →</a>`:''}
   <div class="reply-grid">
    <label>Status<select class="status"><option value="new" ${x.status==='new'?'selected':''}>New</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>In Progress</option><option value="resolved" ${x.status==='resolved'?'selected':''}>Resolved</option></select></label>
    <label>Admin Reply<textarea class="reply" placeholder="Write reply to student...">${esc(x.admin_reply||'')}</textarea></label>
    <button class="btn primary save">SAVE REPLY</button>
    <button class="btn danger delete" data-state="idle">DELETE</button>
   </div></article>`;
 }).join(''):'<div class="empty">No support requests found.</div>';
}
$('search').oninput=render;$('statusFilter').onchange=render;
document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{$('statusFilter').value=x.dataset.filter;render()});
$('list').onclick=async e=>{
 const save=e.target.closest('.save');
 if(save){
   const card=save.closest('[data-id]'),id=card.dataset.id,status=card.querySelector('.status').value,reply=card.querySelector('.reply').value.trim();
   save.disabled=true;
   const r=await c.from('feedback').update({status,admin_reply:reply||null,updated_at:new Date().toISOString()}).eq('id',id);
   save.disabled=false;if(r.error)return toast(r.error.message);toast('Reply saved');await load();return;
 }
 const del=e.target.closest('.delete');
 if(del){
   const card=del.closest('[data-id]'),id=card.dataset.id;
   if(del.dataset.state!=='confirm'){
     del.dataset.state='confirm';del.textContent='CONFIRM DELETE';del.classList.add('confirm');toast('Click CONFIRM DELETE to remove this test request.');
     setTimeout(()=>{if(document.body.contains(del)){del.dataset.state='idle';del.textContent='DELETE';del.classList.remove('confirm')}},5000);return;
   }
   del.disabled=true;const r=await c.from('feedback').delete().eq('id',id);
   if(r.error){del.disabled=false;return toast(r.error.message)}toast('Request deleted');await load();
 }
};
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
document.querySelectorAll('[data-coming]').forEach(x=>x.onclick=e=>{e.preventDefault();toast('This module will be connected next.')});
await auth();await load();
})();