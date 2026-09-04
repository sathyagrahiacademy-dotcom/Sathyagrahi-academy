(()=>{
  const $=id=>document.getElementById(id);
  const c=window.sgaSupabase;
  const u=window.ExamScopeUIUtils;
  if(!c||!u)return;

  const form=$('examForm'),scopeRows=$('scopeRows'),modal=$('modal'),rows=$('rows');
  const addBtn=$('addBtn'),addScopeRow=$('addScopeRow'),subject=$('subject'),cancel=$('cancel');
  if(!form||!scopeRows||!modal||!rows||!addBtn||!addScopeRow||!subject)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const subjects=['Physics','Chemistry','Biology'];
  let tree=[],draft=[],editingExamId=null,legacyWithoutScope=false,treeError='';

  async function call(body){
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Admin login required.');
    const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exams`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Exam request failed');
    return d;
  }

  const option=(value,label,selected)=>`<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;
  function defaultSubject(){return subjects.includes(subject.value)?subject.value:'';}
  function addRow(seed={}){
    draft.push({subject:seed.subject||defaultSubject(),unitId:seed.unitId||'',chapterId:seed.chapterId||'',scopeType:seed.scopeType==='topic'?'topic':'chapter',topicName:seed.topicName||'',subtopicId:seed.subtopicId??null});
    render();
  }
  function suggestions(row){return u.activeSubtopicsForChapter(tree,row.chapterId);}
  function render(){
    if(treeError){scopeRows.innerHTML=`<div class="scope-empty">${esc(treeError)}</div>`;return;}
    if(!draft.length){scopeRows.innerHTML='<div class="scope-empty">No structured scope rows. Add one to define official exam coverage.</div>';return;}
    scopeRows.innerHTML=draft.map((row,i)=>{
      const units=u.unitsForSubject(tree,row.subject),chapters=u.chaptersForUnit(tree,row.unitId),subs=suggestions(row);
      const unitDisabled=!row.subject,chapterDisabled=!row.unitId,scopeDisabled=!row.chapterId,topicMode=row.scopeType==='topic';
      const datalist=`scopeTopics-${i}`;
      return `<div class="scope-row scope-row-v2" data-i="${i}">
        <div><label>Subject</label><select class="scope-subject"><option value="">Select Subject</option>${subjects.map(s=>option(s,s,row.subject)).join('')}</select></div>
        <div><label>Unit</label><select class="scope-unit" ${unitDisabled?'disabled':''}><option value="">${unitDisabled?'Select Subject first':'Select Unit'}</option>${units.map(x=>option(x.id,`${x.unit_no?`Unit ${x.unit_no}: `:''}${x.unit_title}`,row.unitId)).join('')}</select></div>
        <div><label>Chapter</label><select class="scope-chapter" ${chapterDisabled?'disabled':''}><option value="">${chapterDisabled?'Select Unit first':'Select Chapter'}</option>${chapters.map(x=>option(x.id,x.topic_title,row.chapterId)).join('')}</select></div>
        <div><label>Scope Type</label><select class="scope-type" ${scopeDisabled?'disabled':''}><option value="chapter" ${row.scopeType==='chapter'?'selected':''}>Whole Chapter</option><option value="topic" ${row.scopeType==='topic'?'selected':''}>Specific Topic</option></select></div>
        ${topicMode?`<div><label>Topic Name</label><input class="scope-topic-name" list="${datalist}" value="${esc(row.topicName)}" placeholder="Type or choose topic" ${scopeDisabled?'disabled':''}><datalist id="${datalist}">${subs.map(x=>`<option value="${esc(x.subtopic_title)}"></option>`).join('')}</datalist></div>`:'<div class="scope-topic-placeholder"><label>Topic Name</label><input value="Whole Chapter" disabled></div>'}
        <button type="button" class="scope-remove">REMOVE</button>
      </div>`;
    }).join('');
  }

  function syncKnownTopic(row){
    if(row.scopeType!=='topic'){row.topicName='';row.subtopicId=null;return;}
    const wanted=u.normalizeTopicName(row.topicName).toLowerCase();
    const hit=suggestions(row).find(x=>u.normalizeTopicName(x.subtopic_title).toLowerCase()===wanted);
    row.subtopicId=hit?.id??null;
  }

  scopeRows.onchange=e=>{
    const host=e.target.closest('.scope-row-v2');if(!host)return;
    const i=Number(host.dataset.i),row=draft[i];if(!row)return;
    if(e.target.classList.contains('scope-subject')){row.subject=e.target.value;row.unitId='';row.chapterId='';row.scopeType='chapter';row.topicName='';row.subtopicId=null;}
    else if(e.target.classList.contains('scope-unit')){row.unitId=e.target.value;row.chapterId='';row.scopeType='chapter';row.topicName='';row.subtopicId=null;}
    else if(e.target.classList.contains('scope-chapter')){row.chapterId=e.target.value;row.scopeType='chapter';row.topicName='';row.subtopicId=null;}
    else if(e.target.classList.contains('scope-type')){row.scopeType=e.target.value==='topic'?'topic':'chapter';if(row.scopeType==='chapter'){row.topicName='';row.subtopicId=null;}}
    else if(e.target.classList.contains('scope-topic-name')){row.topicName=e.target.value;syncKnownTopic(row);}
    render();
  };
  scopeRows.oninput=e=>{
    if(!e.target.classList.contains('scope-topic-name'))return;
    const host=e.target.closest('.scope-row-v2');const row=draft[Number(host?.dataset.i)];if(!row)return;
    row.topicName=e.target.value;syncKnownTopic(row);
  };
  scopeRows.onclick=e=>{const btn=e.target.closest('.scope-remove');if(!btn)return;draft.splice(Number(btn.closest('.scope-row-v2').dataset.i),1);render();};
  addScopeRow.onclick=()=>addRow();

  const oldSubject=subject.onchange;
  subject.onchange=e=>{
    if(typeof oldSubject==='function')oldSubject.call(subject,e);
    const forced=defaultSubject();
    if(forced){for(const row of draft){if(!row.subject){row.subject=forced;row.unitId='';row.chapterId='';row.scopeType='chapter';row.topicName='';row.subtopicId=null;}}}
    render();
  };

  async function ensureTree(){
    if(tree.length||treeError)return;
    try{const d=await call({action:'scope_tree'});tree=d.syllabus||[];treeError='';render();}
    catch(e){treeError=e.message||'Unable to load syllabus';render();}
  }
  function fromSaved(items){return (items||[]).map(x=>({subject:x.subject||'',unitId:x.unitId||'',chapterId:x.chapterId||'',scopeType:x.scopeType==='topic'?'topic':'chapter',topicName:x.subtopicTitle||'',subtopicId:x.subtopicId??null}));}

  const oldAdd=addBtn.onclick;
  addBtn.onclick=e=>{
    if(typeof oldAdd==='function')oldAdd.call(addBtn,e);
    editingExamId=null;legacyWithoutScope=false;draft=[];addRow();ensureTree();
  };
  const oldCancel=cancel?.onclick;
  if(cancel)cancel.onclick=e=>{if(typeof oldCancel==='function')oldCancel.call(cancel,e);editingExamId=null;legacyWithoutScope=false;draft=[];};

  const oldRows=rows.onclick;
  rows.onclick=async e=>{
    const edit=e.target.closest('.edit');
    if(!edit){if(typeof oldRows==='function')return oldRows.call(rows,e);return;}
    if(typeof oldRows==='function')await oldRows.call(rows,e);
    editingExamId=edit.dataset.id;await ensureTree();
    try{
      const d=await call({action:'get_scope',examId:editingExamId});
      draft=fromSaved(d.scopeItems||[]);legacyWithoutScope=!draft.length;
      render();
    }catch(err){$('formMsg').textContent=err.message||'Unable to load exam scope';}
  };

  form.onsubmit=async e=>{
    e.preventDefault();
    const msg=$('formMsg'),btn=$('createBtn');
    if(treeError){msg.textContent=treeError;return;}
    const norm=u.normaliseScopeDraftV2(draft);
    if(!norm.ok){msg.textContent=norm.error;return;}
    if(!editingExamId&&!norm.items.length){msg.textContent='Add at least one syllabus scope row.';return;}
    if(editingExamId&&!legacyWithoutScope&&!norm.items.length){msg.textContent='Structured exam scope cannot be cleared.';return;}
    btn.disabled=true;btn.textContent=editingExamId?'UPDATING...':'CREATING...';msg.textContent=editingExamId?'Updating exam...':'Creating exam...';
    try{
      await call({action:editingExamId?'update':'create',examId:editingExamId||undefined,title:$('title').value.trim(),subject:subject.value,scopeItems:norm.items,durationMinutes:Number($('duration').value),totalMarks:Number($('marks').value),examCode:$('code').value.trim(),examPassword:$('password').value,instructions:$('instructions').value.trim(),negativeMarking:$('negative').checked});
      modal.classList.remove('open');
      alert(editingExamId?'Exam updated successfully.':'Exam created as Draft. Add questions before publishing.');
      location.reload();
    }catch(err){msg.textContent=err.message||'Could not save exam';btn.disabled=false;btn.textContent=editingExamId?'UPDATE EXAM':'CREATE EXAM';}
  };

  ensureTree();
})();
