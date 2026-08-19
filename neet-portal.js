
(function(){
  const file=(location.pathname.split('/').pop()||'student-portal.html').toLowerCase();
  document.querySelectorAll('.portal-nav a').forEach(a=>{
    const href=(a.getAttribute('href')||'').toLowerCase();
    if(href===file)a.classList.add('active');
  });

  document.querySelectorAll('.protected-content').forEach(area=>{
    ['copy','cut','contextmenu','dragstart'].forEach(evt=>area.addEventListener(evt,e=>e.preventDefault()));
    area.addEventListener('selectstart',e=>{
      if(!e.target.closest('input,textarea,select,button,a'))e.preventDefault();
    });
  });

  document.querySelectorAll('.faq-q').forEach(btn=>{
    btn.addEventListener('click',()=>btn.closest('.faq-item')?.classList.toggle('open'));
  });

  const hubSearch=document.getElementById('hubSearch');
  if(hubSearch){
    hubSearch.addEventListener('input',()=>{
      const q=hubSearch.value.trim().toLowerCase();
      document.querySelectorAll('.knowledge-card').forEach(card=>{
        card.style.display=!q||card.textContent.toLowerCase().includes(q)?'flex':'none';
      });
    });
  }
})();
