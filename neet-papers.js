
(()=>{
 const cards=[...document.querySelectorAll('.paper-card')];
 const buttons=[...document.querySelectorAll('[data-filter]')];
 const input=document.getElementById('paperSearch');
 const none=document.getElementById('noResults');
 let filter='all';

 function apply(){
   const q=(input.value||'').trim();
   let visible=0;
   cards.forEach(card=>{
     const y=card.dataset.year||'';
     const show=(filter==='all'||filter===y)&&(!q||y.includes(q));
     card.hidden=!show;
     if(show)visible++;
   });
   none.hidden=visible>0;
 }
 buttons.forEach(b=>b.addEventListener('click',()=>{
   filter=b.dataset.filter;
   buttons.forEach(x=>x.classList.toggle('active',x===b));
   input.value=filter==='all'?'':filter;
   apply();
 }));
 input.addEventListener('input',()=>{filter='all';buttons.forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));apply()});
})();
