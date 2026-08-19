(()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
const today=()=>new Date().toLocaleDateString('en-CA');
let profile=null,overview=null,syllabus=[],sessions=[],tasks=[],results=[],subjectProgress=[],notifications=[];
const el=id=>document.getElementById(id);
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
function toast(m){const t=el('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function examResult(x){return Array.isArray(x?.exam_results)?x.exam_results[0]:x?.exam_results}
function formatMinutes(n){const total=Math.max(0,Math.round(Number(n)||0)),h=Math.floor(total/60),m=total%60;return `${String(h).padStart(2,'0')} hr ${String(m).padStart(2,'0')} min`}
async function auth(){const {data:{session}}=await c.auth.getSession();if(!session){location.replace('index.html#student-portal');return null}const r=await c.from('profiles').select('id,full_name,student_id,role,is_active').eq('id',session.user.id).single();if(r.error||!r.data||r.data.role!=='student'||!r.data.is_active){await c.auth.signOut();location.replace('index.html#student-portal');return null}return r.data}
function countdown(){const end=new Date('2027-05-02T14:00:00+05:30').getTime(),d=Math.max(0,end-Date.now());if(el('daysLeft'))el('daysLeft').textContent=Math.floor(d/86400000);if(el('hoursLeft'))el('hoursLeft').textContent=String(Math.floor((d%86400000)/3600000)).padStart(2,'0');if(el('minutesLeft'))el('minutesLeft').textContent=String(Math.floor((d%3600000)/60000)).padStart(2,'0');if(el('secondsLeft'))el('secondsLeft').textContent=String(Math.floor((d%60000)/1000)).padStart(2,'0')}
async function load(){const [ov,lp,ss,pt,sp,ea,nn]=await Promise.all([
c.from('student_preparation_overview').select('*').eq('student_id',profile.id).maybeSingle(),
c.from('student_learning_progress').select('*').eq('student_id',profile.id).order('unit_no').order('sort_order'),
c.from('student_study_sessions').select('*').eq('student_id',profile.id).order('created_at',{ascending:false}).limit(120),
c.from('preparation_tasks').select('*').eq('student_id',profile.id).order('target_date'),
c.from('student_subject_progress').select('subject,progress_percent').eq('student_id',profile.id),
c.from('exam_attempts').select('id,submitted_at,status,exams(title,subject),exam_results(total_score,correct_count,wrong_count,percentage,is_published)').eq('student_id',profile.id).eq('status','submitted').order('submitted_at',{ascending:false}),
c.from('notifications').select('id,title,message,poster_url,published_at,created_at').eq('is_published',true).in('audience',['students','all','public']).order('published_at',{ascending:false,nullsFirst:false}).limit(4)
]);overview=ov.data||{};syllabus=lp.data||[];sessions=ss.data||[];tasks=pt.data||[];subjectProgress=sp.data||[];results=(ea.data||[]).filter(x=>examResult(x)?.is_published);notifications=nn.data||[];render();fillStudyUnits();toggleStudyPracticeFields()}
function revisionPercent(){const completed=Number(overview?.completed_topics||0);if(!completed)return 0;const stages=Number(overview?.revision1_done||0)+Number(overview?.revision2_done||0)+Number(overview?.revision3_done||0);return Math.min(100,(stages/(completed*3))*100)}
function metrics(){const learning=Number(overview?.syllabus_completion||0),revision=revisionPercent(),exam=Number(overview?.published_exam_average||0);return {learning,revision,exam,overall:learning*.50+revision*.20+exam*.30}}
function render(){const m=metrics(),t=today(),due=syllabus.filter(x=>x.next_revision_at&&new Date(x.next_revision_at)<=new Date()),ts=sessions.filter(x=>x.session_date===t);if(el('overallScore'))el('overallScore').textContent=Math.round(m.overall)+'%';[['learning',m.learning],['revision',m.revision],['exam',m.exam]].forEach(([k,v])=>{if(el(k+'Score'))el(k+'Score').textContent=Math.round(v)+'%';if(el(k+'Bar'))el(k+'Bar').style.width=Math.max(0,Math.min(100,v))+'%'});if(el('topicsCompleted'))el('topicsCompleted').textContent=Number(overview?.completed_topics||0);if(el('revisionDue'))el('revisionDue').textContent=Number(overview?.revision_due||due.length);if(el('examsAttempted'))el('examsAttempted').textContent=results.length;if(el('syllabusCompletion'))el('syllabusCompletion').textContent=Number(overview?.syllabus_completion||0).toFixed(1)+'%';if(el('totalStudyTime'))el('totalStudyTime').textContent=formatMinutes(overview?.total_study_minutes||0);if(el('totalQuestionsPractised'))el('totalQuestionsPractised').textContent=Number(overview?.total_questions_practised||0);if(el('overviewRevisionDue'))el('overviewRevisionDue').textContent=Number(overview?.revision_due||0);if(el('overviewExamAverage'))el('overviewExamAverage').textContent=Number(overview?.published_exam_average||0).toFixed(1)+'%';if(el('overviewTopicsCompleted'))el('overviewTopicsCompleted').textContent=`${Number(overview?.completed_topics||0)} / ${Number(overview?.total_topics||syllabus.length||0)}`;if(el('todayMinutes'))el('todayMinutes').textContent=formatMinutes(ts.reduce((s,x)=>s+Number(x.minutes||0),0));if(el('todaySessions'))el('todaySessions').textContent=ts.length;if(el('todayTopics'))el('todayTopics').textContent=new Set(ts.map(x=>`${x.subject}|${x.chapter}|${x.topic}`)).size;if(el('todayQuestions'))el('todayQuestions').textContent=ts.reduce((s,x)=>s+Number(x.questions_attempted||0),0);if(el('todayDate'))el('todayDate').textContent=new Date(t+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});renderSubjects(due);renderTasks();renderRevisions(due);renderExam();renderTimeline();renderGuide(due);renderNotifications()}
function renderNotifications(){const h=el('dashboardNotifications');if(!h)return;h.innerHTML=notifications.length?notifications.map(x=>`<article class="notification-item"><div><strong>${esc(x.title)}</strong><p>${esc(x.message||'')}</p></div><time>${new Date(x.published_at||x.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</time></article>`).join(''):'<div class="empty-state">No new notifications yet.</div>'}
function renderSubjects(due){['Physics','Chemistry','Biology'].forEach(subject=>{const key=subject.toLowerCase(),p=Number(subjectProgress.find(x=>String(x.subject).toLowerCase()===key)?.progress_percent||0);if(el(key+'Pct'))el(key+'Pct').textContent=p.toFixed(1)+'%';if(el(key+'Bar'))el(key+'Bar').style.width=p+'%';if(el(key+'Topics'))el(key+'Topics').textContent=syllabus.filter(x=>x.subject===subject&&x.status==='completed').length;if(el(key+'Minutes'))el(key+'Minutes').textContent=formatMinutes(syllabus.filter(x=>x.subject===subject).reduce((a,x)=>a+Number(x.study_minutes||0),0));if(el(key+'Due'))el(key+'Due').textContent=due.filter(x=>x.subject===subject).length})}
function fillStudyUnits(){const subject=el('studySubject')?.value||'Physics',current=el('studyUnit')?.value,units=[...new Map(syllabus.filter(x=>x.subject===subject).map(x=>[String(x.unit_no),x.unit_title])).entries()];if(el('studyUnit')){el('studyUnit').innerHTML=units.map(([n,t])=>`<option value="${n}">Unit ${n} — ${esc(t)}</option>`).join('');if(current&&[...el('studyUnit').options].some(o=>o.value===current))el('studyUnit').value=current}fillStudyTopics()}
function fillStudyTopics(){const subject=el('studySubject')?.value||'Physics',unit=String(el('studyUnit')?.value||''),current=el('studyTopic')?.value,rows=syllabus.filter(x=>x.subject===subject&&String(x.unit_no)===unit);if(el('studyTopic')){el('studyTopic').innerHTML=rows.map(x=>`<option value="${x.topic_id}">${esc(x.topic_title)}</option>`).join('');if(current&&[...el('studyTopic').options].some(o=>o.value===current))el('studyTopic').value=current}}
function toggleStudyPracticeFields(){const show=el('studyType')?.value==='practice';document.querySelectorAll('.practice-field').forEach(x=>x.style.display=show?'block':'none');if(!show){if(el('studyQuestions'))el('studyQuestions').value=0;if(el('studyCorrect'))el('studyCorrect').value=0}}
function renderTasks(){const h=el('todayTasks');if(!h)return;const a=tasks.filter(x=>x.status==='pending'&&x.target_date<=today()).slice(0,5);h.innerHTML=a.length?a.map(x=>`<div class="task-item ${x.priority==='high'?'high':''}"><div><span>${esc(String(x.task_type||'task').toUpperCase())} · ${esc(x.subject||'')}</span><strong>${esc(x.topic||'')}</strong><small>${esc(x.chapter||'')} ${x.target_minutes?'· '+formatMinutes(x.target_minutes):''}</small></div><button data-task="${x.id}">DONE</button></div>`).join(''):'<div class="empty-state">No assigned task now. Open Learning Progress and continue one focused syllabus topic.</div>'}
function renderRevisions(due){const h=el('revisionList');if(!h)return;h.innerHTML=due.length?due.slice(0,5).map(x=>`<div class="revision-item"><div><span>${esc(x.subject)} · REVISION DUE</span><strong>${esc(x.topic_title)}</strong><small>${esc(x.unit_title)}</small></div><button data-revise="${x.topic_id}">REVISION DONE</button></div>`).join(''):'<div class="empty-state">No revision due now. Completed topics will automatically enter the revision cycle.</div>'}
function renderExam(){const ers=results.map(examResult).filter(Boolean);if(!ers.length){if(el('avgScore'))el('avgScore').textContent='0%';if(el('accuracy'))el('accuracy').textContent='0%';if(el('lastExamScore'))el('lastExamScore').textContent='—';if(el('examGuidance'))el('examGuidance').textContent='Write your first published exam to begin readiness tracking.';return}const avg=ers.reduce((s,x)=>s+Number(x.percentage||0),0)/ers.length,corr=ers.reduce((s,x)=>s+Number(x.correct_count||0),0),wrong=ers.reduce((s,x)=>s+Number(x.wrong_count||0),0),acc=(corr+wrong)?corr/(corr+wrong)*100:0;if(el('avgScore'))el('avgScore').textContent=Math.round(avg)+'%';if(el('accuracy'))el('accuracy').textContent=Math.round(acc)+'%';if(el('lastExamScore'))el('lastExamScore').textContent=Math.round(Number(ers[0]?.percentage||0))+'%';if(el('examGuidance'))el('examGuidance').textContent=avg>=75?'Strong performance. Maintain revision and reduce errors.':avg>=50?'Improving. Review wrong answers and revise weak syllabus topics.':'Build concept clarity first, then increase practice before the next exam.'}
function renderTimeline(){
 const h=el('prepTimeline');if(!h)return;
 let ev=sessions.slice(0,8).map(x=>({
   d:x.created_at,t:x.activity_type||'study',s:x.subject,n:x.topic,
   z:`${x.chapter} · ${formatMinutes(x.minutes)}`,
   kind:'study',id:x.id,topic_id:x.topic_id,source:x.source||'study_log'
 }));
 results.slice(0,4).forEach(x=>{
   const er=examResult(x);
   ev.push({d:x.submitted_at,t:'exam',s:x.exams?.subject||'',n:x.exams?.title||'Exam',
     z:`Score ${Math.round(Number(er?.percentage||0))}%`,kind:'exam'})
 });
 ev.sort((a,b)=>new Date(b.d)-new Date(a.d));
 h.innerHTML=ev.length?ev.slice(0,10).map(x=>`<div class="timeline-item">
   <i class="${esc(x.t)}"></i>
   <div class="timeline-copy">
     <span>${esc(String(x.t).toUpperCase())} · ${esc(x.s)}</span>
     <strong>${esc(x.n)}</strong>
     <small>${esc(x.z)}</small>
   </div>
   <div class="study-history-right">
     <time>${new Date(x.d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</time>
     ${x.kind==='study' && x.source!=='system_reconciliation' ? `<div class="study-history-actions">
        <button class="study-history-dots" type="button" data-study-menu="${x.id}" aria-label="Study entry actions">⋮</button>
        <div class="study-history-menu" data-study-menu-box="${x.id}">
          <button type="button" data-study-edit="${x.id}">EDIT</button>
          <button type="button" class="danger" data-study-delete="${x.id}">DELETE</button>
        </div>
      </div>`:''}
   </div>
 </div>`).join('')
 :'<div class="empty-state">Your study, revision and exam history will appear here.</div>';
}
function renderGuide(due){const g=el('guidanceLine');if(!g)return;const pending=tasks.filter(x=>x.status==='pending'&&x.target_date<=today());if(pending.length)g.textContent=`Today's first priority: ${pending[0].subject} — ${pending[0].topic}.`;else if(due.length)g.textContent=`Revision due: ${due[0].topic_title}. Revise this before starting a new topic.`;else if(Number(overview?.completed_topics||0)===0)g.textContent='Start with one official syllabus topic in Learning Progress. Complete it clearly before moving ahead.';else if(sessions.some(x=>x.session_date===today()))g.textContent='Good work today. Finish with a short revision or question-practice block.';else g.textContent='Choose one syllabus topic, study with focus, and record your progress.'}
if(el('todayTasks'))el('todayTasks').onclick=async e=>{const b=e.target.closest('[data-task]');if(!b)return;const r=await c.from('preparation_tasks').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',b.dataset.task);if(r.error)return toast(r.error.message);toast('Task completed');load()};
if(el('revisionList'))el('revisionList').onclick=async e=>{const b=e.target.closest('[data-revise]');if(!b)return;const r=await c.rpc('update_my_learning_progress',{p_topic_id:Number(b.dataset.revise),p_status:null,p_add_study_minutes:0,p_add_questions:0,p_mark_revision:true,p_test_score:null});if(r.error)return toast(r.error.message);toast('Revision recorded');load()};

function fillEditStudyUnits(){
 const subject=el('editStudySubject')?.value||'Physics';
 const current=el('editStudyUnit')?.value;
 const units=[...new Map(syllabus.filter(x=>x.subject===subject).map(x=>[String(x.unit_no),x.unit_title])).entries()];
 if(el('editStudyUnit')){
   el('editStudyUnit').innerHTML=units.map(([n,t])=>`<option value="${n}">Unit ${n} — ${esc(t)}</option>`).join('');
   if(current&&[...el('editStudyUnit').options].some(o=>o.value===current))el('editStudyUnit').value=current;
 }
 fillEditStudyTopics();
}
function fillEditStudyTopics(){
 const subject=el('editStudySubject')?.value||'Physics';
 const unit=String(el('editStudyUnit')?.value||'');
 const current=el('editStudyTopic')?.value;
 const rows=syllabus.filter(x=>x.subject===subject&&String(x.unit_no)===unit);
 if(el('editStudyTopic')){
   el('editStudyTopic').innerHTML=rows.map(x=>`<option value="${x.topic_id}">${esc(x.topic_title)}</option>`).join('');
   if(current&&[...el('editStudyTopic').options].some(o=>o.value===current))el('editStudyTopic').value=current;
 }
}
function toggleEditPracticeFields(){
 const show=el('editStudyType')?.value==='practice';
 document.querySelectorAll('.edit-practice-field').forEach(x=>x.style.display=show?'block':'none');
 if(!show){
   if(el('editStudyQuestions'))el('editStudyQuestions').value=0;
   if(el('editStudyCorrect'))el('editStudyCorrect').value=0;
 }
}
function openEditStudy(sessionId){
 const row=sessions.find(x=>String(x.id)===String(sessionId));if(!row)return toast('Study entry not found');
 if(row.source==='system_reconciliation')return toast('This historical sync entry cannot be edited');
 const topic=syllabus.find(x=>Number(x.topic_id)===Number(row.topic_id));
 el('editStudySessionId').value=row.id;
 el('editStudySubject').value=topic?.subject||row.subject||'Physics';
 fillEditStudyUnits();
 if(topic){
   el('editStudyUnit').value=String(topic.unit_no);
   fillEditStudyTopics();
   el('editStudyTopic').value=String(topic.topic_id);
 }
 el('editStudyType').value=row.activity_type||'learning';
 el('editStudyMinutes').value=Number(row.minutes||0);
 el('editStudyQuestions').value=Number(row.questions_attempted||0);
 el('editStudyCorrect').value=Number(row.correct_answers||0);
 el('editStudyCompleted').checked=!!row.marked_completed;
 toggleEditPracticeFields();
 el('editStudyModal')?.classList.add('open');
}

if(el('prepTimeline'))el('prepTimeline').onclick=async e=>{
 const menuBtn=e.target.closest('[data-study-menu]');
 if(menuBtn){
   e.preventDefault();
   e.stopPropagation();
   const id=String(menuBtn.dataset.studyMenu);
   const target=document.querySelector(`[data-study-menu-box="${id}"]`);
   const wasOpen=target?.classList.contains('is-open');
   document.querySelectorAll('.study-history-menu').forEach(m=>m.classList.remove('is-open'));
   if(target && !wasOpen)target.classList.add('is-open');
   return;
 }

 const editBtn=e.target.closest('[data-study-edit]');
 if(editBtn){
   e.preventDefault();
   e.stopPropagation();
   document.querySelectorAll('.study-history-menu').forEach(m=>m.classList.remove('is-open'));
   openEditStudy(editBtn.dataset.studyEdit);
   return;
 }

 const deleteBtn=e.target.closest('[data-study-delete]');
 if(deleteBtn){
   e.preventDefault();
   e.stopPropagation();
   document.querySelectorAll('.study-history-menu').forEach(m=>m.classList.remove('is-open'));
   const row=sessions.find(x=>String(x.id)===String(deleteBtn.dataset.studyDelete));
   if(!row)return toast('Study entry not found');
   if(!confirm(`Delete this study entry?\n\n${row.subject} — ${row.topic}\n${formatMinutes(row.minutes)}\n\nThis will recalculate your progress.`))return;
   const r=await c.rpc('delete_my_study_session',{p_session_id:row.id});
   if(r.error)return toast(r.error.message);
   toast('Study entry deleted');
   await load();
 }
};
document.addEventListener('click',e=>{
 if(!e.target.closest('.study-history-actions')){
   document.querySelectorAll('.study-history-menu').forEach(m=>m.classList.remove('is-open'));
 }
});
if(el('editStudySubject'))el('editStudySubject').addEventListener('change',fillEditStudyUnits);
if(el('editStudyUnit'))el('editStudyUnit').addEventListener('change',fillEditStudyTopics);
if(el('editStudyType'))el('editStudyType').addEventListener('change',toggleEditPracticeFields);
['closeEditStudyModal','cancelEditStudy'].forEach(id=>{if(el(id))el(id).onclick=()=>el('editStudyModal')?.classList.remove('open')});
if(el('editStudyForm'))el('editStudyForm').onsubmit=async e=>{
 e.preventDefault();
 const sessionId=el('editStudySessionId')?.value;
 const topicId=Number(el('editStudyTopic')?.value||0);
 const type=el('editStudyType')?.value||'learning';
 const min=Number(el('editStudyMinutes')?.value||0);
 const q=Number(el('editStudyQuestions')?.value||0);
 const ca=Number(el('editStudyCorrect')?.value||0);
 const completed=!!el('editStudyCompleted')?.checked;
 if(!sessionId||!topicId)return toast('Select an official syllabus topic');
 if(min<0||min>1440)return toast('Check study time');
 if(q<0||ca<0||ca>q)return toast('Check questions and correct answers');
 const r=await c.rpc('edit_my_study_session',{
   p_session_id:sessionId,
   p_topic_id:topicId,
   p_activity_type:type,
   p_minutes:min,
   p_questions:q,
   p_correct:ca,
   p_mark_completed:completed
 });
 if(r.error)return toast(r.error.message);
 el('editStudyModal')?.classList.remove('open');
 toast('Study entry updated');
 await load();
};

if(el('studyForm'))el('studyForm').onsubmit=async e=>{e.preventDefault();const topicId=Number(el('studyTopic')?.value||0),selected=syllabus.find(x=>Number(x.topic_id)===topicId),type=el('studyType')?.value||'learning',min=Number(el('studyMinutes')?.value||0),q=Number(el('studyQuestions')?.value||0),ca=Number(el('studyCorrect')?.value||0),markCompleted=!!el('studyCompleted')?.checked;if(!selected)return toast('Select an official syllabus topic');if(min<1)return toast('Enter study time');if(q<0||ca<0||ca>q)return toast('Check questions and correct answers');if(type==='revision'&&!['completed','revised','tested'].includes(selected.status))return toast('Complete this topic before marking revision');const r=await c.rpc('log_my_syllabus_study',{p_topic_id:topicId,p_activity_type:type,p_minutes:min,p_questions:q,p_correct:ca,p_mark_completed:markCompleted});if(r.error)return toast(r.error.message);el('studyModal').classList.remove('open');el('studyCompleted').checked=false;toast('Study Log + Learning Progress updated');await load()};
['logStudyBtn','logStudyBtn2'].forEach(id=>{if(el(id))el(id).onclick=()=>{fillStudyUnits();toggleStudyPracticeFields();el('studyModal')?.classList.add('open')}});['closeStudyModal','cancelStudy'].forEach(id=>{if(el(id))el(id).onclick=()=>el('studyModal')?.classList.remove('open')});if(el('studySubject'))el('studySubject').addEventListener('change',fillStudyUnits);if(el('studyUnit'))el('studyUnit').addEventListener('change',fillStudyTopics);if(el('studyType'))el('studyType').addEventListener('change',toggleStudyPracticeFields);if(el('logoutBtn'))el('logoutBtn').onclick=async()=>{await c.auth.signOut();location.replace('index.html#student-portal')};if(el('menuBtn'))el('menuBtn').onclick=()=>el('sidebar')?.classList.toggle('open');
(async()=>{profile=await auth();if(!profile)return;if(el('studentName'))el('studentName').textContent=profile.full_name||'Student';if(el('welcomeName'))el('welcomeName').textContent=profile.full_name||'Student';if(el('studentCode'))el('studentCode').textContent='ID: '+(profile.student_id||'—');countdown();setInterval(countdown,1000);await load()})();
})();
