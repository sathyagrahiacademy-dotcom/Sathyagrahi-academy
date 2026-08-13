import{createClient as T}from"https://esm.sh/@supabase/supabase-js@2";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))c(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const u of n.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&c(u)}).observe(document,{childList:!0,subtree:!0});function r(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function c(a){if(a.ep)return;a.ep=!0;const n=r(a);fetch(a.href,n)}})();const h="https://lzclqifnylbyftwzpbxy.supabase.co",g="sb_publishable_wJjvyiQlJlHUGToKxCIN1w_ZkTBYXOn",f=!!h&&!!g&&!h.includes("YOUR_PROJECT")&&!g.includes("YOUR_PUBLIC_ANON_KEY"),o=f?T(h,g):null,i=document.querySelector("#app"),e={session:null,profile:null,route:window.location.hash.replace("#","")||"/"},E=[["/","⌂","HOME"],["/welcome","♙","ABOUT US"],["/courses","▱","COURSES"],["/exams","▣","ONLINE EXAMS"],["/materials","▤","STUDY MATERIAL"],["/results","▥","RESULTS"],["/contact","✉","CONTACT US"]];function v(s){window.location.hash=s}window.addEventListener("hashchange",()=>{e.route=window.location.hash.replace("#","")||"/",p()});function L(){return`
    <div class="dream-bar">Every Dream Deserves the Right Direction</div>
    <header class="academy-header">
      <a href="#/" class="logo-link" aria-label="Sathyagrahi Academy home">
        <img src="/sathyagrahi-logo.png" alt="Sathyagrahi Academy" class="academy-logo" />
      </a>
    </header>
    <nav class="main-nav" aria-label="Primary navigation">
      <div class="nav-inner">
        ${E.map(([s,t,r])=>`
          <a href="#${s}" class="nav-item ${e.route===s?"active":""}">
            <span class="nav-icon">${t}</span><span>${r}</span>
          </a>`).join("")}
      </div>
    </nav>
  `}function O(){return`
    <footer class="site-footer">
      <div class="footer-grid">
        <section>
          <h3>SATHYAGRAHI ACADEMY</h3>
          <p>Empowering Students.<br />Inspiring Excellence.</p>
        </section>
        <section>
          <h4>QUICK LINKS</h4>
          <a href="#/">Home</a><a href="#/welcome">About Us</a><a href="#/courses">Courses</a>
          <a href="#/exams">Online Exams</a><a href="#/materials">Study Material</a><a href="#/results">Results</a>
        </section>
        <section>
          <h4>FOLLOW US</h4>
          <div class="social-row"><span>f</span><span>▶</span><span>➤</span><span>◎</span></div>
        </section>
        <section>
          <h4>CONTACT US</h4>
          <p>✉ info@sathyagrahiacademy.com</p>
          <p>⌖ Telangana, India</p>
        </section>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Sathyagrahi Academy. All Rights Reserved.</span>
        <span>Privacy Policy &nbsp; | &nbsp; Terms & Conditions</span>
      </div>
    </footer>
  `}function m(s){return`<div class="site-shell">${L()}${s}${O()}</div>`}function P(){return`
    <section class="portal-card notices-card">
      <div class="card-title">🔔 <span>NOTIFICATIONS</span></div>
      <div class="notice-list">
        <div><i></i><span>Student Portal is live for academy students</span><time>Latest</time></div>
        <div><i></i><span>Online Exam module is being prepared</span><time>Update</time></div>
        <div><i></i><span>Study Material section will be added chapter-wise</span><time>Update</time></div>
        <div><i></i><span>Results and performance tracking are available in the student portal</span><time>Active</time></div>
        <div><i></i><span>NEET 2027 preparation pathway in progress</span><time>2027</time></div>
      </div>
      <button class="outline-btn" type="button" onclick="location.hash='/notifications'">VIEW ALL</button>
    </section>`}function C(){return`
    <section class="welcome-card">
      <h2>WELCOME TO<br />SATHYAGRAHI ACADEMY</h2>
      <p>Sathyagrahi Academy is founded on a simple but powerful belief — every student can move closer to success when they receive the right guidance, clear understanding, disciplined practice and a purposeful learning path.</p>
      <p>We guide students to move beyond memorising and begin understanding, thinking, practising and learning with confidence.</p>
      <a class="read-more" href="#/welcome">READ MORE</a>
    </section>`}function I(s=""){return`
    <section class="portal-card login-card">
      <div class="card-title">👤 <span>STUDENT LOGIN</span></div>
      ${s?`<div class="login-message">${d(s)}</div>`:""}
      ${f?"":'<div class="login-message warning">Supabase connection is not configured.</div>'}
      <form id="homeLoginForm" class="home-login-form">
        <label>Student ID
          <div class="input-wrap"><span>♙</span><input id="studentId" type="text" placeholder="Enter Student ID / registered email" autocomplete="username" required /></div>
        </label>
        <label>Password
          <div class="input-wrap"><span>▣</span><input id="homePassword" type="password" placeholder="Enter your password" autocomplete="current-password" required /><button id="togglePassword" type="button" aria-label="Show password">◉</button></div>
        </label>
        <div class="login-options"><label class="remember"><input type="checkbox" /> Remember Me</label><a href="#/forgot">Forgot Password?</a></div>
        <button class="login-btn" type="submit" ${f?"":"disabled"}>LOGIN</button>
      </form>
    </section>`}function y(s=""){return m(`
    <main class="home-page">
      <section class="hero-banner">
        <img src="/ambedkar-hero.jpg" alt="Dr. B. R. Ambedkar educational quote banner" />
      </section>
      <section class="home-panels">
        ${P()}
        ${C()}
        ${I(s)}
      </section>
    </main>
  `)}function H(){return m(`
    <main class="inner-page welcome-full-page">
      <section class="welcome-paper">
        <img src="/sathyagrahi-logo.png" alt="Sathyagrahi Academy" class="welcome-logo" />
        <p class="welcome-tagline">Every Dream Deserves the Right Direction.</p>
        <div class="book-symbol">▱</div>
        <h1>WELCOME TO<br />SATHYAGRAHI ACADEMY</h1>
        <div class="welcome-copy">
          <p>Sathyagrahi Academy is founded on a simple but powerful belief — every student can move closer to success when they receive the right guidance, clear understanding, disciplined practice and a purposeful learning path.</p>
          <p>We guide students to move beyond memorising and begin understanding, thinking, practising and learning with confidence. Every step of the journey is designed to help them become more focused, more consistent and more independent in their preparation.</p>
          <p>Through concept clarity, structured study plans, personal guidance, regular assessments and continuous performance review, we help students identify their strengths, improve their weaknesses and progress with direction.</p>
          <p>Our purpose is to empower students and inspire excellence by helping them learn with clarity and progress with purpose, because we believe that every dream deserves the right direction.</p>
        </div>
        <div class="welcome-closing">
          <strong>Empowering Students. Inspiring Excellence.</strong>
          <span>Learn with Clarity. Progress with Purpose.</span>
        </div>
      </section>
    </main>
  `)}function l(s,t){return m(`
    <main class="inner-page">
      <section class="simple-page-card">
        <span class="section-kicker">SATHYAGRAHI ACADEMY</span>
        <h1>${d(s)}</h1>
        <p>${d(t)}</p>
        ${e.session?'<a class="primary-link" href="#/dashboard">Open Student Dashboard</a>':'<a class="primary-link" href="#/">Go to Student Login</a>'}
      </section>
    </main>`)}function A(){if(!e.session)return v("/"),"";const s=e.session.user?.email||"Student",t=e.profile?.full_name||"Student",r=e.profile?.role||"student";return m(`
    <main class="inner-page dashboard-page">
      <section class="dashboard-head"><div><span>STUDENT DASHBOARD</span><h1>Hello, ${d(t)}</h1><p>${d(s)}</p></div><b>${d(r)}</b></section>
      <section class="dashboard-grid">
        <article><small>PROFILE</small><h3>${d(t)}</h3><p>Your private student profile is active.</p><div><span>Status</span><strong>Active</strong></div><div><span>Access</span><strong>Private</strong></div></article>
        <article><small>TESTS</small><h3>Coming next</h3><p>Upcoming tests and test history will appear here.</p><em>No tests added yet</em></article>
        <article><small>RESULTS</small><h3>Progress overview</h3><p>Physics, Chemistry and Biology performance will appear here.</p><div class="progress-lines"><i></i><i></i><i></i></div></article>
      </section>
      <div class="dashboard-actions"><button id="logoutBtn" class="outline-btn">LOGOUT</button></div>
    </main>`)}function d(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function b(){if(!o||!e.session?.user?.id){e.profile=null;return}const{data:s,error:t}=await o.from("profiles").select("id, full_name, role, created_at").eq("id",e.session.user.id).maybeSingle();if(t){console.error("Profile load error:",t.message),e.profile=null;return}e.profile=s}async function M(){if(!o){p();return}const{data:s}=await o.auth.getSession();e.session=s.session,e.session&&await b(),o.auth.onAuthStateChange(async(t,r)=>{e.session=r,r?await b():e.profile=null,p()}),p()}function w(){const s=document.querySelector("#homeLoginForm");s&&s.addEventListener("submit",async c=>{if(c.preventDefault(),!o)return;const a=document.querySelector("#studentId").value.trim(),n=document.querySelector("#homePassword").value;if(!a.includes("@")){i.innerHTML=y("Student ID mapping will be enabled in the student-management phase. For now, use the registered email for this existing account."),w();return}const u=s.querySelector(".login-btn");u.disabled=!0,u.textContent="SIGNING IN...";const{error:S}=await o.auth.signInWithPassword({email:a,password:n});if(S){i.innerHTML=y(S.message),w();return}await b(),v("/dashboard")});const t=document.querySelector("#togglePassword");t&&t.addEventListener("click",()=>{const c=document.querySelector("#homePassword");c.type=c.type==="password"?"text":"password"});const r=document.querySelector("#logoutBtn");r&&o&&r.addEventListener("click",async()=>{await o.auth.signOut(),v("/")})}function p(){e.route=window.location.hash.replace("#","")||"/",e.route==="/"?i.innerHTML=y():e.route==="/welcome"||e.route==="/about"?i.innerHTML=H():e.route==="/courses"?i.innerHTML=l("Courses","Structured academic programmes and learning pathways will be published here."):e.route==="/exams"?i.innerHTML=l("Online Exams","Academy online examinations, schedules and student attempts will be managed here."):e.route==="/materials"?i.innerHTML=l("Study Material","Chapter-wise study materials, notes and revision resources will be available here."):e.route==="/results"?i.innerHTML=e.session?A():l("Results","Student results are private. Please sign in from the home page to view your results."):e.route==="/contact"?i.innerHTML=l("Contact Us","Official academy contact information will be maintained here."):e.route==="/notifications"?i.innerHTML=l("Notifications","Academy announcements and important student updates will appear here."):e.route==="/forgot"?i.innerHTML=l("Forgot Password","Password recovery will be connected to the academy email system in the account-management phase."):e.route==="/dashboard"?i.innerHTML=A():i.innerHTML=l("Page Not Found","The requested page does not exist."),w()}p();M();
