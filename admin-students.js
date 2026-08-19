(async()=>{
const c=window.sgaSupabase,rows=document.getElementById('rows'),modal=document.getElementById('modal'),search=document.getElementById('search');let students=[];
const {data:{session}}=await c.auth.getSession();if(!session)return location.replace('admin-login.html');
const {data:me}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();if(!me||me.role!=='admin'||!me.is_active){await c.auth.signOut();return location.replace('admin-login.html')}
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
function render(){const q=search.value.trim().toLowerCase();const list=students.filter(x=>!q||[x.student_id,x.full_name,x.email,x.phone,x.batch].some(v=>String(v||'').toLowerCase().includes(q)));
document.getElementById('countLine').textContent=`${list.length} student${list.length===1?'':'s'} shown`;
rows.innerHTML=list.length?list.map(x=>`<tr><td><strong>${esc(x.student_id||'—')}</strong></td><td>${esc(x.full_name||'—')}</td><td>${esc(x.email||'—')}</td><td>${esc(x.phone||'—')}</td><td>${esc(x.batch||'—')}</td><td><span class="badge ${x.is_active?'on':'off'}">${x.is_active?'ACTIVE':'INACTIVE'}</span></td><td>${x.joined_at?new Date(x.joined_at).toLocaleDateString('en-IN'):'—'}</td><td><div class="more-wrap"><button class="small-btn more-btn" data-more="${x.id}">⋮ MORE</button><div class="more-menu" data-menu="${x.id}"><button data-edit="${x.id}">EDIT STUDENT</button><button class="status" data-status="${x.id}" data-next="${!x.is_active}">${x.is_active?'DEACTIVATE':'ACTIVATE'}</button><button class="danger" data-delete="${x.id}" data-name="${esc(x.full_name||x.student_id||'Student')}">DELETE STUDENT</button></div></div></td></tr>`).join(''):`<tr><td colspan="8">No students found.</td></tr>`}
async function load(){const {data,error}=await c.from('profiles').select('id,student_id,full_name,email,phone,batch,is_active,joined_at').eq('role','student').order('full_name');if(error){rows.innerHTML=`<tr><td colspan="8">Unable to load students.</td></tr>`;return}students=data||[];render()}
search.oninput=render;
document.getElementById('addBtn').onclick=()=>{
  document.getElementById('joinedAt').value=new Date().toISOString().slice(0,10);
  modal.classList.add('open');
};
document.getElementById('cancel').onclick=()=>modal.classList.remove('open');
document.getElementById('sid').oninput=e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,10);
document.getElementById('studentPhone').oninput=e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,10);
async function callEndpoint(endpoint,body){const {data:{session}}=await c.auth.getSession();const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
document.getElementById('addForm').onsubmit=async e=>{
e.preventDefault();
const sid=document.getElementById('sid').value;
const name=document.getElementById('name').value.trim();
const email=document.getElementById('studentEmail').value.trim();
const phone=document.getElementById('studentPhone').value.trim();
const batch=document.getElementById('studentBatch').value.trim();
const joinedAt=document.getElementById('joinedAt').value;
const password=document.getElementById('studentPassword').value;
const msg=document.getElementById('formMsg'),btn=document.getElementById('createBtn');
if(!/^\d{10}$/.test(sid)){msg.textContent='Student ID must be exactly 10 digits.';return}
if(phone && !/^\d{10}$/.test(phone)){msg.textContent='Mobile number must be exactly 10 digits.';return}
if(!joinedAt){msg.textContent='Please select joining date.';return}
btn.disabled=true;btn.textContent='CREATING...';msg.textContent='Creating student securely...';
try{
 await callEndpoint('admin-create-student',{studentId:sid,fullName:name,email,phone,batch,joinedAt,password});
 e.target.reset();msg.textContent='';modal.classList.remove('open');await load();alert('Student account created successfully.');
}catch(err){msg.textContent=err.message}
finally{btn.disabled=false;btn.textContent='CREATE STUDENT'}
};

let editingStudentId=null;
function closeAllMenus(){document.querySelectorAll('.more-menu.open').forEach(m=>m.classList.remove('open'))}
function openEditStudent(x){
  if(!confirm(`Open Edit Student for ${x.full_name||x.student_id}?`)) return;
  editingStudentId=x.id;
  document.getElementById('editStudentId').value=x.student_id||'';
  document.getElementById('editStudentName').value=x.full_name||'';
  document.getElementById('editStudentEmail').value=x.email||'';
  document.getElementById('editStudentMobile').value=x.mobile||'';
  document.getElementById('editStudentBatch').value=x.batch||'';
  document.getElementById('editStudentPassword').value='';
  document.getElementById('editStudentMsg').textContent='';
  document.getElementById('editStudentModal').classList.add('open');
}

rows.onclick=async e=>{
  const more=e.target.closest('[data-more]');
  if(more){
    const id=more.dataset.more;
    const menu=document.querySelector(`[data-menu="${id}"]`);
    const was=menu.classList.contains('open');closeAllMenus();if(!was)menu.classList.add('open');
    return;
  }
  const edit=e.target.closest('[data-edit]');
  if(edit){closeAllMenus();const x=students.find(v=>v.id===edit.dataset.edit);if(x)openEditStudent(x);return}
  const status=e.target.closest('[data-status]');
  if(status){
    closeAllMenus();
    const next=status.dataset.next==='true';
    const x=students.find(v=>v.id===status.dataset.status);
    if(!confirm(`${next?'Activate':'Deactivate'} ${x?.full_name||'this student'}?`))return;
    status.disabled=true;
    try{await callEndpoint('admin-students',{action:'status',userId:status.dataset.status,isActive:next});await load()}catch(err){alert(err.message)}
    return;
  }
  const del=e.target.closest('[data-delete]');
  if(del){
    closeAllMenus();
    const name=del.dataset.name||'this student';
    if(!confirm(`Permanently delete ${name}?\\n\\nThis will remove the student account and related data. This action cannot be undone.`))return;
    if(!confirm(`FINAL CONFIRMATION\\n\\nDelete ${name} permanently?`))return;
    del.disabled=true;
    try{await callEndpoint('admin-students',{action:'delete',userId:del.dataset.delete});await load();alert('Student deleted successfully.')}catch(err){alert(err.message);del.disabled=false}
  }
};
document.getElementById('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};await 
document.getElementById('cancelEditStudent')?.addEventListener('click',()=>{editingStudentId=null;document.getElementById('editStudentModal').classList.remove('open')});
document.getElementById('editStudentForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!editingStudentId)return;
  if(!confirm('Save these changes to the student profile?'))return;
  const btn=document.getElementById('saveEditStudent'),msg=document.getElementById('editStudentMsg');
  btn.disabled=true;btn.textContent='UPDATING...';msg.textContent='Updating student...';
  try{
    await callEndpoint('admin-students',{
      action:'update',userId:editingStudentId,
      studentId:document.getElementById('editStudentId').value.trim(),
      fullName:document.getElementById('editStudentName').value.trim(),
      email:document.getElementById('editStudentEmail').value.trim(),
      mobile:document.getElementById('editStudentMobile').value.trim(),
      batch:document.getElementById('editStudentBatch').value.trim(),
      password:document.getElementById('editStudentPassword').value
    });
    document.getElementById('editStudentModal').classList.remove('open');
    editingStudentId=null;await load();alert('Student updated successfully.');
  }catch(err){msg.textContent=err.message}
  finally{btn.disabled=false;btn.textContent='UPDATE STUDENT'}
});
document.addEventListener('click',e=>{if(!e.target.closest('.more-wrap'))closeAllMenus()});

load();
})();