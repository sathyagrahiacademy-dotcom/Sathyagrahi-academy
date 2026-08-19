(async()=>{
const c=window.sgaSupabase;
const $=id=>document.getElementById(id);

const fallback={
 support_phone:'+91 9059995537',
 support_email:null,
 location:'Bheemgal, Nizamabad, Telangana, India',
 website_url:'https://sathyagrahiacademy.com'
};

let s=fallback;
try{
 if(c){
   const {data,error}=await c.from('academy_settings')
     .select('support_phone,support_email,location,website_url')
     .eq('id',1)
     .maybeSingle();
   if(!error&&data)s={...fallback,...data};
 }
}catch(e){console.warn('Contact settings:',e)}

const phone=s.support_phone||fallback.support_phone;
const digits=String(phone).replace(/\D/g,'');
const wa=digits.startsWith('91')?digits:`91${digits.slice(-10)}`;

$('supportPhone').textContent=phone;
$('phoneLink').href=`tel:+${wa}`;
$('callBtn').href=`tel:+${wa}`;
$('whatsappBtn').href=`https://wa.me/${wa}`;
$('footerPhone').textContent=phone;

if(s.support_email){
 $('supportEmail').textContent=s.support_email;
 $('emailLink').href=`mailto:${s.support_email}`;
}else{
 $('supportEmail').textContent='Not configured';
 $('emailLink').removeAttribute('href');
}

$('academyLocation').textContent=s.location||fallback.location;
$('footerLocation').textContent=s.location||fallback.location;

const website=s.website_url||fallback.website_url;
$('websiteUrl').textContent=website.replace(/^https?:\/\//,'').replace(/\/$/,'');
$('websiteLink').href=website;
})();