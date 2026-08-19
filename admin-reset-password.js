(() => {
const c=window.sgaSupabase;
const form=document.getElementById('resetForm');
const np=document.getElementById('newPassword');
const cp=document.getElementById('confirmPassword');
const updateBtn=document.getElementById('updateBtn');
const msg=document.getElementById('msg');
const toggleNew=document.getElementById('toggleNewPassword');
const toggleConfirm=document.getElementById('toggleConfirmPassword');
let ready=false;

const show=(t,k='info')=>{msg.textContent=t;msg.className='msg '+k};
const setReady=v=>{ready=v;updateBtn.disabled=!v};
const toggle=(input,button)=>{
 const hidden=input.type==='password';
 input.type=hidden?'text':'password';
 button.textContent=hidden?'HIDE':'SHOW';
};
toggleNew.onclick=()=>toggle(np,toggleNew);
toggleConfirm.onclick=()=>toggle(cp,toggleConfirm);

c.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'&&session){
   setReady(true);
   show('Reset link verified. Enter your new password.','success');
 }
});

async function checkSession(){
 try{
   const {data,error}=await c.auth.getSession();
   if(error)throw error;
   if(data?.session){
     setReady(true);
     show('Reset link verified. Enter your new password.','success');
   }else{
     setReady(false);
     show('Reset link is invalid or expired. Go back to Admin Login and request a new reset link.','error');
   }
 }catch(err){
   setReady(false);
   show(err?.message||'Unable to verify reset link.','error');
 }
}

form.onsubmit=async e=>{
 e.preventDefault();
 if(!ready)return show('Reset link is not active. Request a new password reset link.','error');
 if(np.value.length<8)return show('Password must contain at least 8 characters.','error');
 if(np.value!==cp.value)return show('New Password and Confirm Password do not match.','error');

 updateBtn.disabled=true;
 show('Updating admin password...','info');
 try{
   const {error}=await c.auth.updateUser({password:np.value});
   if(error)throw error;
   show('Password updated successfully. Redirecting to Admin Login...','success');
   await c.auth.signOut();
   setTimeout(()=>location.replace('admin-login.html'),1500);
 }catch(err){
   updateBtn.disabled=false;
   show(err?.message||'Unable to update password.','error');
 }
};

checkSession();
})();