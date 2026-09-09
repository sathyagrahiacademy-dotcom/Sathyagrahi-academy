(()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id),u=window.ExamPerformanceUIUtils;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const SUBJECTS=['Physics','Chemistry','Biology'];
const requestedAttempt=new URLSearchParams(location.search).get('attempt');
let students=[],selectedStudentId='',detail=null,selectedSubject='Physics',scopeIndex=new Map(),scopeSerial=0,requestedOpened=false;

async function guard(){const {data:{session}}=await c.auth.getSession();if(!session){location.replace('admin-login.html');return false}const {data:p}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();if(!p||p.role!=='admin'||!p.is_active){location.replace('admin-login.html');return false}return true}
async function performanceCall(body){const {data:{session}}=await c.auth.getSession();if(!session)throw new Error('Admin login required.');const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/exam-performance`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Performance request failed');return d}
function pct(v){return `${Number(v||0).toFixed(1)}%`}
function score(v){return Number(v||0).toFixed(1)}
function formatDate(v){if(!v)return '—';const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)}

function renderStudents(){const q=$('studentSearch').value.trim().toLowerCase();const list=students.filter(s=>!q||`${s.fullName} ${s.studentCode}`.toLowerCase().includes(q));$('studentList').innerHTML=list.length?list.map(s=>`<button class="student-item ${s.id===selectedStudentId?'active':''}" data-student="${esc(s.id)}"><b>${esc(s.fullName)}</b><small>${esc(s.studentCode||'—')}</small><div class="student-meta"><span>Set ${Number(s.examsSet||0)}</span><span>Attempted ${Number(s.examsAttempted||0)}</span></div></button>`).join(''):'<div class="empty">No students found.</div>'}
function subjectMetric(subject){return (detail?.subjects||[]).find(x=>x.subject===subject)||{subject,examsSet:0,examsAttempted:0,average:0,best:0}}
function chooseInitialSubject(){const fromAttempt=SUBJECTS.find(subject=>(detail?.subjectHistory?.[subject]||[]).some(row=>String(row.attempt_id)===String(requestedAttempt||'')));if(fromAttempt)return fromAttempt;const withScope=SUBJECTS.find(subject=>(detail?.scopeRows||[]).some(row=>row.subject===subject));return withScope||SUBJECTS.find(subject=>Number(subjectMetric(subject).examsSet||0)>0)||'Physics'}
function renderSubjectTabs(){
  $('performanceSubjectTabs').innerHTML=SUBJECTS.map(subject=>{const m=subjectMetric(subject);return `<button type="button" class="subject-tab ${subject===selectedSubject?'active':''}" data-subject="${subject}">${subject}<small>${pct(m.average)}</small></button>`}).join('');
}
function registerChips(rows=[]){return (rows||[]).map(row=>{const key=`scope-${++scopeSerial}`;scopeIndex.set(key,row);return `<button type="button" class="e-chip" data-e-scope="${key}" title="${esc(u.formatEHistoryRow(row))}">${esc(u.eChipLabel(row))}</button>`}).join('')}
function renderHierarchy(){
  scopeIndex=new Map();scopeSerial=0;
  $('hierarchyTitle').textContent=`${selectedSubject} — Unit / Chapter / Topic`;
  const tree=u.subjectScopeHierarchy(detail?.scopeRows||[],selectedSubject),root=tree[0];
  if(!root||!root.units.length){$('performanceHierarchy').innerHTML='<div class="empty">No official exam E-history for this subject yet.</div>';return}
  $('performanceHierarchy').innerHTML=root.units.map((unit,index)=>`<section class="unit-card"><div class="unit-head"><div><span class="unit-kicker">UNIT ${index+1}</span><div class="unit-title">${esc(unit.title)}</div></div><div class="scope-history">${registerChips(unit.history)}</div></div>${unit.chapters.map(ch=>`<div class="chapter-row"><div class="chapter-head"><div class="chapter-title">${esc(ch.title)}</div><div class="scope-history">${registerChips(ch.history)}</div></div>${ch.subtopics.map(topic=>`<div class="topic-row"><div class="topic-title">${esc(topic.title)}</div><div class="scope-history">${registerChips(topic.history)}</div></div>`).join('')}</div>`).join('')}</section>`).join('');
}
function renderDetail(){
  if(!detail){$('studentTitle').textContent='Select a student';$('studentSubtitle').textContent='Choose a student to view exact syllabus performance.';$('studentSummary').innerHTML='';$('performanceSubjectTabs').innerHTML='';$('performanceHierarchy').innerHTML='<div class="loading">Select a student to view exam performance.</div>';return}
  $('studentTitle').textContent=detail.profile?.fullName||'Student';$('studentSubtitle').textContent=detail.profile?.studentCode||'—';
  $('studentSummary').innerHTML=`<span>Exams Set <b>${Number(detail.summary?.examsSet||0)}</b></span><span>Exams Attempted <b>${Number(detail.summary?.examsAttempted||0)}</b></span>`;
  const legacy=detail.legacyUnmapped||[];$('legacyNotice').style.display=legacy.length?'block':'none';$('legacyNotice').innerHTML=legacy.length?`<b>Legacy / Unmapped:</b> ${legacy.map(x=>esc(x.title||x.subject||'Exam')).join(', ')}. Subject performance is not guessed for these exams.`:'';
  renderSubjectTabs();renderHierarchy();
}
function exactHistoryFor(row){return detail?.subjectHistory?.[row?.subject||selectedSubject]||[]}
function openEDialog(key){
  const row=scopeIndex.get(String(key));if(!row)return;
  const m=u.eDialogModel(row,exactHistoryFor(row));
  $('eDialogTitle').textContent=`${m.eLabel} — ${m.scopeLabel}`;$('eDialogSubtitle').textContent=m.scopePath||m.scopeLabel;
  const resultClass=m.resultPublished?'status-published':'status-admin';
  const resultText=m.resultPublished?'PUBLISHED':'ADMIN ONLY';
  $('eDialogContent').innerHTML=`<div class="dialog-scope"><b>${esc(m.scopeLabel)}</b><span>${esc(m.scopePath)}</span></div><div class="dialog-meta"><div><span>Exam</span><br><b>${esc(m.examTitle)}</b></div><div><span>Exam Code</span><br><b>${esc(m.examCode||'—')}</b></div><div><span>Exam Date</span><br><b>${esc(formatDate(m.examDate))}</b></div><div><span>Attempt</span><br><b>Attempt ${Number(m.attemptNo||1)}</b></div><div><span>Coverage</span><br><b>${esc(String(m.coverage||'partial').toUpperCase())}</b></div><div><span>Result</span><br><b class="${resultClass}">${resultText}</b></div></div><div class="metric-grid"><div class="metric"><small>Questions</small><b>${Number(m.questionCount||0)}</b></div><div class="metric"><small>Score</small><b>${score(m.earnedMarks)} / ${score(m.maxMarks)}</b></div><div class="metric"><small>Percentage</small><b>${pct(m.percentage)}</b></div><div class="metric"><small>Correct</small><b>${Number(m.correct||0)}</b></div><div class="metric"><small>Wrong</small><b>${Number(m.wrong||0)}</b></div><div class="metric"><small>Unattempted</small><b>${Number(m.unattempted||0)}</b></div><div class="metric"><small>E-Series</small><b>${esc(m.eLabel)}</b></div><div class="metric"><small>Scope</small><b>${esc(String(m.scopeLevel||'').toUpperCase())}</b></div></div><div class="dialog-actions">${m.examId?`<button type="button" class="dialog-btn" data-rebuild="${esc(m.examId)}">REBUILD PERFORMANCE</button>`:''}${m.attemptId?`<button type="button" class="dialog-btn primary" data-full-result="${esc(m.attemptId)}">FULL RESULT</button>`:''}</div>`;
  $('eHistoryDialog').classList.add('open');$('eHistoryDialog').setAttribute('aria-hidden','false');
}
function closeEDialog(){$('eHistoryDialog').classList.remove('open');$('eHistoryDialog').setAttribute('aria-hidden','true')}
async function rebuildExam(examId,button){if(!examId||!confirm('Rebuild official syllabus performance for this mapped exam? Raw answers and result score will not change.'))return;if(button){button.disabled=true;button.textContent='REBUILDING...'}try{await performanceCall({action:'rebuild_exam',examId});detail=await performanceCall({action:'admin_student_detail',studentId:selectedStudentId});closeEDialog();renderDetail()}catch(err){alert(err.message||'Rebuild failed.');if(button){button.disabled=false;button.textContent='REBUILD PERFORMANCE'}}}
function openRequestedAttempt(){if(!requestedAttempt||requestedOpened||!detail)return;const row=(detail.scopeRows||[]).filter(r=>String(r.attempt_id)===String(requestedAttempt)).sort((a,b)=>({topic:3,chapter:2,unit:1}[b.scope_level]||0)-({topic:3,chapter:2,unit:1}[a.scope_level]||0))[0];if(!row)return;selectedSubject=row.subject||selectedSubject;renderSubjectTabs();renderHierarchy();const entry=[...scopeIndex.entries()].find(([,v])=>v===row);if(entry){requestedOpened=true;openEDialog(entry[0])}}
async function selectStudent(id){selectedStudentId=id;renderStudents();$('studentTitle').textContent='Loading student performance...';$('studentSubtitle').textContent='';$('studentSummary').innerHTML='';$('performanceSubjectTabs').innerHTML='';$('performanceHierarchy').innerHTML='<div class="loading">Loading exact exam history...</div>';try{detail=await performanceCall({action:'admin_student_detail',studentId:id});selectedSubject=chooseInitialSubject();renderDetail();openRequestedAttempt()}catch(e){detail=null;$('studentTitle').textContent='Unable to load performance';$('performanceHierarchy').innerHTML=`<div class="empty">${esc(e.message||'Unable to load performance.')}</div>`}}
async function resolveRequestedStudent(){if(!requestedAttempt)return '';const {data,error}=await c.from('exam_attempts').select('student_id').eq('id',requestedAttempt).maybeSingle();return error?'':String(data?.student_id||'')}
async function loadStudents(){try{const d=await performanceCall({action:'admin_students'});students=d.students||[];renderStudents();if(!students.length){$('studentTitle').textContent='No active students';$('performanceHierarchy').innerHTML='<div class="empty">No active students.</div>';return}const requestedStudent=await resolveRequestedStudent();const first=students.find(s=>String(s.id)===requestedStudent)||students[0];await selectStudent(first.id)}catch(e){$('studentList').innerHTML=`<div class="empty">${esc(e.message||'Unable to load students.')}</div>`}}

$('studentSearch').oninput=renderStudents;
$('studentList').onclick=e=>{const btn=e.target.closest('[data-student]');if(btn){requestedOpened=true;selectStudent(btn.dataset.student)}};
$('performanceSubjectTabs').onclick=e=>{const btn=e.target.closest('[data-subject]');if(!btn)return;selectedSubject=btn.dataset.subject;renderSubjectTabs();renderHierarchy()};
$('performanceHierarchy').onclick=e=>{const chip=e.target.closest('[data-e-scope]');if(chip)openEDialog(chip.dataset.eScope)};
$('eHistoryDialog').onclick=e=>{if(e.target===e.currentTarget||e.target.closest('[data-dialog-close]')){closeEDialog();return}const full=e.target.closest('[data-full-result]');if(full){location.href='admin-results.html?attempt='+encodeURIComponent(full.dataset.fullResult);return}const rebuild=e.target.closest('[data-rebuild]');if(rebuild)rebuildExam(rebuild.dataset.rebuild,rebuild)};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEDialog()});
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
(async()=>{if(await guard())await loadStudents()})();
})();