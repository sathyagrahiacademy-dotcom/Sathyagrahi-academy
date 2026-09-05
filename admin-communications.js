(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let state=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const text=value=>String(value??'').trim();

function setMsg(id,message,ok=false){const el=$(id);if(!el)return;el.textContent=message||'';el.style.color=ok?'#267447':'#8a4a4a'}
function dateTime(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function eventLabel(value){return ({morning_plan:'Morning Plan',exam_published:'Exam Published',result_published:'Result / Performance',test_email:'Test Email',test_whatsapp:'Test WhatsApp'}[value]||text(value)||'—')}
function statusPill(id,configured){const el=$(id);el.textContent=configured?'CONFIGURED':'NEEDS SETUP';el.className='status '+(configured?'ready':'')}

async function guard(){
  const {data:{session}}=await c.auth.getSession();
  if(!session){location.replace('admin-login.html');return null}
  const r=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();
  if(r.error||r.data?.role!=='admin'||!r.data?.is_active){location.replace('admin-login.html');return null}
  return session
}

async function communicationCall(body){
  const {data:{session}}=await c.auth.getSession();
  if(!session)throw new Error('Admin login required.')
  const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/academy-communications`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify(body)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Communication request failed.');
  return d;
}

function applySettings(settings={}){
  $('emailEnabled').checked=Boolean(settings.emailEnabled);
  $('whatsappEnabled').checked=Boolean(settings.whatsappEnabled);
  $('morningPlanEnabled').checked=Boolean(settings.morningPlanEnabled);
  $('examPublishedEnabled').checked=Boolean(settings.examPublishedEnabled);
  $('resultPerformanceEnabled').checked=Boolean(settings.resultPerformanceEnabled);
  $('morningSendTime').value=text(settings.morningSendTime)||'07:00';
}

function renderStudents(students=[]){
  const current=$('testStudent').value;
  $('testStudent').innerHTML='<option value="">Select active student</option>'+students.map(s=>`<option value="${esc(s.id)}" data-email="${s.hasEmail?'1':'0'}" data-phone="${s.hasPhone?'1':'0'}">${esc(s.fullName)} (${esc(s.studentCode||'—')})${!s.hasEmail&&!s.hasPhone?' — no contact':''}</option>`).join('');
  if([...$('testStudent').options].some(o=>o.value===current))$('testStudent').value=current;
  updateTestButtons();
}
function updateTestButtons(){
  const option=$('testStudent').selectedOptions[0];
  const hasStudent=Boolean(option?.value);
  $('testEmail').disabled=!hasStudent||option?.dataset.email!=='1';
  $('testWhatsapp').disabled=!hasStudent||option?.dataset.phone!=='1';
}

function renderDeliveries(rows=[]){
  $('deliveryRows').innerHTML=rows.length?rows.map(row=>{
    const student=row.student||{};
    const when=row.sent_at||row.attempted_at||row.created_at;
    const canRetry=row.status==='failed'&&['exam_published','result_published'].includes(row.event_type);
    return `<tr><td><b>${esc(student.fullName||'Student')}</b><br><span class="muted">${esc(student.studentCode||'—')}</span></td><td>${esc(eventLabel(row.event_type))}</td><td>${esc(String(row.channel||'').toUpperCase())}<br><span class="muted">${esc(row.recipient_masked||'—')}</span></td><td><span class="delivery-status ${esc(row.status)}">${esc(String(row.status||'').toUpperCase())}</span></td><td>${Number(row.attempt_count||0)}</td><td>${esc(dateTime(when))}</td><td class="failure">${esc(row.failure_reason||'—')}</td><td>${canRetry?`<button class="btn danger" data-retry="${esc(row.id)}" type="button">RETRY</button>`:'—'}</td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">No communication delivery history yet.</td></tr>';
}

function render(data){
  state=data;
  statusPill('emailProviderStatus',Boolean(data.providers?.email?.configured));
  statusPill('whatsappProviderStatus',Boolean(data.providers?.whatsapp?.configured));
  applySettings(data.settings||{});
  renderStudents(data.students||[]);
  renderDeliveries(data.deliveries||[]);
}

async function load(){
  try{render(await communicationCall({action:'status'}));setMsg('settingsMsg','')}
  catch(err){setMsg('settingsMsg',err.message||'Unable to load communication status.');$('deliveryRows').innerHTML='<tr><td colspan="8" class="empty">Unable to load communication status.</td></tr>'}
}

$('saveSettings').onclick=async()=>{
  const btn=$('saveSettings');btn.disabled=true;setMsg('settingsMsg','Saving...');
  try{
    const d=await communicationCall({action:'save_settings',settings:{
      emailEnabled:$('emailEnabled').checked,
      whatsappEnabled:$('whatsappEnabled').checked,
      morningPlanEnabled:$('morningPlanEnabled').checked,
      examPublishedEnabled:$('examPublishedEnabled').checked,
      resultPerformanceEnabled:$('resultPerformanceEnabled').checked,
      morningSendTime:$('morningSendTime').value
    }});
    applySettings(d.settings||{});setMsg('settingsMsg','Communication settings saved.',true);
  }catch(err){setMsg('settingsMsg',err.message||'Unable to save settings.')}
  finally{btn.disabled=false}
};

$('testStudent').onchange=updateTestButtons;
$('testEmail').onclick=()=>sendTest('test_email','testEmail','Sending test email...');
$('testWhatsapp').onclick=()=>sendTest('test_whatsapp','testWhatsapp','Sending test WhatsApp...');
async function sendTest(action,buttonId,loading){
  const studentId=$('testStudent').value;if(!studentId)return;
  const btn=$(buttonId);btn.disabled=true;setMsg('testMsg',loading);
  try{const d=await communicationCall({action,studentId});const first=(d.deliveries||[])[0]||{};if(first.status==='sent')setMsg('testMsg',`${action==='test_email'?'Email':'WhatsApp'} test sent successfully.`,true);else setMsg('testMsg',first.error||`Test status: ${first.status||'unknown'}`);await load()}
  catch(err){setMsg('testMsg',err.message||'Test delivery failed.')}
  finally{updateTestButtons()}
}

$('deliveryRows').onclick=async e=>{
  const btn=e.target.closest('[data-retry]');if(!btn)return;
  btn.disabled=true;setMsg('testMsg','Retrying failed delivery...');
  try{const d=await communicationCall({action:'retry_delivery',deliveryId:btn.dataset.retry});const first=(d.deliveries||[])[0]||{};setMsg('testMsg',first.status==='sent'?'Delivery sent successfully.':(first.error||`Retry status: ${first.status||'unknown'}`),first.status==='sent');await load()}
  catch(err){setMsg('testMsg',err.message||'Retry failed.')}
  finally{btn.disabled=false}
};

$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
if(await guard())await load();
})();
