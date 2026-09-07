(() => {
  const SUPABASE_URL = 'https://lzclqifnylbyftwzpbxy.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJjvyiQlJlHUGToKxCIN1w_ZkTBYXOn';

  const currentFile = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminArea = currentFile.startsWith('admin-');

  function ensureAdminCommunicationsNav() {
    if (!isAdminArea) return;
    const nav = document.querySelector('.shell aside nav') || document.querySelector('aside nav');
    if (!nav) return;

    let communications = nav.querySelector('a[href="admin-communications.html"]');
    if (!communications) {
      communications = document.createElement('a');
      communications.href = 'admin-communications.html';
      communications.textContent = 'Communications';
      const notifications = nav.querySelector('a[href="admin-notifications.html"]');
      const help = nav.querySelector('a[href="admin-help-feedback.html"]');
      if (notifications && help) nav.insertBefore(communications, help);
      else if (help) nav.insertBefore(communications, help);
      else nav.appendChild(communications);
    }

    if (currentFile === 'admin-communications.html') communications.classList.add('active');
    else communications.classList.remove('active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAdminCommunicationsNav, { once: true });
  } else {
    ensureAdminCommunicationsNav();
  }

  if (!window.supabase?.createClient) {
    console.error('Supabase client library failed to load.');
    return;
  }

  /*
    IMPORTANT:
    Admin and Student use separate Supabase Auth storage keys.

    Why:
    Previously both portals used the same default Supabase session storage.
    Logging into Student could replace the Admin session (and vice versa),
    which could look like an unexpected logout.

    With separate storage:
    - Admin session persists independently.
    - Student session persists independently.
    - Either portal logs out only when its own LOGOUT button is used
      (except security events such as password reset/account disable/browser
      storage clearing/expired or revoked refresh token).
  */
  const AUTH_STORAGE_KEY = isAdminArea
    ? 'sga-admin-auth-session-v1'
    : 'sga-student-auth-session-v1';

  window.sgaSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY
      }
    }
  );

  window.SGA_SUPABASE_URL = SUPABASE_URL;
  window.SGA_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
  window.SGA_AUTH_STORAGE_KEY = AUTH_STORAGE_KEY;
})();
