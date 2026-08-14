(() => {
  const modal = document.getElementById('welcomeModal');
  const openBtn = document.getElementById('openWelcome');
  const poster = 'assets/welcome-poster.png';

  function openModal(){
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
  }
  function closeModal(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  }

  openBtn?.addEventListener('click', openModal);
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
  document.getElementById('openPosterTab')?.addEventListener('click', () => window.open(poster, '_blank', 'noopener'));

  const pw = document.getElementById('password');
  const toggle = document.getElementById('togglePassword');
  toggle?.addEventListener('click', () => {
    if(!pw) return;
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    toggle.textContent = show ? '◌' : '◉';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  // Smooth vertical auto-scroll for notifications. Pauses on hover/focus/touch.
  const windowEl = document.getElementById('notificationsWindow');
  const list = document.getElementById('notificationsList');
  if(windowEl && list && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    list.insertAdjacentHTML('beforeend', list.innerHTML);
    let paused = false;
    const pause = () => paused = true;
    const resume = () => paused = false;
    ['mouseenter','focusin','touchstart'].forEach(ev => windowEl.addEventListener(ev, pause, {passive:true}));
    ['mouseleave','focusout','touchend'].forEach(ev => windowEl.addEventListener(ev, resume, {passive:true}));

    let last = performance.now();
    function tick(now){
      if(!paused && now - last > 25){
        windowEl.scrollTop += 1;
        if(windowEl.scrollTop >= list.scrollHeight / 2) windowEl.scrollTop = 0;
        last = now;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
