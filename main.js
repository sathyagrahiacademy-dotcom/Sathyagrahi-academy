(() => {
  const modal = document.getElementById('welcomeModal');
  const openBtn = document.getElementById('openWelcome');
  const poster = 'assets/welcome-poster.png';

  function openModal(){
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
  }
  function closeModal(){
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden','true');
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

  // Student login: 10-digit Student ID + password.
  const loginForm = document.getElementById('studentLoginForm');
  const studentIdInput = document.getElementById('studentId');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  function setLoginMessage(message, type = '') {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = 'login-message' + (type ? ` ${type}` : '');
  }

  studentIdInput?.addEventListener('input', () => {
    studentIdInput.value = studentIdInput.value.replace(/\D/g, '').slice(0, 10);
  });

  forgotPasswordLink?.addEventListener('click', async (event) => {
    event.preventDefault();

    const studentId = (studentIdInput?.value || '').trim();

    if (!/^\d{10}$/.test(studentId)) {
      setLoginMessage('Enter your valid 10-digit Student ID first, then click Forgot Password.', 'error');
      studentIdInput?.focus();
      return;
    }

    if (!window.SGA_SUPABASE_URL || !window.SGA_SUPABASE_PUBLISHABLE_KEY) {
      setLoginMessage('Password recovery service is unavailable. Please refresh and try again.', 'error');
      return;
    }

    const originalText = forgotPasswordLink.textContent;
    forgotPasswordLink.textContent = 'SENDING RESET LINK...';
    forgotPasswordLink.style.pointerEvents = 'none';
    forgotPasswordLink.setAttribute('aria-disabled', 'true');
    setLoginMessage('Checking your Student ID and sending the reset link...');

    try {
      const redirectTo = new URL('student-reset-password.html', window.location.href).href;

      const response = await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/student-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SGA_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ studentId, redirectTo })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error('Unable to start password recovery. Please try again.');
      }

      setLoginMessage(
        payload?.message || 'If the Student ID is registered, a password reset link has been sent to the registered email.',
        'success'
      );
    } catch (error) {
      setLoginMessage(error?.message || 'Unable to send the reset link. Please try again.', 'error');
    } finally {
      forgotPasswordLink.textContent = originalText || 'Forgot Password?';
      forgotPasswordLink.style.pointerEvents = '';
      forgotPasswordLink.removeAttribute('aria-disabled');
    }
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const studentId = (studentIdInput?.value || '').trim();
    const password = pw?.value || '';

    if (!/^\d{10}$/.test(studentId)) {
      setLoginMessage('Please enter a valid 10-digit Student ID.', 'error');
      studentIdInput?.focus();
      return;
    }
    if (!password) {
      setLoginMessage('Please enter your password.', 'error');
      pw?.focus();
      return;
    }
    if (!window.sgaSupabase || !window.SGA_SUPABASE_URL) {
      setLoginMessage('Login service is unavailable. Please refresh and try again.', 'error');
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'SIGNING IN...';
    setLoginMessage('Verifying your account...');

    try {
      const response = await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/student-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SGA_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ studentId, password })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.session?.access_token || !payload?.session?.refresh_token) {
        throw new Error(payload?.error || 'Invalid Student ID or password');
      }

      const { error: sessionError } = await window.sgaSupabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token
      });
      if (sessionError) throw sessionError;

      localStorage.setItem('sga_student_summary', JSON.stringify(payload.student || {}));
      setLoginMessage('Login successful. Opening your dashboard...', 'success');
      window.location.href = 'dashboard.html';
    } catch (error) {
      setLoginMessage(error?.message || 'Unable to sign in. Please try again.', 'error');
      loginButton.disabled = false;
      loginButton.textContent = 'LOGIN';
    }
  });

  // Final homepage notification ticker:
  // one real notification at a time, no visible duplicates.
  // Works with 1 notification and with multiple notifications.
  const windowEl = document.getElementById('notificationsWindow');
  const list = document.getElementById('notificationsList');

  let notificationScrollFrame = null;
  let tickerPaused = false;

  function startNotificationScroll(){
    if(!windowEl || !list) return;

    if(notificationScrollFrame){
      cancelAnimationFrame(notificationScrollFrame);
      notificationScrollFrame = null;
    }

    const cleanHtml = list.dataset.cleanHtml || list.innerHTML;
    if(!cleanHtml.trim()) return;

    // Read each REAL notification once.
    const temp = document.createElement('div');
    temp.innerHTML = cleanHtml;
    const notices = [...temp.children].map(el => el.outerHTML);
    if(!notices.length) return;

    windowEl.scrollTop = 0;
    windowEl.style.overflow = 'hidden';

    let index = 0;
    let y = windowEl.clientHeight + 10;
    let last = performance.now();

    function showNotice(i){
      list.innerHTML = notices[i];
      list.style.transform = `translateY(${y}px)`;
      list.style.willChange = 'transform';
    }

    showNotice(index);

    if(!windowEl.dataset.tickerEventsBound){
      const pause = () => tickerPaused = true;
      const resume = () => tickerPaused = false;

      windowEl.addEventListener('mouseenter', pause, {passive:true});
      windowEl.addEventListener('mouseleave', resume, {passive:true});
      windowEl.addEventListener('focusin', pause, {passive:true});
      windowEl.addEventListener('focusout', resume, {passive:true});
      windowEl.addEventListener('touchstart', pause, {passive:true});
      windowEl.addEventListener('touchend', resume, {passive:true});

      windowEl.dataset.tickerEventsBound = '1';
    }

    function tick(now){
      if(!tickerPaused && now - last >= 28){
        y -= 0.75;
        list.style.transform = `translateY(${y}px)`;

        const noticeHeight = Math.max(45, list.scrollHeight);

        // When the current notice is fully above the window,
        // load the next real notification and start again from bottom.
        if(y <= -(noticeHeight + 12)){
          index = (index + 1) % notices.length;
          y = windowEl.clientHeight + 10;
          showNotice(index);
        }
        last = now;
      }

      notificationScrollFrame = requestAnimationFrame(tick);
    }

    notificationScrollFrame = requestAnimationFrame(tick);
  }

  window.addEventListener('sga:homeNotificationsLoaded', startNotificationScroll);
  if(list?.dataset.notificationsLoaded === '1') startNotificationScroll();
})();
