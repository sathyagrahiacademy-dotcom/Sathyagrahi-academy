(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
let session=null,profile=null,currentPhotoUrl=null;

const val=v=>v??'';
const fmtDate=d=>{
  if(!d)return '—';
  const x=new Date(d+'T00:00:00');
  return Number.isNaN(x.getTime())?'—':x.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
};
function setMsg(id,text,ok=false){
  const x=$(id);if(!x)return;
  x.textContent=text;
  x.style.color=ok?'#267447':'#9a2f2f';
}
function initials(name){
  const parts=String(name||'Student').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0,2).map(x=>x[0]).join('')||'S').toUpperCase();
}
function renderPhoto(url){
  currentPhotoUrl=url||null;
  if(url){
    $('profilePhoto').src=url;
    $('profilePhoto').style.display='block';
    $('avatarFallback').style.display='none';
  }else{
    $('profilePhoto').style.display='none';
    $('avatarFallback').style.display='grid';
    $('avatarFallback').textContent=initials(profile?.full_name);
  }
}
function render(){
  const name=profile.full_name||'Student';
  const sid=profile.student_id||'—';
  const email=profile.email||session?.user?.email||'—';

  $('studentNameTop').textContent=name;
  $('studentCodeTop').textContent='ID: '+sid;
  $('profileName').textContent=name;
  $('profileSubtitle').textContent='Student ID: '+sid;
  $('targetTag').textContent=profile.target_exam||'NEET';
  $('batchTag').textContent='Batch '+(profile.batch||'—');
  $('statusTag').textContent=profile.is_active?'ACTIVE ACCOUNT':'INACTIVE ACCOUNT';
  $('statusTag').classList.toggle('active',!!profile.is_active);

  $('infoName').textContent=name;
  $('infoStudentId').textContent=sid;
  $('infoEmail').textContent=email;
  $('infoBatch').textContent=profile.batch||'—';
  $('infoTarget').textContent=profile.target_exam||'NEET';
  $('infoJoined').textContent=fmtDate(profile.joined_at);
  $('infoStatus').textContent=profile.is_active?'Active':'Inactive';

  $('phone').value=val(profile.phone);
  $('parentName').value=val(profile.parent_name);
  $('parentPhone').value=val(profile.parent_phone);
  $('currentClass').value=val(profile.current_class);
  $('location').value=val(profile.location);
  renderPhoto(profile.photo_url);
}

async function authenticate(){
  const s=await c.auth.getSession();session=s.data.session;
  if(!session){location.replace('index.html#student-portal');return false}
  const r=await c.from('profiles').select('*').eq('id',session.user.id).single();
  if(r.error||!r.data||r.data.role!=='student'||!r.data.is_active){
    await c.auth.signOut();location.replace('index.html#student-portal');return false;
  }
  profile=r.data;return true;
}

function oldPhotoPath(url){
  if(!url)return null;
  const key='/storage/v1/object/public/profile-photos/';
  const i=url.indexOf(key);
  return i>=0?decodeURIComponent(url.slice(i+key.length)):null;
}

async function uploadPhoto(file){
  if(!file)return currentPhotoUrl;
  if(file.size>5*1024*1024)throw new Error('Profile photo must be 5 MB or smaller.');
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Use JPG, PNG or WEBP image.');

  const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
  const path=`${profile.id}/${Date.now()}-profile.${ext}`;
  const up=await c.storage.from('profile-photos').upload(path,file,{cacheControl:'3600',upsert:false});
  if(up.error)throw up.error;

  const url=c.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
  const old=oldPhotoPath(currentPhotoUrl);
  if(old&&old!==path){
    await c.storage.from('profile-photos').remove([old]);
  }
  return url;
}

$('photoBtn').onclick=()=>$('photoInput').click();
$('photoInput').onchange=async()=>{
  const file=$('photoInput').files[0];
  if(!file)return;
  $('photoBtn').disabled=true;
  setMsg('profileMsg','Uploading photo...');
  try{
    const newUrl=await uploadPhoto(file);
    const r=await c.rpc('update_my_profile',{
      p_phone:$('phone').value.trim()||null,
      p_parent_name:$('parentName').value.trim()||null,
      p_parent_phone:$('parentPhone').value.trim()||null,
      p_current_class:$('currentClass').value||null,
      p_location:$('location').value.trim()||null,
      p_photo_url:newUrl
    });
    if(r.error)throw r.error;
    profile=r.data;render();setMsg('profileMsg','Profile photo updated.',true);
  }catch(e){setMsg('profileMsg',e.message||String(e))}
  finally{$('photoBtn').disabled=false;$('photoInput').value=''}
};

$('profileForm').onsubmit=async e=>{
  e.preventDefault();
  $('saveProfileBtn').disabled=true;
  setMsg('profileMsg','Saving...');
  const r=await c.rpc('update_my_profile',{
    p_phone:$('phone').value.trim()||null,
    p_parent_name:$('parentName').value.trim()||null,
    p_parent_phone:$('parentPhone').value.trim()||null,
    p_current_class:$('currentClass').value||null,
    p_location:$('location').value.trim()||null,
    p_photo_url:currentPhotoUrl
  });
  $('saveProfileBtn').disabled=false;
  if(r.error)return setMsg('profileMsg',r.error.message);
  profile=r.data;render();setMsg('profileMsg','Profile updated successfully.',true);
};

$('passwordForm').onsubmit=async e=>{
  e.preventDefault();
  const pass=$('newPassword').value;
  const confirm=$('confirmPassword').value;
  if(pass.length<8)return setMsg('passwordMsg','Password must contain at least 8 characters.');
  if(pass!==confirm)return setMsg('passwordMsg','Passwords do not match.');

  $('changePasswordBtn').disabled=true;
  setMsg('passwordMsg','Updating password...');
  const r=await c.auth.updateUser({password:pass});
  $('changePasswordBtn').disabled=false;
  if(r.error)return setMsg('passwordMsg',r.error.message);

  $('passwordForm').reset();
  setMsg('passwordMsg','Password changed successfully.',true);
};

$('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
$('logoutBtn').onclick=async()=>{await c.auth.signOut();location.replace('index.html#student-portal')};

if(await authenticate())render();
})();