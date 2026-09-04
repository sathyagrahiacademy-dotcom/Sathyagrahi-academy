(()=>{
  const host=document.getElementById('examSectionNav');
  if(!host)return;
  const items=[
    ['admin-exams.html','Exams'],
    ['admin-question-bank.html','Question Bank'],
    ['admin-results.html','Results'],
    ['admin-performance.html','Exam Performance'],
    ['admin-manual-exams.html','Manual Exams']
  ];
  const current=(location.pathname.split('/').pop()||'admin-exams.html').toLowerCase();
  host.className='exam-section-nav';
  host.innerHTML=items.map(([href,label])=>`<a href="${href}" class="${current===href.toLowerCase()?'active':''}">${label}</a>`).join('');

  document.querySelectorAll('aside nav a.active').forEach(a=>a.classList.remove('active'));
  const examinationsLink=document.querySelector('aside nav a[href="admin-exams.html"]');
  if(examinationsLink)examinationsLink.classList.add('active');
})();
