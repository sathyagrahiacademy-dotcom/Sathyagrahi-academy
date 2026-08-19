(async()=>{
  const c = window.sgaSupabase;

  // ADMIN AUTH CHECK
  const { data: { session } } = await c.auth.getSession();

  if (!session) {
    return location.replace('admin-login.html');
  }

  const { data: p } = await c
    .from('profiles')
    .select('role,is_active')
    .eq('id', session.user.id)
    .single();

  if (!p || p.role !== 'admin' || !p.is_active) {
    await c.auth.signOut();
    return location.replace('admin-login.html');
  }

  // DASHBOARD COUNTS
  async function count(table, filter) {
    let q = c.from(table).select('*', { count: 'exact', head: true });

    if (filter) {
      q = q.eq(filter[0], filter[1]);
    }

    const { count } = await q;
    return count ?? 0;
  }

  const [students, exams, enrollments, feedback] = await Promise.all([
    count('profiles', ['role', 'student']),
    count('exams', ['status', 'active']),
    count('enrollments', ['status', 'new']),
    count('feedback', ['status', 'new'])
  ]);

  const studentsEl = document.getElementById('students');
  const examsEl = document.getElementById('exams');
  const enrollmentsEl = document.getElementById('enrollments');
  const feedbackEl = document.getElementById('feedback');

  if (studentsEl) studentsEl.textContent = students;
  if (examsEl) examsEl.textContent = exams;
  if (enrollmentsEl) enrollmentsEl.textContent = enrollments;
  if (feedbackEl) feedbackEl.textContent = feedback;

  // LOGOUT
  const logout = document.getElementById('logout');

  if (logout) {
    logout.onclick = async () => {
      await c.auth.signOut();
      location.replace('admin-login.html');
    };
  }

  // QUICK ACTIONS
  const actionMap = {
    'add student': 'admin-students.html',
    'student performance': 'admin-student-performance.html',
    'review enrollments': 'admin-enrollments.html',
    'create exam': 'admin-exams.html',
    'mark attendance': 'admin-attendance.html',
    'upload material': 'admin-study-material.html',
    'publish notification': 'admin-notifications.html',
    'my account': 'admin-my-account.html'
  };

  document.querySelectorAll('.actions button').forEach((button) => {
    const label = (button.textContent || '').trim().toLowerCase();
    const target = actionMap[label];

    if (!target) return;

    // Remove old placeholder behaviour if it is still present in HTML.
    button.removeAttribute('data-coming');

    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = target;
    };
  });

})();
