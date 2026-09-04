(()=>{
  const host=document.getElementById('examSectionNav');
  if(!host)return;

  if(!document.getElementById('examinationBranchStyles')){
    const link=document.createElement('link');
    link.id='examinationBranchStyles';
    link.rel='stylesheet';
    link.href='examination-branch-shell.css?v=20260904-1';
    document.head.appendChild(link);
  }

  const header=document.querySelector('main > header');
  const title=header?.querySelector('h1');
  const subtitle=header?.querySelector('p');
  if(title)title.textContent='EXAMINATION BRANCH';
  if(subtitle)subtitle.textContent='Create • Conduct • Evaluate • Analyse';

  const items=[
    ['admin-exams.html','01','Exams','Create & Manage Exams'],
    ['admin-question-bank.html','02','Question Bank','Questions & Mapping'],
    ['admin-results.html','03','Results','Publish & Review Results'],
    ['admin-performance.html','04','Performance','Student Exam Analysis'],
    ['admin-manual-exams.html','05','Manual Exams','Offline / Manual Records']
  ];
  const current=(location.pathname.split('/').pop()||'admin-exams.html').toLowerCase();
  host.className='examination-branch-shell';
  host.innerHTML=`<nav class="exam-section-nav branch-nav" aria-label="Examination Branch sections">${items.map(([href,no,label,desc])=>`<a href="${href}" class="exam-nav-card ${current===href.toLowerCase()?'active':''}"><span class="exam-nav-number">${no}</span><span class="exam-nav-copy"><b>${label}</b><small>${desc}</small></span></a>`).join('')}</nav>`;

  function loadScript(id,src,onload){
    const existing=document.getElementById(id);
    if(existing){if(onload)existing.dataset.loaded==='1'?onload():existing.addEventListener('load',onload,{once:true});return;}
    const script=document.createElement('script');script.id=id;script.src=src;script.onload=()=>{script.dataset.loaded='1';if(onload)onload()};document.body.appendChild(script);
  }

  if(current==='admin-exams.html'){
    if(!document.getElementById('adminExamsEnhancements')){
      const script=document.createElement('script');
      script.id='adminExamsEnhancements';
      script.src='admin-exams-enhancements.js?v=20260905-1';
      document.body.appendChild(script);
    }
    loadScript('sgaJsPdf','https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>{
      loadScript('sgaJsPdfAutoTable','https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>{
        loadScript('adminExamBlueprint','admin-exam-blueprint.js?v=20260905-1');
      });
    });
  }

  document.querySelectorAll('aside nav a.active').forEach(a=>a.classList.remove('active'));
  const examinationsLink=document.querySelector('aside nav a[href="admin-exams.html"]');
  if(examinationsLink)examinationsLink.classList.add('active');
})();
