(() => {
const c=window.sgaSupabase;
const msg=document.getElementById('msg');
const email=document.getElementById('email');
const pw=document.getElementById('password');
const loginBtn=document.getElementById('loginBtn');
const setupBtn=document.getElementById('setupBtn');
const forgotBtn=document.getElementById('forgotPasswordBtn');
const togglePassword=document.getElementById('togglePassword');
const AUTHORIZED_ADMIN_EMAIL='d.kingshravan@gmail.com';

const show=(t,k='')=>{msg.textContent=t;msg.className='msg '+k};
const adminEmail=()=>email.value.trim().toLowerCase();

togglePassword.onclick=()=>{
 const hidden=pw.type==='password';
 pw.type=hidden?'text':'password';
 togglePassword.textContent=hidden?'HIDE':'SHOW';
};

forgotBtn.onclick=async()=>{
 const e=adminEmail();
 if(!e){email.focus();return show('Enter the registered admin email first.','error')}
 if(e!==AUTHORIZED_ADMIN_EMAIL)return show('Use the authorized admin email.','error');

 forgotBtn.disabled=true;
 show('Sending password reset link...');
 try{
   const redirectTo=new URL('admin-reset-password.html',window.location.href).href;
   const {error}=await c.auth.resetPasswordForEmail(e,{redirectTo});
   if(error)throw error;
   show('Password reset link sent. Open the email and click the reset link.','success');
 }catch(err){
   show(err?.message||'Unable to send password reset link.','error');
 }finally{
   forgotBtn.disabled=false;
 }
};

setupBtn.onclick=async()=>{
 const e=adminEmail();
 if(e!==AUTHORIZED_ADMIN_EMAIL)return show('Use the authorized admin email.','error');
 if(pw.value.length<8)return show('Set a password with at least 8 characters.','error');

 setupBtn.disabled=true;
 show('Creating secure admin account...');
 try{
  const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-bootstrap`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY},
    body:JSON.stringify({email:e,password:pw.value})
  });
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Setup failed');
  show('Admin account created. Now click ADMIN LOGIN.','success');
 }catch(err){show(err?.message||'Admin setup failed.','error')}
 finally{setupBtn.disabled=false}
};

document.getElementById('loginForm').onsubmit=async(ev)=>{
 ev.preventDefault();
 const e=adminEmail();
 if(e!==AUTHORIZED_ADMIN_EMAIL)return show('Use the authorized admin email.','error');

 loginBtn.disabled=true;
 show('Verifying admin...');
 try{
   const {data,error}=await c.auth.signInWithPassword({email:e,password:pw.value});
   if(error)return show('Invalid admin email or password.','error');

   const {data:p,error:pe}=await c.from('profiles')
     .select('role,is_active').eq('id',data.user.id).single();

   if(pe||!p||p.role!=='admin'||!p.is_active){
     await c.auth.signOut();
     return show('This account does not have admin access.','error');
   }
   location.href='admin-dashboard.html';
 }catch(err){
   show(err?.message||'Unable to login.','error');
 }finally{
   loginBtn.disabled=false;
 }
};
})();