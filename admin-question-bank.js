(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),requestedExam=params.get('exam');
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[ch]));
let summary={total:0,subjects:[]},exams=[],subject=null,chapter=null,topic=null,questions=[],total=0,hasMore=false,loading=false,searchTimer=null,modalIds=[];
const selected=new Set(),questionCache=new Map();
const {data:{session}}=await c.auth.getSession();
if(!session)return location.replace('admin-login.html');
const {data:me}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();
if(!me||me.role!=='admin'||!me.is_active)return location.replace('admin-login.html');
async function invoke(body){const {data,error}=await c.functions.invoke('admin-question-bank',{body});if(error){let d=null;try{d=await error.context?.json?.()}catch(_){}throw new Error(d?.error||error.message||'Question Bank operation failed.')}if(data?.error)throw new Error(data.error);return data}
function setStats(){
 $('sTotal').textContent=summary.total||0;
 for(const [id,name] of [['sPhysics','Physics'],['sChemistry','Chemistry'],['sBiology','Biology']])$(''+id).textContent=summary.subjects.find(x=>x.subject===name)?.count||0;
}
function folderButton(title,meta,icon,attrs=''){return `<button class="folder-card" type="button" ${attrs}><span class="folder-icon">${esc(icon)}</span><span class="folder-title">${esc(title)}</span><span class="folder-meta">${esc(meta)}</span></button>`}
function showFolders(){
 $('qbFolderHost').style.display='grid';
 $('qbQuestionHost').hidden=true;
 $('qbQuestionTools').classList.remove('show');
 $('qbQuestionActions').classList.remove('show');
}
function renderBreadcrumb(){
 const parts=[`<button type="button" data-back="root">Question Bank</button>`];
 if(subject)parts.push(`<span>›</span><button type="button" data-back="subject">${esc(subject.subject)}</button>`);
 if(chapter)parts.push(`<span>›</span><button type="button" data-back="chapter">${esc(chapter.title)}</button>`);
 if(topic)parts.push(`<span>›</span><strong>${esc(topic.title)}</strong>`);
 $('qbBreadcrumb').innerHTML=parts.join('');
}
function renderSubjects(){
 subject=chapter=topic=null;questions=[];total=0;hasMore=false;showFolders();renderBreadcrumb();
 $('qbFolderHost').innerHTML=summary.subjects.map((item,index)=>folderButton(item.subject,`${item.count} permanent question(s)`,String(index+1),`data-subject="${esc(item.subject)}"`)).join('');
}
function renderChapters(item=subject){
 subject=item;chapter=topic=null;questions=[];total=0;hasMore=false;showFolders();renderBreadcrumb();
 const rows=item?.chapters||[];
 $('qbFolderHost').innerHTML=rows.length?rows.map((row,index)=>folderButton(row.title,`${row.unitTitle}${row.unitNo!=null?` • Unit ${row.unitNo}`:''} • ${row.count} question(s)`,String(index+1),`data-chapter="${row.id}"`)).join(''):'<div class="empty">No chapters are available in this subject.</div>';
}
function renderTopics(item=chapter){
 chapter=item;topic=null;questions=[];total=0;hasMore=false;showFolders();renderBreadcrumb();
 const rows=item?.topics||[];
 $('qbFolderHost').innerHTML=rows.length?rows.map((row,index)=>folderButton(row.title,`${row.count} question(s)`,String(index+1),`data-topic="${row.id}"`)).join(''):'<div class="empty">No approved topics are available in this chapter.</div>';
}
function dateParts(value){
 if(!value)return['—','—'];const d=new Date(value);if(Number.isNaN(d.getTime()))return['—','—'];
 return[d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})];
}
function renderQuestionRows(){
 const body=$('qbQuestionBody');
 body.innerHTML=questions.length?questions.map(q=>{const [date,time]=dateParts(q.created_at);return `<tr><td><input class="pick" type="checkbox" data-id="${esc(q.id)}" ${selected.has(String(q.id))?'checked':''}></td><td class="qtext">${esc(q.question_text)}</td><td><span class="tag">${esc(q.difficulty||'—')}</span></td><td>${esc(q.question_type||'—')}</td><td>${esc(q.source_label||'—')}${q.source_year?`<br><small>${esc(q.source_year)}</small>`:''}</td><td class="datecell">${esc(date)}<br><small>${esc(time)}</small></td><td>${Number(q.default_marks||0)}</td><td><button class="btn add-one" type="button" data-add="${esc(q.id)}">ADD</button></td></tr>`}).join(''):'<tr><td colspan="8">No questions found in this topic.</td></tr>';
 $('selectedCount').textContent=`${selected.size} selected`;
 $('selectAll').checked=questions.length>0&&questions.every(q=>selected.has(String(q.id)));
 $('loadState').textContent=loading?'Loading...':`Showing ${questions.length} of ${total}`;
 $('qbLoadMore').hidden=!hasMore;
}
async function loadTopicQuestions(reset=true){
 if(!topic||!chapter||!subject||loading)return;
 loading=true;if(reset){questions=[];total=0;hasMore=false}renderQuestionRows();
 try{
  const data=await invoke({action:'topic_questions',subject:subject.subject,unitId:chapter.unitId,chapterId:chapter.id,subtopicId:topic.id,sort:$('qbSort').value,search:$('qbSearch').value.trim(),limit:50,offset:reset?0:questions.length});
  const next=data.questions||[];for(const q of next)questionCache.set(String(q.id),q);
  questions=reset?next:questions.concat(next);total=Number(data.total||0);hasMore=Boolean(data.hasMore);
 }catch(err){if(reset)questions=[];$('loadState').textContent=err.message||'Unable to load questions.'}
 finally{loading=false;renderQuestionRows()}
}
async function openTopic(item){
 topic=item;renderBreadcrumb();$('qbFolderHost').style.display='none';$('qbQuestionHost').hidden=false;$('qbQuestionTools').classList.add('show');$('qbQuestionActions').classList.add('show');$('qbSearch').value='';$('qbSort').value='newest';await loadTopicQuestions(true);
}
function openCopy(ids){
 modalIds=[...new Set(ids.map(String))].filter(Boolean);if(!modalIds.length)return alert('Select at least one question.');
 const list=modalIds.map(id=>questionCache.get(id)).filter(Boolean);
 $('copyPreview').innerHTML=list.slice(0,20).map(q=>`<div><b>${esc(q.subject)} • ${esc(topic?.title||'Topic')}</b><br>${esc(q.question_text)}</div>`).join('')+(list.length>20?`<div>+ ${list.length-20} more</div>`:'');
 $('copyMsg').className='msg';$('copyMsg').textContent='';$('copyModal').classList.add('open');
}
async function load(){
 $('qbFolderHost').innerHTML='<div class="empty">Loading Question Bank folders...</div>';
 const [bank,er]=await Promise.all([invoke({action:'folder_summary'}),c.from('exams').select('id,title,subject,is_published,status').order('created_at',{ascending:false})]);
 if(er.error)throw er.error;summary={total:Number(bank.total||0),subjects:bank.subjects||[]};exams=(er.data||[]).filter(e=>!e.is_published&&e.status!=='completed');
 $('targetExam').innerHTML='<option value="">Select target exam</option>'+exams.map(e=>`<option value="${esc(e.id)}">${esc(e.title)} — ${esc(e.subject)}</option>`).join('');
 if(requestedExam&&[...$('targetExam').options].some(o=>o.value===requestedExam))$('targetExam').value=requestedExam;
 setStats();renderSubjects();
}
$('qbFolderHost').onclick=e=>{
 const s=e.target.closest('[data-subject]');if(s){const item=summary.subjects.find(x=>x.subject===s.dataset.subject);if(item)renderChapters(item);return}
 const ch=e.target.closest('[data-chapter]');if(ch){const item=subject?.chapters?.find(x=>String(x.id)===ch.dataset.chapter);if(item)renderTopics(item);return}
 const t=e.target.closest('[data-topic]');if(t){const item=chapter?.topics?.find(x=>String(x.id)===t.dataset.topic);if(item)openTopic(item)}
};
$('qbBreadcrumb').onclick=e=>{const back=e.target.closest('[data-back]')?.dataset.back;if(back==='root')renderSubjects();else if(back==='subject'&&subject)renderChapters(subject);else if(back==='chapter'&&chapter)renderTopics(chapter)};
$('qbQuestionBody').onchange=e=>{if(!e.target.classList.contains('pick'))return;const id=String(e.target.dataset.id);e.target.checked?selected.add(id):selected.delete(id);renderQuestionRows()};
$('qbQuestionBody').onclick=e=>{const btn=e.target.closest('[data-add]');if(!btn)return;openCopy([String(btn.dataset.add)])};
$('selectAll').onchange=e=>{questions.forEach(q=>e.target.checked?selected.add(String(q.id)):selected.delete(String(q.id)));renderQuestionRows()};
$('copySelected').onclick=()=>openCopy([...selected]);
$('qbLoadMore').onclick=()=>loadTopicQuestions(false);
$('qbSort').onchange=()=>loadTopicQuestions(true);
$('qbSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadTopicQuestions(true),280)};
$('qbClearSearch').onclick=()=>{$('qbSearch').value='';loadTopicQuestions(true)};
$('cancelCopy').onclick=()=>$('copyModal').classList.remove('open');
$('confirmCopy').onclick=async()=>{
 const examId=$('targetExam').value;if(!examId)return $('copyMsg').textContent='Select a target draft exam.';
 const ids=modalIds.slice(),target=exams.find(e=>String(e.id)===String(examId));if(!ids.length)return;
 if(!confirm(`Add ${ids.length} selected bank question(s) to ${target?.title||'this exam'} with automatic mapping?`))return;
 const btn=$('confirmCopy');btn.disabled=true;btn.textContent='ADDING...';
 try{const data=await invoke({action:'add_to_exam',examId,bankIds:ids});$('copyMsg').className='msg ok';$('copyMsg').textContent=`${data.added||ids.length} question(s) added and mapped.`;ids.forEach(id=>selected.delete(String(id)));modalIds=[];setTimeout(()=>{location.href='admin-exam-questions.html?exam='+encodeURIComponent(examId)},650)}catch(err){$('copyMsg').className='msg error';$('copyMsg').textContent=err.message}finally{btn.disabled=false;btn.textContent='ADD TO EXAM'}
};
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
try{await load()}catch(err){$('qbFolderHost').innerHTML=`<div class="empty">${esc(err.message||'Unable to load Question Bank.')}</div>`}
})();