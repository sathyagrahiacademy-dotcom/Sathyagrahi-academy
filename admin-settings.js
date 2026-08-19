(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let profile=null;

function setMsg(text,ok=false){
 const x=$('msg');x.textContent=text;x.style.color=ok?'#267447':'#9a2f2f';
}
function dateLabel(v){
 if(!v)return 'No exam date';
 const d=new Date(v+'T00:00:00');
 return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function preview(){
 $('previewAcademy').textContent=$('academyName').value.trim()||'Sathyagrahi Academy';
 $('previewTagline').textContent=$('mainTagline').value.trim()||'—';
 $('previewQuote').textContent=$('academyQuote').value.trim()||'—';
 $('previewExam').textContent=$('targetExam').value.trim()||'Target Exam';
 $('previewDate').textContent=dateLabel($('targetExamDate').value);
 $('previewPhone').textContent=$('supportPhone').value.trim()||'Support Phone';
}
async function auth(){
 const {data:{session}}=await c.auth.getSession();
 if(!session)return location.replace('admin-login.html');
 const r=await c.from('profiles').select('id,role,is_active').eq('id',session.user.id).single();
 if(r.error||r.data?.role!=='admin'||!r.data?.is_active)return location.replace('admin-login.html');
 profile=r.data;
}
async function load(){
 const r=await c.from('academy_settings').select('*').eq('id',1).single();
 if(r.error){setMsg(r.error.message);return}
 const x=r.data;
 $('academyName').value=x.academy_name||'';
 $('mainTagline').value=x.main_tagline||'';
 $('learningPhilosophy').value=x.learning_philosophy||'';
 $('academyQuote').value=x.academy_quote||'';
 $('supportPhone').value=x.support_phone||'';
 $('supportEmail').value=x.support_email||'';
 $('location').value=x.location||'';
 $('websiteUrl').value=x.website_url||'';
 $('targetExam').value=x.target_exam||'';
 $('targetExamDate').value=x.target_exam_date||'';
 preview();
}
document.querySelectorAll('#settingsForm input,#settingsForm textarea').forEach(x=>x.addEventListener('input',preview));

$('settingsForm').onsubmit=async e=>{
 e.preventDefault();
 const academy=$('academyName').value.trim();
 const target=$('targetExam').value.trim();
 if(!academy)return setMsg('Academy Name is required.');
 if(!target)return setMsg('Target Exam is required.');

 $('saveBtn').disabled=true;setMsg('Saving...');
 const payload={
   academy_name:academy,
   main_tagline:$('mainTagline').value.trim()||null,
   learning_philosophy:$('learningPhilosophy').value.trim()||null,
   academy_quote:$('academyQuote').value.trim()||null,
   support_phone:$('supportPhone').value.trim()||null,
   support_email:$('supportEmail').value.trim()||null,
   location:$('location').value.trim()||null,
   website_url:$('websiteUrl').value.trim()||null,
   target_exam:target,
   target_exam_date:$('targetExamDate').value||null,
   updated_by:profile.id,
   updated_at:new Date().toISOString()
 };
 const r=await c.from('academy_settings').update(payload).eq('id',1);
 $('saveBtn').disabled=false;
 if(r.error)return setMsg(r.error.message);
 setMsg('Settings saved successfully.',true);
 preview();
};

$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
await auth();await load();
})();