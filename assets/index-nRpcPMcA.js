import{createClient as S}from"https://esm.sh/@supabase/supabase-js@2";(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))p(a);new MutationObserver(a=>{for(const t of a)if(t.type==="childList")for(const o of t.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&p(o)}).observe(document,{childList:!0,subtree:!0});function r(a){const t={};return a.integrity&&(t.integrity=a.integrity),a.referrerPolicy&&(t.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?t.credentials="include":a.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function p(a){if(a.ep)return;a.ep=!0;const t=r(a);fetch(a.href,t)}})();const v="https://lzclqifnylbyftwzpbxy.supabase.co",g="sb_publishable_wJjvyiQlJlHUGToKxCIN1w_ZkTBYXOn",m=!!v&&!!g&&!v.includes("YOUR_PROJECT")&&!g.includes("YOUR_PUBLIC_ANON_KEY"),i=m?S(v,g):null,l=document.querySelector("#app"),e={session:null,profile:null,route:window.location.hash.replace("#","")||"/"},h={book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5v-16Z"/></svg>',chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16v2H2V4h2v16Zm3-2V9h3v9H7Zm5 0V5h3v13h-3Zm5 0v-6h3v6h-3Z"/></svg>',target:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 9.95 11H19.9A8 8 0 1 1 11 4.1V2.05C11.33 2.02 11.66 2 12 2Zm0 5a5 5 0 1 0 5 5h-2a3 3 0 1 1-3-3V7Zm9-5v4h-2.59l-5.7 5.71-1.42-1.42L17 4.59V2h4Z"/></svg>'};function f(s){window.location.hash=s}window.addEventListener("hashchange",()=>{e.route=window.location.hash.replace("#","")||"/",c()});function A(){return`
    <a class="brand" href="#/" aria-label="Sathyagrahi Academy home">
      <span class="brand-mark">SA</span>
      <span>
        <strong>Sathyagrahi Academy</strong>
        <small>Focused learning. Steady progress.</small>
      </span>
    </a>
  `}function d(s,{compact:n=!1}={}){return`
    <div class="site-shell ${n?"compact":""}">
      <header class="topbar">
        ${A()}
        <nav class="topnav">
          <a href="#/" class="${e.route==="/"?"active":""}">Home</a>
          ${e.session?`<a href="#/dashboard" class="${e.route==="/dashboard"?"active":""}">Dashboard</a>
                 <button id="logoutBtn" class="link-button">Logout</button>`:`<a href="#/login" class="login-link ${e.route==="/login"?"active":""}">Student Login</a>`}
        </nav>
      </header>
      ${s}
      <footer class="footer">
        <span>© ${new Date().getFullYear()} Sathyagrahi Academy</span>
        <span>Student-focused NEET learning portal</span>
      </footer>
    </div>
  `}function P(){return d(`
    <main>
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">NEET PREPARATION • PERSONAL GUIDANCE</span>
          <h1>Clarity first.<br />Progress every week.</h1>
          <p>
            A focused academic space for students to learn, practice, review
            mistakes and track progress without unnecessary clutter.
          </p>
          <div class="hero-actions">
            <a class="primary-btn" href="#/login">Student Login</a>
            <a class="secondary-btn" href="#/about">How it works</a>
          </div>
          <div class="hero-note">
            <span class="status-dot"></span>
            Individual student access • Private progress • Simple dashboard
          </div>
        </div>
        <div class="hero-card">
          <div class="mini-header">
            <span>Student Progress</span>
            <span class="badge">Private</span>
          </div>
          <div class="score-ring">
            <div>
              <strong>NEET</strong>
              <span>2027</span>
            </div>
          </div>
          <div class="subject-grid">
            <div><span>Physics</span><strong>Concept + Practice</strong></div>
            <div><span>Chemistry</span><strong>NCERT + Numericals</strong></div>
            <div><span>Biology</span><strong>NCERT + Recall</strong></div>
          </div>
        </div>
      </section>

      <section class="feature-row">
        <article class="feature-card">
          <div class="icon-box">${h.book}</div>
          <h3>Focused Study</h3>
          <p>Simple learning flow with clear priorities and minimal distractions.</p>
        </article>
        <article class="feature-card">
          <div class="icon-box">${h.chart}</div>
          <h3>Private Progress</h3>
          <p>Each student sees only their own profile and academic progress.</p>
        </article>
        <article class="feature-card">
          <div class="icon-box">${h.target}</div>
          <h3>NEET Direction</h3>
          <p>Practice, review and steady improvement built around the exam goal.</p>
        </article>
      </section>
    </main>
  `)}function E(){return d(`
    <main class="content-page">
      <span class="eyebrow">HOW IT WORKS</span>
      <h1>A simple student workflow</h1>
      <p class="lead">Login, study, take tests, review mistakes and track progress in one clean portal.</p>

      <div class="steps">
        <div><span>01</span><h3>Login</h3><p>Every student gets an individual account.</p></div>
        <div><span>02</span><h3>Learn</h3><p>Study materials and guidance stay organised.</p></div>
        <div><span>03</span><h3>Practice</h3><p>Tests and question practice build consistency.</p></div>
        <div><span>04</span><h3>Review</h3><p>Results and mistakes help improve the next attempt.</p></div>
      </div>

      <a class="primary-btn inline-btn" href="#/login">Go to Student Login</a>
    </main>
  `)}function y(s=""){return d(`
    <main class="auth-wrap">
      <section class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark large">SA</span>
          <div>
            <span class="eyebrow">STUDENT PORTAL</span>
            <h1>Welcome back</h1>
            <p>Sign in to access your personal dashboard.</p>
          </div>
        </div>

        ${m?"":`<div class="notice warning">
                Supabase is not connected yet. Add your project URL and public anon key in a <code>.env</code> file.
              </div>`}
        ${s?`<div class="notice">${s}</div>`:""}

        <form id="loginForm" class="auth-form">
          <label>
            Email
            <input id="email" type="email" placeholder="student@example.com" required autocomplete="email" />
          </label>
          <label>
            Password
            <input id="password" type="password" placeholder="Enter your password" required autocomplete="current-password" />
          </label>
          <button class="primary-btn full" type="submit" ${m?"":"disabled"}>
            Sign in
          </button>
        </form>
        <p class="auth-help">Accounts are created by Sathyagrahi Academy. Public signup is not available.</p>
      </section>
    </main>
  `,{compact:!0})}function L(){if(!e.session)return f("/login"),"";const s=e.session.user?.email||"Student",n=e.profile?.full_name||"Student",r=e.profile?.role||"student";return d(`
    <main class="dashboard">
      <section class="dashboard-head">
        <div>
          <span class="eyebrow">STUDENT DASHBOARD</span>
          <h1>Hello, ${u(n)}</h1>
          <p>${u(s)}</p>
        </div>
        <span class="role-badge">${u(r)}</span>
      </section>

      <section class="dashboard-grid">
        <article class="dash-card profile-card">
          <span class="card-label">PROFILE</span>
          <h3>${u(n)}</h3>
          <p>Your account is securely connected to your private student profile.</p>
          <div class="profile-line"><span>Status</span><strong>Active</strong></div>
          <div class="profile-line"><span>Access</span><strong>Private</strong></div>
        </article>

        <article class="dash-card">
          <span class="card-label">TESTS</span>
          <h3>Coming next</h3>
          <p>Upcoming tests, subject-wise scores and test history will appear here.</p>
          <div class="empty-state">No tests added yet</div>
        </article>

        <article class="dash-card">
          <span class="card-label">RESULTS</span>
          <h3>Progress overview</h3>
          <p>Physics, Chemistry and Biology performance will be shown separately.</p>
          <div class="progress-lines">
            <span></span><span></span><span></span>
          </div>
        </article>
      </section>

      <section class="next-section">
        <div>
          <span class="eyebrow">NEXT MODULES</span>
          <h2>Built to grow with the Academy</h2>
        </div>
        <div class="module-pills">
          <span>Tests</span><span>Results</span><span>Wrong Answers</span><span>Study Materials</span>
        </div>
      </section>
    </main>
  `)}function T(){return d(`
    <main class="content-page">
      <h1>Page not found</h1>
      <p class="lead">The page you requested does not exist.</p>
      <a class="primary-btn inline-btn" href="#/">Back Home</a>
    </main>
  `)}function u(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function b(){if(!i||!e.session?.user?.id){e.profile=null;return}const{data:s,error:n}=await i.from("profiles").select("id, full_name, role, created_at").eq("id",e.session.user.id).maybeSingle();if(n){console.error("Profile load error:",n.message),e.profile=null;return}e.profile=s}async function H(){if(!i){c();return}const{data:s}=await i.auth.getSession();e.session=s.session,e.session&&await b(),i.auth.onAuthStateChange(async(n,r)=>{e.session=r,r?await b():e.profile=null,c()}),c()}function w(){const s=document.querySelector("#loginForm");s&&s.addEventListener("submit",async r=>{if(r.preventDefault(),!i)return;const p=document.querySelector("#email").value.trim(),a=document.querySelector("#password").value,t=s.querySelector("button");t.disabled=!0,t.textContent="Signing in...";const{error:o}=await i.auth.signInWithPassword({email:p,password:a});if(o){l.innerHTML=y(o.message),w();return}await b(),f("/dashboard")});const n=document.querySelector("#logoutBtn");n&&i&&n.addEventListener("click",async()=>{await i.auth.signOut(),f("/")})}function c(){e.route=window.location.hash.replace("#","")||"/",e.route==="/"?l.innerHTML=P():e.route==="/about"?l.innerHTML=E():e.route==="/login"?l.innerHTML=y():e.route==="/dashboard"?l.innerHTML=L():l.innerHTML=T(),w()}c();H();
