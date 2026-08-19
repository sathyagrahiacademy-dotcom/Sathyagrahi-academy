(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let profile=null,rows=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const fmt=d=>new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
function msg(t,ok=false){$('formMsg').textContent=t;$('formMsg').style.color=ok?'#267447':'#9a2f2f'}
async function auth(){
 const {data:{session}}=await c.auth.getSession();
 if(!session)return location.replace('index.html#student-portal');
 const r=await c.from('profiles').select('id,full_name,student_id,role,is_active').eq('id',session.user.id).single();
 if(r.error||r.data?.role!=='student'||!r.data?.is_active)return location.replace('index.html#student-portal');
 return r.data;
}
async function load(){
 const r=await c.from('feedback').select('*').eq('student_id',profile.id).order('created_at',{ascending:false});
 if(r.error){$('ticketList').innerHTML=`<div class="empty">${esc(r.error.message)}</div>`;return}
 rows=r.data||[];render();
}
function render(){
 $('openCount').textContent=rows.filter(x=>x.status==='new').length;
 $('progressCount').textContent=rows.filter(x=>x.status==='in_progress').length;
 $('resolvedCount').textContent=rows.filter(x=>x.status==='resolved').length;
 $('ticketList').innerHTML=rows.length?rows.map(x=>`<article class="ticket">
 <div class="ticket-head"><div><div class="chips"><span class="chip ${esc(x.status)}">${esc(x.status.replace('_',' ').toUpperCase())}</span><span class="chip">${esc(x.category)}</span></div>
 <h4>${esc(x.subject)}</h4><small>${fmt(x.created_at)}</small></div></div>
 <p>${esc(x.message)}</p>
 ${x.attachment_url?`<a class="attach" href="${esc(x.attachment_url)}" target="_blank" rel="noopener">VIEW ATTACHMENT →</a>`:''}
 ${x.admin_reply?`<div class="reply"><b>ACADEMY REPLY</b><p>${esc(x.admin_reply)}</p></div>`:''}
 </article>`).join(''):'<div class="empty">You have not sent any support requests yet.</div>';
}
async function upload(file){
 const ext=(file.name.split('.').pop()||'dat').toLowerCase();
 const path=`${profile.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
 const r=await c.storage.from('feedback-attachments').upload(path,file,{cacheControl:'3600',upsert:false});
 if(r.error)throw r.error;
 return c.storage.from('feedback-attachments').getPublicUrl(path).data.publicUrl;
}
$('feedbackForm').onsubmit=async e=>{
 e.preventDefault();
 const subject=$('subject').value.trim(),messageText=$('message').value.trim(),file=$('attachment').files[0];
 if(subject.length<3)return msg('Enter a clear subject.');
 if(messageText.length<5)return msg('Enter your message.');
 if(file&&file.size>5*1024*1024)return msg('Attachment must be 5 MB or smaller.');
 $('submitBtn').disabled=true;msg('Submitting...');
 try{
   let url=null;if(file)url=await upload(file);
   const r=await c.from('feedback').insert({student_id:profile.id,category:$('category').value,subject,message:messageText,attachment_url:url,status:'new'});
   if(r.error)throw r.error;
   $('feedbackForm').reset();msg('Request submitted successfully.',true);await load();
 }catch(e){msg(e.message||String(e))}
 finally{$('submitBtn').disabled=false}
};
$('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
$('logoutBtn').onclick=async()=>{await c.auth.signOut();location.replace('index.html#student-portal')};
document.querySelectorAll('[data-coming]').forEach(x=>x.onclick=e=>{e.preventDefault();});
profile=await auth();if(!profile)return;
$('studentName').textContent=profile.full_name||'Student';$('studentCode').textContent='ID: '+(profile.student_id||'—');
await load();
})();