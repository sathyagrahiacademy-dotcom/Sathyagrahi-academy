(async()=>{
const c=window.sgaSupabase,rows=document.getElementById('rows'),modal=document.getElementById('modal'),search=document.getElementById('search');let exams=[];
const {data:{session}}=await c.auth.getSession();if(!session)return location.replace('admin-login.html');
const {data:me}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();if(!me||me.role!=='admin'||!me.is_active){await c.auth.signOut();return location.replace('admin-login.html')}
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const fmt=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';
async function call(body){const {data:{session}}=await c.auth.getSession();const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exams`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
function render(){const q=search.value.trim().toLowerCase();const list=exams.filter(x=>!q||[x.title,x.subject,x.exam_access?.[0]?.exam_code].some(v=>String(v||'').toLowerCase().includes(q)));document.getElementById('countLine').textContent=`${list.length} exam${list.length===1?'':'s'} shown`;
rows.innerHTML=list.length?list.map(x=>{const access=Array.isArray(x.exam_access)?x.exam_access[0]:x.exam_access;const code=access?.exam_code||'—';return `<tr><td><strong>${esc(x.title)}</strong><br><small>${esc(x.syllabus||'')}</small></td><td>${esc(x.subject)}</td><td><strong>${esc(code)}</strong></td><td>${esc(x.duration_minutes)} min</td><td>${esc(x.total_marks)}</td><td><span class="badge ${x.is_published?'published':'draft'}">${x.is_published?'PUBLISHED':'DRAFT'}</span></td><td><button class="small-btn edit" data-id="${x.id}">EDIT</button><button class="small-btn questions" data-id="${x.id}">QUESTIONS</button><button class="small-btn pub" data-id="${x.id}" data-pub="${x.is_published}">${x.is_published?'UNPUBLISH':'PUBLISH'}</button><button class="small-btn del" data-id="${x.id}">DELETE</button></td></tr>`}).join(''):`<tr><td colspan="7">No exams created yet.</td></tr>`}
async function load(){const {data,error}=await c.from('exams').select('id,title,subject,syllabus,duration_minutes,total_marks,negative_marking,instructions,status,is_published,exam_access(exam_code)').order('created_at',{ascending:false});if(error){rows.innerHTML=`<tr><td colspan="7">Unable to load exams. ${esc(error.message)}</td></tr>`;return}exams=data||[];render()}
search.oninput=render;
let editingExamId=null;
const form=document.getElementById('examForm'),formTitle=document.getElementById('examFormTitle'),saveBtn=document.getElementById('createBtn');
function resetExamForm(){
  editingExamId=null;form.reset();document.getElementById('duration').value=180;document.getElementById('marks').value=720;document.getElementById('negative').checked=true;
  document.getElementById('password').required=true;document.getElementById('password').placeholder='Minimum 4 characters';
  formTitle.textContent='Create New Exam';saveBtn.textContent='CREATE EXAM';document.getElementById('formMsg').textContent='';
}
document.getElementById('addBtn').onclick=()=>{resetExamForm();modal.classList.add('open')};
document.getElementById('cancel').onclick=()=>{modal.classList.remove('open');resetExamForm()};
document.getElementById('code').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,20);

form.onsubmit=async e=>{
  e.preventDefault();
  const msg=document.getElementById('formMsg'),btn=saveBtn;
  btn.disabled=true;btn.textContent=editingExamId?'UPDATING...':'CREATING...';msg.textContent=editingExamId?'Updating exam...':'Creating exam...';
  try{
    await call({
      action:editingExamId?'update':'create',examId:editingExamId||undefined,
      title:document.getElementById('title').value.trim(),subject:document.getElementById('subject').value,
      syllabus:document.getElementById('syllabus').value.trim(),
      durationMinutes:Number(document.getElementById('duration').value),totalMarks:Number(document.getElementById('marks').value),
      examCode:document.getElementById('code').value.trim(),examPassword:document.getElementById('password').value,
      instructions:document.getElementById('instructions').value.trim(),negativeMarking:document.getElementById('negative').checked
    });
    modal.classList.remove('open');resetExamForm();await load();
    alert(editingExamId?'Exam updated successfully.':'Exam created as Draft. Add questions before publishing.');
  }catch(err){msg.textContent=err.message}
  finally{btn.disabled=false;btn.textContent=editingExamId?'UPDATE EXAM':'CREATE EXAM'}
};

rows.onclick=async e=>{const edit=e.target.closest('.edit'),questions=e.target.closest('.questions'),pub=e.target.closest('.pub'),del=e.target.closest('.del');if(edit){const x=exams.find(v=>v.id===edit.dataset.id);if(!x)return;editingExamId=x.id;formTitle.textContent='Edit Exam';saveBtn.textContent='UPDATE EXAM';document.getElementById('title').value=x.title||'';document.getElementById('subject').value=x.subject||'NEET';document.getElementById('syllabus').value=x.syllabus||'';document.getElementById('duration').value=x.duration_minutes||180;document.getElementById('marks').value=x.total_marks||720;const ax=Array.isArray(x.exam_access)?x.exam_access[0]:x.exam_access;document.getElementById('code').value=ax?.exam_code||'';document.getElementById('password').value='';document.getElementById('password').required=false;document.getElementById('password').placeholder='Leave blank to keep current password';document.getElementById('instructions').value=x.instructions||'';document.getElementById('negative').checked=!!x.negative_marking;modal.classList.add('open');return}if(questions){location.href=`admin-exam-questions.html?exam=${encodeURIComponent(questions.dataset.id)}`;return}if(pub){const isPub=pub.dataset.pub==='true',action=isPub?'unpublish':'publish';if(!confirm(`${isPub?'Unpublish':'Publish'} this exam?`))return;pub.disabled=true;try{await call({action,examId:pub.dataset.id});await load()}catch(err){alert(err.message)}return}if(del){if(!confirm('Delete this draft exam?'))return;del.disabled=true;try{await call({action:'delete',examId:del.dataset.id});await load()}catch(err){alert(err.message)}}};
document.getElementById('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};await load();
})();