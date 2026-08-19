
(()=>{
  const $=id=>document.getElementById(id);

  const correct=$('correctCount'), wrong=$('wrongCount'), blank=$('blankCount');
  const result=$('scoreResult'), message=$('calcMessage'), warning=$('calcWarning');

  function clamp(v){ v=Number(v)||0; return Math.max(0,Math.min(180,Math.floor(v))); }

  function calculate(){
    const c=clamp(correct.value), w=clamp(wrong.value), b=clamp(blank.value);
    correct.value=c; wrong.value=w; blank.value=b;
    const total=c+w+b;
    const score=(c*4)-w;
    result.textContent=score;
    message.textContent=`${c} correct × 4 − ${w} wrong = ${score} marks`;
    warning.textContent=`Total entered questions: ${total} / 180`;
    warning.classList.toggle('error',total!==180);
  }

  [correct,wrong,blank].forEach(el=>el?.addEventListener('input',calculate));
  calculate();

  const modal=$('patternPosterModal');
  $('openPatternPoster')?.addEventListener('click',()=>{
    modal?.classList.add('open'); modal?.setAttribute('aria-hidden','false');
  });
  $('closePatternPoster')?.addEventListener('click',()=>{
    modal?.classList.remove('open'); modal?.setAttribute('aria-hidden','true');
  });
  modal?.addEventListener('click',e=>{
    if(e.target===modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');}
  });
})();
