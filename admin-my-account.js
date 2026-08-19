(async()=>{
  const c=window.sgaSupabase,$=id=>document.getElementById(id);
  let session,profile,photoUrl=null;

  function setMsg(id,text,ok=false){const e=$(id);e.textContent=text;e.style.color=ok?'#237647':'#9a2f2f'}
  function extFrom(file){const n=(file.name||'').toLowerCase();if(n.endsWith('.png'))return 'png';if(n.endsWith('.webp'))return 'webp';return 'jpg'}
  function setAvatar(url){$('avatar').src=url||'assets/favicon.png'}

  async function auth(){
    const r=await c.auth.getSession();session=r.data.session;
    if(!session)return location.replace('admin-login.html');
    const p=await c.from('profiles').select('id,full_name,email,phone,location,photo_url,role,is_active').eq('id',session.user.id).single();
    if(p.error||!p.data||p.data.role!=='admin'||!p.data.is_active)return location.replace('admin-login.html');
    profile=p.data;photoUrl=profile.photo_url||null;
  }

  function fill(){
    $('fullName').value=profile.full_name||'';
    $('phone').value=profile.phone||'';
    $('location').value=profile.location||'';
    $('email').value=profile.email||session.user.email||'';
    $('profileName').textContent=profile.full_name||'Administrator';
    $('profileEmail').textContent=profile.email||session.user.email||'';
    setAvatar(photoUrl);
  }

  async function saveProfile(){
    const r=await c.rpc('update_my_admin_profile',{
      p_full_name:$('fullName').value.trim(),
      p_phone:$('phone').value.trim()||null,
      p_location:$('location').value.trim()||null,
      p_photo_url:photoUrl
    });
    if(r.error)throw r.error;
    if(r.data){profile=Array.isArray(r.data)?r.data[0]:r.data}
    $('profileName').textContent=$('fullName').value.trim()||'Administrator';
  }

  $('profileForm').onsubmit=async e=>{
    e.preventDefault();$('saveProfile').disabled=true;setMsg('profileMsg','Saving...');
    try{await saveProfile();setMsg('profileMsg','Profile updated successfully.',true)}catch(err){setMsg('profileMsg',err.message||'Unable to update profile.')}finally{$('saveProfile').disabled=false}
  };

  $('photoInput').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>3*1024*1024){setMsg('photoMsg','Photo must be below 3 MB.');e.target.value='';return}
    const ext=extFrom(file);const path=`${session.user.id}/admin-profile-${Date.now()}.${ext}`;
    setMsg('photoMsg','Uploading photo...');
    const up=await c.storage.from('profile-photos').upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(up.error){setMsg('photoMsg',up.error.message);return}
    const pub=c.storage.from('profile-photos').getPublicUrl(path);
    photoUrl=pub.data.publicUrl;
    setAvatar(photoUrl);
    try{await saveProfile();setMsg('photoMsg','Profile photo updated.',true)}catch(err){setMsg('photoMsg',err.message||'Photo uploaded, but profile update failed.')}
    e.target.value='';
  };

  $('removePhoto').onclick=async()=>{
    if(!photoUrl)return setMsg('photoMsg','No custom profile photo to remove.');
    if(!confirm('Remove your profile photo?'))return;
    photoUrl=null;setAvatar(null);
    try{await saveProfile();setMsg('photoMsg','Profile photo removed.',true)}catch(err){setMsg('photoMsg',err.message||'Unable to remove photo.')}
  };

  $('passwordForm').onsubmit=async e=>{
    e.preventDefault();const a=$('newPassword').value,b=$('confirmPassword').value;
    if(a.length<8)return setMsg('passwordMsg','Password must contain at least 8 characters.');
    if(a!==b)return setMsg('passwordMsg','Passwords do not match.');
    $('changePassword').disabled=true;setMsg('passwordMsg','Updating password...');
    const r=await c.auth.updateUser({password:a});
    $('changePassword').disabled=false;
    if(r.error)return setMsg('passwordMsg',r.error.message);
    $('newPassword').value='';$('confirmPassword').value='';setMsg('passwordMsg','Password changed successfully.',true);
  };

  $('logout').onclick=async()=>{await c.auth.signOut();location.replace('admin-login.html')};

  try{await auth();fill()}catch(err){console.error(err);location.replace('admin-login.html')}
})();
