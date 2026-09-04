(()=>{
  const c=window.sgaSupabase;
  const rows=document.getElementById('rows');
  const search=document.getElementById('search');
  const countLine=document.getElementById('countLine');
  const toolbar=document.querySelector('.toolbar');
  if(!c||!rows||!search||!countLine||!toolbar)return;

  const style=document.createElement('style');
  style.id='adminExamsEnhancementStyles';
  style.textContent=`
    .scope-box.exam-coverage-box{background:#fff;border-color:#cbd9eb;padding:15px 16px;box-shadow:0 3px 12px rgba(6,39,95,.04)}
    .scope-box.exam-coverage-box .scope-head{margin-bottom:12px}.scope-box.exam-coverage-box .scope-head b{font-size:13px;color:#06275f}.scope-box.exam-coverage-box .scope-head .subtle{margin-top:3px;color:#6c7d94}
    .exam-folders{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 18px}.exam-folder-btn{display:flex;align-items:center;gap:10px;min-width:180px;padding:11px 13px;border:1px solid #d6e0ec;border-radius:10px;background:#fff;color:#17355d;cursor:pointer;text-align:left;box-shadow:0 3px 10px rgba(6,39,95,.04)}
    .exam-folder-btn:hover{border-color:#aebed3}.exam-folder-btn.active{background:#eef4fb;border-color:#8fa8c8;color:#06275f}.exam-folder-mark{position:relative;width:27px;height:20px;border-radius:4px;background:#dce8f7;flex:0 0 27px}.exam-folder-mark:before{content:"";position:absolute;left:2px;top:-5px;width:11px;height:6px;border-radius:3px 3px 0 0;background:#b9cee8}.exam-folder-btn.active .exam-folder-mark{background:#06275f}.exam-folder-btn.active .exam-folder-mark:before{background:#f28c28}.exam-folder-copy{display:flex;flex-direction:column;gap:2px}.exam-folder-copy b{font-size:12px}.exam-folder-copy small{font-size:10px;color:#718198}.exam-folder-btn.active .exam-folder-copy small{color:#607794}
  `;
  document.head.appendChild(style);

  const coverage=document.querySelector('.scope-box');
  if(coverage){
    coverage.classList.add('exam-coverage-box');
    const heading=coverage.querySelector('.scope-head b');
    const note=coverage.querySelector('.scope-head .subtle');
    if(heading)heading.textContent='Exam Coverage';
    if(note)note.textContent='Subject → Unit → Chapter → Whole Chapter / Specific Topic. Use Add Scope only for mixed or multi-chapter exams.';
  }

  let activeKey='current';
  let grouped={current:[],months:[]};
  let folderHost=null;

  const idSetForActive=()=>{
    if(activeKey==='current')return new Set(grouped.current.map(x=>String(x.id)));
    const month=grouped.months.find(x=>x.key===activeKey);
    return new Set((month?.exams||[]).map(x=>String(x.id)));
  };
  const activeLabel=()=>activeKey==='current'?'Current Exams':(grouped.months.find(x=>x.key===activeKey)?.label||'Exams');

  function applyFolder(){
    const allowed=idSetForActive();
    let visible=0;
    rows.querySelectorAll('tr').forEach(tr=>{
      const id=tr.querySelector('[data-id]')?.dataset.id;
      if(!id){tr.style.display=allowed.size?'none':'';return;}
      const show=allowed.has(String(id));
      tr.style.display=show?'':'none';
      if(show)visible++;
    });
    countLine.textContent=`${activeLabel()} • ${visible} exam${visible===1?'':'s'} shown`;
    folderHost?.querySelectorAll('.exam-folder-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.key===activeKey));
  }

  function renderFolders(){
    if(!folderHost){folderHost=document.createElement('div');folderHost.id='examFolders';folderHost.className='exam-folders';toolbar.insertAdjacentElement('afterend',folderHost);}
    const items=[{key:'current',label:'Current Exams',count:grouped.current.length},...grouped.months.map(m=>({key:m.key,label:m.label,count:m.exams.length}))];
    folderHost.innerHTML=items.map(item=>`<button type="button" class="exam-folder-btn ${item.key===activeKey?'active':''}" data-key="${item.key}"><span class="exam-folder-mark"></span><span class="exam-folder-copy"><b>${item.label}</b><small>${item.count} exam${item.count===1?'':'s'}</small></span></button>`).join('');
    folderHost.onclick=e=>{const btn=e.target.closest('.exam-folder-btn');if(!btn)return;activeKey=btn.dataset.key;applyFolder();};
    applyFolder();
  }

  async function loadFolders(){
    try{
      const [{data:exams,error:examError},{data:attempts,error:attemptError},archive]=await Promise.all([
        c.from('exams').select('id,created_at').order('created_at',{ascending:false}),
        c.from('exam_attempts').select('exam_id,status,submitted_at').eq('status','submitted').not('submitted_at','is',null),
        import('./exam-archive-utils.mjs?v=20260905-1')
      ]);
      if(examError)throw examError;if(attemptError)throw attemptError;
      grouped=archive.groupExamArchive(exams||[],attempts||[]);
      activeKey=grouped.current.length?'current':(grouped.months[0]?.key||'current');
      renderFolders();
    }catch(err){
      console.error('Exam archive folders:',err);
    }
  }

  const observer=new MutationObserver(()=>queueMicrotask(applyFolder));
  observer.observe(rows,{childList:true,subtree:false});
  search.addEventListener('input',()=>requestAnimationFrame(applyFolder));
  loadFolders();
})();
