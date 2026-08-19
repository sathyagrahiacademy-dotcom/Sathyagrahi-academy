(() => {
  const c = window.sgaSupabase;
  const form = document.getElementById('resetForm');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const updateBtn = document.getElementById('updateBtn');
  const resetMessage = document.getElementById('resetMessage');
  const toggleNew = document.getElementById('toggleNew');
  const toggleConfirm = document.getElementById('toggleConfirm');

  let recoveryReady = false;

  function show(message, type = 'info') {
    resetMessage.textContent = message;
    resetMessage.className = `msg ${type}`;
  }

  function setReady(value) {
    recoveryReady = value;
    updateBtn.disabled = !value;
  }

  function toggle(input, button) {
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    button.textContent = hidden ? 'HIDE' : 'SHOW';
  }

  toggleNew.addEventListener('click', () => toggle(newPassword, toggleNew));
  toggleConfirm.addEventListener('click', () => toggle(confirmPassword, toggleConfirm));

  c.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      setReady(true);
      show('Reset link verified. Enter and confirm your new password.', 'success');
    }
  });

  async function verifyRecovery() {
    try {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      if (hash.get('error') || hash.get('error_code')) {
        setReady(false);
        show(hash.get('error_description') || 'This password reset link is invalid or expired.', 'error');
        return;
      }

      const { data, error } = await c.auth.getSession();
      if (error) throw error;

      if (data?.session) {
        setReady(true);
        show('Reset link verified. Enter and confirm your new password.', 'success');
      } else {
        setTimeout(async () => {
          const { data: retryData } = await c.auth.getSession();
          if (retryData?.session) {
            setReady(true);
            show('Reset link verified. Enter and confirm your new password.', 'success');
          } else if (!recoveryReady) {
            setReady(false);
            show('This password reset link is invalid or expired. Request a new reset link from Student Login.', 'error');
          }
        }, 900);
      }
    } catch (error) {
      setReady(false);
      show(error?.message || 'Unable to verify the password reset link.', 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!recoveryReady) {
      show('The password reset link is not active. Please request a new reset link.', 'error');
      return;
    }

    const p1 = newPassword.value;
    const p2 = confirmPassword.value;

    if (p1.length < 8) {
      show('Password must contain at least 8 characters.', 'error');
      newPassword.focus();
      return;
    }

    if (p1 !== p2) {
      show('New Password and Confirm Password do not match.', 'error');
      confirmPassword.focus();
      return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = 'UPDATING PASSWORD...';
    show('Updating your password...', 'info');

    try {
      const { error } = await c.auth.updateUser({ password: p1 });
      if (error) throw error;

      show('Password updated successfully. Returning to Student Login...', 'success');
      await c.auth.signOut();

      setTimeout(() => {
        window.location.replace('index.html#student-portal');
      }, 1400);
    } catch (error) {
      updateBtn.disabled = false;
      updateBtn.textContent = 'UPDATE PASSWORD';
      show(error?.message || 'Unable to update your password. Please try again.', 'error');
    }
  });

  verifyRecovery();
})();
