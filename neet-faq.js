
(()=>{
  const items=[...document.querySelectorAll('.faq-item')];
  const search=document.getElementById('faqSearch');
  const heroSearch=document.getElementById('heroSearch');
  const filters=[...document.querySelectorAll('[data-category]')];
  const count=document.getElementById('visibleCount');
  const empty=document.getElementById('faqEmpty');
  let category='All';

  function syncSearch(value,source){
    if(source!==search) search.value=value;
    if(source!==heroSearch) heroSearch.value=value;
  }

  function render(){
    const q=(search.value||'').trim().toLowerCase();
    let visible=0;

    items.forEach(item=>{
      const categoryMatch=category==='All'||item.dataset.category===category;
      const text=item.textContent.toLowerCase();
      const searchMatch=!q||text.includes(q);
      const show=categoryMatch&&searchMatch;
      item.hidden=!show;
      if(show){
        visible++;
        if(q)item.open=true;
      }
    });

    count.textContent=visible;
    empty.hidden=visible!==0;
  }

  [search,heroSearch].forEach(input=>{
    input.addEventListener('input',()=>{
      syncSearch(input.value,input);
      render();
      if(input===heroSearch && input.value.trim()){
        document.querySelector('.faq-section')?.scrollIntoView({behavior:'smooth',block:'start'});
      }
    });
  });

  filters.forEach(btn=>btn.addEventListener('click',()=>{
    category=btn.dataset.category;
    filters.forEach(x=>x.classList.toggle('active',x===btn));
    render();
  }));

  document.getElementById('expandFaqs').addEventListener('click',()=>{
    items.filter(x=>!x.hidden).forEach(x=>x.open=true);
  });
  document.getElementById('collapseFaqs').addEventListener('click',()=>{
    items.filter(x=>!x.hidden).forEach(x=>x.open=false);
  });

  render();
})();
