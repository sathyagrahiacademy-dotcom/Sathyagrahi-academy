(()=>{
  const c=window.sgaSupabase;
  const rows=document.getElementById('rows');
  if(!c||!rows)return;

  const MASK='••••••';
  let currentExam=null;
  let revealedPassword='';
  let busy=false;

  function ensureModal(){
    let modal=document.getElementById('examCredentialModal');
    if(modal)return modal;

    const style=document.createElement('style');
    style.id='examCredentialModalStyles';
    style.textContent=`
      .exam-credential-modal{position:fixed;inset:0;z-index:120;background:#06152b88;display:none;place-items:center;padding:20px}.exam-credential-modal.open{display:grid}.exam-credential-card{width:min(560px,96vw);background:#fff;border-radius:14px;border:1px solid #dbe5f1;box-shadow:0 24px 70px #06152b33;overflow:hidden}.exam-credential-head{padding:18px 20px;background:#06275f;color:#fff;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.exam-credential-head small{display:block;font-size:9px;font-weight:900;letter-spacing:.7px;opacity:.78}.exam-credential-head h3{margin:5px 0 0;font-size:16px}.exam-credential-close{border:1px solid #ffffff55;background:transparent;color:#fff;border-radius:7px;padding:7px 9px;font-weight:900;cursor:pointer}.exam-credential-body{padding:18px 20px}.exam-credential-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.exam-credential-field{border:1px solid #dce5f0;border-radius:9px;padding:11px;background:#f9fbfe}.exam-credential-field.span2{grid-column:1/-1}.exam-credential-field small{display:block;font-size:8px;font-weight:900;letter-spacing:.55px;color:#7a8798}.exam-credential-value{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}.exam-credential-value b{font-size:13px;color:#102f59;word-break:break-all}.exam-credential-actions{display:flex;gap:7px;flex-wrap:wrap}.exam-credential-btn{border:1px solid #b9c9dc;background:#fff;color:#07316d;border-radius:6px;padding:7px 9px;font-size:9px;font-weight:900;cursor:pointer}.exam-credential-btn.primary{background:#06275f;color:#fff;border-color:#06275f}.exam-credential-btn.danger{color:#b42318;border-color:#e6b4b0}.exam-credential-btn:disabled{opacity:.45;cursor:not-allowed}.exam-credential-status{margin:13px 0 0;padding:9px 10px;border-radius:8px;background:#eef6ff;color:#0b4a9e;font-size:10px;font-weight:800}.exam-credential-status.warn{background:#fff7ed;color:#9a3412}.exam-credential-reset{margin-top:14px;padding-top:14px;border-top:1px solid #e5ebf2}.exam-credential-reset label{display:block;font-size:9px;font-weight:900;color:#53637a;margin-bottom:6px}.exam-credential-reset-row{display:flex;gap:8px}.exam-credential-reset input{flex:1;min-width:0;padding:9px 10px;border:1px solid #cbd7e5;border-radius:7px;font:inherit;letter-spacing:2px}.exam-credential-note{margin:8px 0 0;color:#768399;font-size:9px;line-height:1.45}.exam-credential-msg{min-height:17px;margin-top:10px;font-size:10px;color:#b42318}@media(max-width:600px){.exam-credential-grid{grid-template-columns:1fr}.exam-credential-field.span2{grid-column:auto}.exam-credential-reset-row{flex-direction:column}}
    `;
    document.head.appendChild(style);

    modal=document.createElement('div');
    modal.id='examCredentialModal';
    modal.className='exam-credential-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Exam Access');
    modal.innerHTML=`<div class="exam-credential-card">
      <div class="exam-credential-head"><div><small>EXAM ACCESS</small><h3 id="examCredentialTitle">Exam Credentials</h3></div><button type="button" class="exam-credential-close" id="examCredentialClose">CLOSE</button></div>
      <div class="exam-credential-body">
        <div class="exam-credential-grid">
          <div class="exam-credential-field"><small>EXAM CODE</small><div class="exam-credential-value"><b id="examCredentialCode">—</b><button type="button" class="exam-credential-btn" id="examCredentialCopyCode">COPY</button></div></div>
          <div class="exam-credential-field"><small>LIFECYCLE</small><div class="exam-credential-value"><b id="examCredentialLifecycle">—</b></div></div>
          <div class="exam-credential-field span2"><small>PASSWORD</small><div class="exam-credential-value"><b id="examCredentialPassword">${MASK}</b><div class="exam-credential-actions"><button type="button" class="exam-credential-btn primary" id="examCredentialShow">SHOW</button><button type="button" class="exam-credential-btn" id="examCredentialCopyPassword">COPY</button></div></div></div>
        </div>
        <div class="exam-credential-status" id="examCredentialStatus">Checking secure storage…</div>
        <div class="exam-credential-reset">
          <label for="examCredentialResetInput">RESET PASSWORD — EXACTLY 6 DIGITS</label>
          <div class="exam-credential-reset-row"><input id="examCredentialResetInput" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="6 digits"><button type="button" class="exam-credential-btn danger" id="examCredentialReset">RESET PASSWORD</button></div>
          <p class="exam-credential-note">Reset changes only this exam password. Exam Code, questions, attempts and results stay unchanged.</p>
        </div>
        <div class="exam-credential-msg" id="examCredentialMsg"></div>
      </div>
    </div>`;
    document.body.appendChild(modal);

    document.getElementById('examCredentialClose').onclick=closeAccess;
    modal.addEventListener('click',e=>{if(e.target===modal)closeAccess()});
    document.getElementById('examCredentialCopyCode').onclick=copyCode;
    document.getElementById('examCredentialShow').onclick=showPassword;
    document.getElementById('examCredentialCopyPassword').onclick=copyPassword;
    document.getElementById('examCredentialReset').onclick=resetPassword;
    return modal;
  }

  async function call(body){
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Admin session expired');
    const response=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-exam-credentials`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||'Credential request failed');error.code=data.code||'';error.examCode=data.examCode||'';throw error}
    return data;
  }

  function setMessage(message=''){document.getElementById('examCredentialMsg').textContent=message}
  function setStatus(message,warn=false){const el=document.getElementById('examCredentialStatus');el.textContent=message;el.classList.toggle('warn',warn)}
  function setMasked(){document.getElementById('examCredentialPassword').textContent=MASK;document.getElementById('examCredentialShow').textContent='SHOW'}
  function setStoredControls(hasStoredPassword){
    document.getElementById('examCredentialShow').disabled=!hasStoredPassword;
    document.getElementById('examCredentialCopyPassword').disabled=!hasStoredPassword;
    setStatus(hasStoredPassword?'SECURE PASSWORD STORED':'RESET REQUIRED',!hasStoredPassword);
  }

  async function openAccess(button){
    const modal=ensureModal();
    currentExam={
      id:String(button.dataset.examId||''),
      examCode:String(button.dataset.examCode||''),
      title:String(button.dataset.examTitle||'Exam Credentials'),
      state:String(button.dataset.examState||''),
      status:'',isPublished:false,resultPublished:false,hasStoredPassword:false
    };
    revealedPassword='';
    setMasked();
    document.getElementById('examCredentialResetInput').value='';
    document.getElementById('examCredentialTitle').textContent=currentExam.title;
    document.getElementById('examCredentialCode').textContent=currentExam.examCode||'—';
    document.getElementById('examCredentialLifecycle').textContent=(currentExam.state||'—').toUpperCase();
    setMessage('');setStatus('Checking secure storage…');setStoredControls(false);
    modal.classList.add('open');
    try{
      const data=await call({action:'status',examId:currentExam.id});
      currentExam={...currentExam,examCode:String(data.exam?.examCode||currentExam.examCode),status:String(data.exam?.status||''),isPublished:Boolean(data.exam?.isPublished),resultPublished:Boolean(data.exam?.resultPublished),hasStoredPassword:Boolean(data.hasStoredPassword)};
      document.getElementById('examCredentialCode').textContent=currentExam.examCode||'—';
      document.getElementById('examCredentialLifecycle').textContent=(currentExam.status||currentExam.state||'—').toUpperCase();
      setStoredControls(currentExam.hasStoredPassword);
    }catch(error){setMessage(error.message||'Unable to load exam access');setStatus('ACCESS STATUS UNAVAILABLE',true)}
  }

  function closeAccess(){
    revealedPassword='';
    currentExam=null;
    const modal=document.getElementById('examCredentialModal');
    if(!modal)return;
    setMasked();
    document.getElementById('examCredentialResetInput').value='';
    setMessage('');
    modal.classList.remove('open');
  }

  async function revealFromServer(){
    if(!currentExam?.id)throw new Error('Exam access is not selected');
    try{
      const data=await call({action:'reveal',examId:currentExam.id});
      revealedPassword=String(data.password||'');
      if(!/^\d{6}$/.test(revealedPassword))throw new Error('Stored password is unavailable');
      return revealedPassword;
    }catch(error){
      if(error.code==='RESET_REQUIRED'){
        currentExam.hasStoredPassword=false;
        setStoredControls(false);
        setStatus('RESET REQUIRED',true);
      }
      throw error;
    }
  }

  async function showPassword(){
    if(busy||!currentExam?.hasStoredPassword)return;
    if(revealedPassword){revealedPassword='';setMasked();return}
    busy=true;setMessage('');
    try{
      const password=await revealFromServer();
      document.getElementById('examCredentialPassword').textContent=password;
      document.getElementById('examCredentialShow').textContent='HIDE';
    }catch(error){setMessage(error.message||'Unable to reveal password')}
    finally{busy=false}
  }

  async function copyCode(){
    if(!currentExam?.examCode)return;
    try{await navigator.clipboard.writeText(currentExam.examCode);setMessage('Exam Code copied.')}
    catch(_error){setMessage('Could not copy Exam Code.')}
  }

  async function copyPassword(){
    if(busy||!currentExam?.hasStoredPassword)return;
    busy=true;setMessage('');
    try{
      const password=revealedPassword||await revealFromServer();
      await navigator.clipboard.writeText(password);
      setMessage('Exam Password copied.');
    }catch(error){setMessage(error.message||'Unable to copy password')}
    finally{busy=false}
  }

  function isPureDraft(){return currentExam?.status==='draft'&&!currentExam?.isPublished&&!currentExam?.resultPublished}

  async function resetPassword(){
    if(busy||!currentExam?.id)return;
    const input=document.getElementById('examCredentialResetInput');
    const newPassword=String(input.value||'');
    if(!/^\d{6}$/.test(newPassword)){setMessage('Exam Password must be exactly 6 digits');return}
    let confirmNonDraft=false;
    if(!isPureDraft()){
      confirmNonDraft=window.confirm('This exam is not a pure Draft. Resetting the Exam Password will immediately change student access for this exam. Continue?');
      if(!confirmNonDraft)return;
    }
    busy=true;setMessage('Resetting password…');
    try{
      try{await call({action:'reset',examId:currentExam.id,newPassword,confirmNonDraft})}
      catch(error){
        if(error.code!=='CONFIRM_NON_DRAFT_REQUIRED')throw error;
        const confirmed=window.confirm('This exam requires explicit non-draft confirmation. Reset the Exam Password now?');
        if(!confirmed)return;
        await call({action:'reset',examId:currentExam.id,newPassword,confirmNonDraft:true});
      }
      revealedPassword='';setMasked();input.value='';currentExam.hasStoredPassword=true;setStoredControls(true);setMessage('Exam Password reset successfully.');
    }catch(error){setMessage(error.message||'Unable to reset password')}
    finally{busy=false}
  }

  rows.addEventListener('click',e=>{
    const button=e.target.closest('[data-exam-access]');
    if(!button)return;
    e.preventDefault();e.stopPropagation();
    openAccess(button);
  });
})();
