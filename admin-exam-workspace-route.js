(()=>{
  if(window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED!==true)return;
  const MASTER_BADGES=new Set(['DT','WT','MT','GT']);
  const masterIds=new Set();

  function scan(){
    masterIds.clear();
    document.querySelectorAll('#rows tr[data-control-row]').forEach(row=>{
      const badge=String(row.querySelector('.type-badge')?.textContent||'').trim().toUpperCase();
      const id=String(row.querySelector('[data-id]')?.dataset?.id||'');
      if(!id||!MASTER_BADGES.has(badge))return;
      row.dataset.masterWorkspace='1';
      masterIds.add(id);
      const actions=row.querySelector('.exam-next');
      if(actions&&!actions.querySelector('.master-workspace-link')){
        const button=document.createElement('button');
        button.type='button';button.className='small-btn master-workspace-link';button.dataset.id=id;button.textContent='WORKSPACE';
        actions.append(' ',button);
      }
    });
  }

  function tabFor(target){
    if(target?.classList?.contains('questions'))return 'questions';
    if(target?.classList?.contains('audience'))return 'students';
    if(target?.dataset?.route==='questions')return 'questions';
    if(target?.dataset?.target==='QUESTIONS')return 'questions';
    if(target?.dataset?.target==='BLUEPRINT')return 'blueprint';
    if(target?.dataset?.target==='STUDENTS')return 'students';
    return 'overview';
  }

  function openWorkspace(id,tab='overview'){
    location.href=`admin-exam-workspace.html?exam=${encodeURIComponent(id)}&tab=${encodeURIComponent(tab)}`;
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('button[data-id]');
    if(!button)return;
    const id=String(button.dataset.id||'');
    const row=button.closest('tr[data-master-workspace="1"]');
    const attention=button.classList.contains('control-fix')&&masterIds.has(id);
    if(!row&&!attention)return;
    event.preventDefault();event.stopImmediatePropagation();
    openWorkspace(id,tabFor(button));
  },true);

  const observer=new MutationObserver(scan);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan();
})();
