(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
let session=null,profile=null,rows=[],editId=null,oldPosterUrl=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
function msg(t,ok=false){$('msg').textContent=t;$('msg').style.color=ok?'#267447':'#9a2f2f'}
function fmt(d){return d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}
async function auth(){
 const r=await c.auth.getSession();session=r.data.session;if(!session)return location.replace('admin-login.html');
 const p=await c.from('profiles').select('id,role,is_active').eq('id',session.user.id).single();profile=p.data;
 if(p.error||!profile||profile.role!=='admin'||!profile.is_active)return location.replace('admin-login.html');
}
async function load(){
 const r=await c.from('notifications').select('*').order('created_at',{ascending:false});
 if(r.error){$('noticeList').innerHTML=`<div class="empty">${esc(r.error.message)}</div>`;return}
 rows=r.data||[];render();
}
function render(){
 $('sTotal').textContent=rows.length;$('sPublished').textContent=rows.filter(x=>x.is_published).length;$('sDrafts').textContent=rows.filter(x=>!x.is_published).length;$('sPoster').textContent=rows.filter(x=>x.poster_url).length;
 $('noticeList').innerHTML=rows.length?rows.map(x=>`<article class="notice">
 <div class="notice-top"><div><div class="chips"><span class="chip ${x.is_published?'live':''}">${x.is_published?'PUBLISHED':'DRAFT'}</span><span class="chip">${esc(String(x.audience).toUpperCase())}</span></div>
 <h4>${esc(x.title)}</h4><small>${fmt(x.published_at||x.created_at)}</small></div>${x.poster_url?`<img src="${esc(x.poster_url)}" alt="">`:''}</div>
 <p>${esc(x.message||'')}</p>
 <div class="notice-actions">
 <button class="btn" data-edit="${x.id}">EDIT</button>
 <button class="btn ${x.is_published?'':'good'}" data-toggle="${x.id}">${x.is_published?'UNPUBLISH':'PUBLISH'}</button>
 <button class="btn danger" data-delete="${x.id}">DELETE</button>
 </div></article>`).join(''):'<div class="empty">No notifications yet.</div>';
}
function resetForm(){
 editId=null;oldPosterUrl=null;$('formTitle').textContent='Create Notification';$('title').value='';$('message').value='';$('audience').value='students';$('publish').checked=true;$('poster').value='';$('preview').style.display='none';$('cancelEdit').style.display='none';$('saveBtn').textContent='SAVE NOTIFICATION';msg('');
}
function editRow(id){
 const x=rows.find(r=>r.id===id);if(!x)return;editId=id;oldPosterUrl=x.poster_url||null;$('formTitle').textContent='Edit Notification';$('title').value=x.title||'';$('message').value=x.message||'';$('audience').value=x.audience||'students';$('publish').checked=!!x.is_published;$('cancelEdit').style.display='inline-block';$('saveBtn').textContent='UPDATE NOTIFICATION';
 if(x.poster_url){$('previewImg').src=x.poster_url;$('preview').style.display='block'}else $('preview').style.display='none';
 window.scrollTo({top:0,behavior:'smooth'});
}
async function uploadPoster(file){
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
 const up=await c.storage.from('notification-posters').upload(path,file,{cacheControl:'3600',upsert:false});
 if(up.error)throw up.error;
 return c.storage.from('notification-posters').getPublicUrl(path).data.publicUrl;
}
function posterPath(url){
 if(!url)return null;const key='/storage/v1/object/public/notification-posters/';const i=url.indexOf(key);return i>=0?decodeURIComponent(url.slice(i+key.length)):null;
}
async function save(){
 const title=$('title').value.trim(),message=$('message').value.trim(),audience=$('audience').value,isPublished=$('publish').checked,file=$('poster').files[0];
 if(!title)return msg('Enter notification title.');
 if(file&&file.size>10*1024*1024)return msg('Poster must be 10 MB or smaller.');
 $('saveBtn').disabled=true;msg('Saving...');
 try{
   let posterUrl=oldPosterUrl;
   if(file)posterUrl=await uploadPoster(file);
   const payload={title,message:message||null,audience,poster_url:posterUrl,is_published:isPublished,published_at:isPublished?new Date().toISOString():null,updated_at:new Date().toISOString(),created_by:profile.id};
   let r;
   if(editId) r=await c.from('notifications').update(payload).eq('id',editId);
   else r=await c.from('notifications').insert(payload);
   if(r.error)throw r.error;
   if(file&&oldPosterUrl&&oldPosterUrl!==posterUrl){const p=posterPath(oldPosterUrl);if(p)await c.storage.from('notification-posters').remove([p])}
   resetForm();msg('Notification saved successfully.',true);await load();
 }catch(e){msg(e.message||String(e))}
 finally{$('saveBtn').disabled=false}
}
async function toggle(id){
 const x=rows.find(r=>r.id===id);if(!x)return;const value=!x.is_published;
 const r=await c.from('notifications').update({is_published:value,published_at:value?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id);
 if(r.error)return alert(r.error.message);await load();
}
async function del(id){
 const x=rows.find(r=>r.id===id);if(!x||!confirm('Delete this notification?'))return;
 const r=await c.from('notifications').delete().eq('id',id);if(r.error)return alert(r.error.message);
 const p=posterPath(x.poster_url);if(p)await c.storage.from('notification-posters').remove([p]);await load();
}
$('poster').onchange=()=>{const f=$('poster').files[0];if(!f)return;$('previewImg').src=URL.createObjectURL(f);$('preview').style.display='block'};
$('saveBtn').onclick=save;$('cancelEdit').onclick=resetForm;
$('noticeList').onclick=e=>{let b=e.target.closest('[data-edit]');if(b)return editRow(b.dataset.edit);b=e.target.closest('[data-toggle]');if(b)return toggle(b.dataset.toggle);b=e.target.closest('[data-delete]');if(b)return del(b.dataset.delete)};
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
await auth();await load();
})();