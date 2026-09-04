(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);let exams=[],questions=[],selected=new Set();
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const {data:{session}}=await c.auth.getSession();if(!session)return location.replace('admin-login.html');const {data:me}=await c.from('profiles').select('role,is_active').eq('id',session.user.id).single();if(!me||me.role!=='admin'||!me.is_active)return location.replace('admin-login.html');
async function invoke(body){const {data,error}=await c.functions.invoke('admin-question-bank',{body});if(error){let d=null;try{d=await error.context?.json?.()}catch(_){}throw new Error(d?.error||error.message||'Question Bank operation failed.')}if(data?.error)throw new Error(data.error);return data}
const unique=(a,key)=>[...new Map(a.map(x=>[String(x[key]??''),x])).values()];
function fillSelect(id,placeholder,rows,key,label){const el=$(id),current=el.value;el.innerHTML=`<option value="all">${placeholder}</option>`+rows.map(x=>`<option value="${esc(x[key])}">${esc(x[label])}</option>`).join('');if([...el.options].some(o=>o.value===current))el.value=current}
function fillValues(id,placeholder,values){const el=$(id),current=el.value;el.innerHTML=`<option value="all">${placeholder}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if([...el.options].some(o=>o.value===current))el.value=current}
function stats(){$('sTotal').textContent=questions.length;for(const [id,name] of [['sPhysics','Physics'],['sChemistry','Chemistry'],['sBiology','Biology']])$(id).textContent=questions.filter(q=>q.subject===name).length}
function refreshFilterOptions(){
 const subject=$('subject').value;
 const bySubject=questions.filter(q=>subject==='all'||q.subject===subject);
 fillSelect('unit','All Units',unique(bySubject,'unit_id').sort((a,b)=>String(a.unitTitle).localeCompare(String(b.unitTitle))),'unit_id','unitTitle');
 const unitNow=$('unit').value;
 const byUnit=bySubject.filter(q=>unitNow==='all'||String(q.unit_id)===unitNow);
 fillSelect('chapter','All Chapters',unique(byUnit,'chapter_id').sort((a,b)=>String(a.chapterTitle).localeCompare(String(b.chapterTitle))),'chapter_id','chapterTitle');
 const chapterNow=$('chapter').value;
 const byChapter=byUnit.filter(q=>chapterNow==='all'||String(q.chapter_id)===chapterNow);
 fillSelect('topic','All Topics',unique(byChapter,'subtopic_id').sort((a,b)=>String(a.topicTitle).localeCompare(String(b.topicTitle))),'subtopic_id','topicTitle');
 fillValues('qtype','All Question Types',[...new Set(questions.map(q=>q.question_type).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))));
 fillValues('source','All Sources',[...new Set(questions.map(q=>q.source_label).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))));
 fillValues('sourceYear','All Years',[...new Set(questions.map(q=>q.source_year).filter(v=>v!==null&&v!==undefined&&v!==''))].sort((a,b)=>Number(b)-Number(a)));
}
function filtered(){const s=$('search').value.trim().toLowerCase(),sub=$('subject').value,unit=$('unit').value,chapter=$('chapter').value,topic=$('topic').value,diff=$('difficulty').value,type=$('qtype').value,source=$('source').value,year=$('sourceYear').value;return questions.filter(q=>{
 const hay=[q.question_text,q.unitTitle,q.chapterTitle,q.topicTitle,q.source_label,q.source_year].join(' ').toLowerCase();
 return(!s||hay.includes(s))&&(sub==='all'||q.subject===sub)&&(unit==='all'||String(q.unit_id)===unit)&&(chapter==='all'||String(q.chapter_id)===chapter)&&(topic==='all'||String(q.subtopic_id)===topic)&&(diff==='all'||q.difficulty===diff)&&(type==='all'||q.question_type===type)&&(source==='all'||q.source_label===source)&&(year==='all'||String(q.source_year)===year)
})}
function render(){const a=filtered();$('rows').innerHTML=a.length?a.map(q=>`<tr><td><input class="pick" type="checkbox" data-id="${q.id}" ${selected.has(q.id)?'checked':''}></td><td><span class="tag">${esc(q.subject)}</span></td><td class="hier"><b>${esc(q.unitTitle||'—')}</b><br>${esc(q.chapterTitle||'—')}<br><small>${esc(q.topicTitle||'—')}</small></td><td class="qtext">${esc(q.question_text)}</td><td>${esc(q.difficulty||'—')}</td><td>${esc(q.question_type||'—')}</td><td>${esc(q.source_label||'—')}${q.source_year?`<br><small>${esc(q.source_year)}</small>`:''}</td><td>${Number(q.default_marks||0)}</td></tr>`).join(''):'<tr><td colspan="8">No questions found.</td></tr>';$('selectedCount').textContent=`${selected.size} selected`;$('selectAll').checked=a.length>0&&a.every(q=>selected.has(q.id))}
async function load(){
 $('loadState').textContent='Loading permanent bank...';
 const [bank,er]=await Promise.all([invoke({action:'list'}),c.from('exams').select('id,title,subject,is_published,status').order('created_at',{ascending:false})]);
 if(er.error)throw er.error;questions=bank.questions||[];exams=(er.data||[]).filter(e=>!e.is_published&&e.status!=='completed');
 $('targetExam').innerHTML='<option value="">Select target exam</option>'+exams.map(e=>`<option value="${e.id}">${esc(e.title)} — ${esc(e.subject)}</option>`).join('');
 stats();refreshFilterOptions();render();$('loadState').textContent=`${questions.length} permanent question(s)`;
}
$('rows').onchange=e=>{if(!e.target.classList.contains('pick'))return;e.target.checked?selected.add(e.target.dataset.id):selected.delete(e.target.dataset.id);render()};
$('selectAll').onchange=e=>{filtered().forEach(q=>e.target.checked?selected.add(q.id):selected.delete(q.id));render()};
$('search').oninput=render;
$('subject').onchange=()=>{refreshFilterOptions();render()};$('unit').onchange=()=>{refreshFilterOptions();render()};$('chapter').onchange=()=>{refreshFilterOptions();render()};$('topic').onchange=render;$('difficulty').onchange=render;$('qtype').onchange=render;$('source').onchange=render;$('sourceYear').onchange=render;
$('clear').onclick=()=>{$('search').value='';$('subject').value='all';$('unit').value='all';$('chapter').value='all';$('topic').value='all';$('difficulty').value='all';$('qtype').value='all';$('source').value='all';$('sourceYear').value='all';refreshFilterOptions();render()};
$('copySelected').onclick=()=>{const a=questions.filter(q=>selected.has(q.id));if(!a.length)return alert('Select at least one question.');$('copyPreview').innerHTML=a.slice(0,20).map(q=>`<div><b>${esc(q.subject)} • ${esc(q.topicTitle)}</b><br>${esc(q.question_text)}</div>`).join('')+(a.length>20?`<div>+ ${a.length-20} more</div>`:'');$('copyMsg').textContent='';$('copyModal').classList.add('open')};$('cancelCopy').onclick=()=>$('copyModal').classList.remove('open');
$('confirmCopy').onclick=async()=>{const examId=$('targetExam').value;if(!examId)return $('copyMsg').textContent='Select a target draft exam.';const ids=[...selected],target=exams.find(e=>e.id===examId);if(!confirm(`Add ${ids.length} selected bank question(s) to ${target?.title||'this exam'} with automatic mapping?`))return;const btn=$('confirmCopy');btn.disabled=true;btn.textContent='ADDING...';try{const data=await invoke({action:'add_to_exam',examId,bankIds:ids});$('copyMsg').className='msg ok';$('copyMsg').textContent=`${data.added||ids.length} question(s) added and mapped.`;selected.clear();setTimeout(()=>{location.href='admin-exam-questions.html?exam='+encodeURIComponent(examId)},650)}catch(err){$('copyMsg').className='msg error';$('copyMsg').textContent=err.message}finally{btn.disabled=false;btn.textContent='ADD TO EXAM'}};
$('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};
try{await load()}catch(err){$('rows').innerHTML=`<tr><td colspan="8">${esc(err.message||'Unable to load Question Bank.')}</td></tr>`;$('loadState').textContent='Load failed'}
})();