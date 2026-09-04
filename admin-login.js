(() => {
const c=window.sgaSupabase;
const msg=document.getElementById('msg');
const adminId=document.getElementById('adminId');
const pw=document.getElementById('password');
const loginBtn=document.getElementById('loginBtn');
const setupBtn=document.getElementById('setupBtn');
const forgotBtn=document.getElementById('forgotPasswordBtn');
const togglePassword=document.getElementById('togglePassword');
const ADMIN_LOGIN_ID='1901';
const AUTHORIZED_ADMIN_EMAIL='d.kingshravan@gmail.com';

const show=(t,k='')=>{msg.textContent=t;msg.className='msg '+k};
const validAdminId=()=>adminId.value.trim()===ADMIN_LOGIN_ID;

togglePassword.onclick=()=>{
 const hidden=pw.type==='password';
 pw.type=hidden?'text':'password';
 togglePassword.textContent=hidden?'HIDE':'SHOW';
};

forgotBtn.onclick=async()=>{
 if(!validAdminId()){adminId.focus();return show('Enter the authorized Admin ID.','error')}

 forgotBtn.disabled=true;
 show('Sending password reset link...');
 try{
   const redirectTo=new URL('admin-reset-password.html',window.location.href).href;
   const {error}=await c.auth.resetPasswordForEmail(AUTHORIZED_ADMIN_EMAIL,{redirectTo});
   if(error)throw error;
   show('Password reset link sent to the registered admin account.','success');
 }catch(err){
   show(err?.message||'Unable to send password reset link.','error');
 }finally{
   forgotBtn.disabled=false;
 }
};

setupBtn.onclick=async()=>{
 if(!validAdminId())return show('Use the authorized Admin ID.','error');
 if(pw.value.length<8)return show('Set a password with at least 8 characters.','error');

 setupBtn.disabled=true;
 show('Creating secure admin account...');
 try{
  const r=await fetch(`${window.SGA_SUPABASE_URL}/functions/v1/admin-bootstrap`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':window.SGA_SUPABASE_PUBLISHABLE_KEY},
    body:JSON.stringify({email:AUTHORIZED_ADMIN_EMAIL,password:pw.value})
  });
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Setup failed');
  show('Admin account created. Now click ADMIN LOGIN.','success');
 }catch(err){show(err?.message||'Admin setup failed.','error')}
 finally{setupBtn.disabled=false}
};

document.getElementById('loginForm').onsubmit=async(ev)=>{
 ev.preventDefault();
 if(!validAdminId())return show('Invalid Admin ID or password.','error');

 loginBtn.disabled=true;
 show('Verifying admin...');
 try{
   const {data,error}=await c.auth.signInWithPassword({email:AUTHORIZED_ADMIN_EMAIL,password:pw.value});
   if(error)return show('Invalid Admin ID or password.','error');

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