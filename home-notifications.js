(()=>{
const c=window.sgaSupabase;
const list=document.getElementById('notificationsList');
const viewAll=document.getElementById('homeViewAllNotifications');
if(!list||!c)return;

const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[ch]));

const fmt=d=>{
  if(!d)return '';
  return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
};

function row(x){
  const msg=(x.message||'').trim();
  const poster=x.poster_url||'';
  const inner=`<span class="dot"></span>
    <div>
      <strong>${esc(x.title)}</strong>
      <small>${esc(msg || (poster?'Click to view poster':'Academy notification'))}</small>
    </div>
    <time>${fmt(x.published_at||x.created_at)}</time>`;
  if(poster){
    return `<a class="notice" href="${esc(poster)}" target="_blank" rel="noopener" aria-label="Open ${esc(x.title)}">${inner}</a>`;
  }
  return `<div class="notice">${inner}</div>`;
}

async function load(){
  const {data,error}=await c.from('notifications')
    .select('id,title,message,poster_url,published_at,created_at')
    .eq('is_published',true)
    .in('audience',['public','all'])
    .order('published_at',{ascending:false,nullsFirst:false})
    .order('created_at',{ascending:false})
    .limit(12);

  if(error){
    console.warn('Homepage notifications:',error.message);
    list.innerHTML=`<div class="notice"><span class="dot"></span><div><strong>Notifications unavailable</strong><small>Please try again later</small></div><time></time></div>`;
    list.dataset.notificationCount='0';
    list.dataset.notificationsLoaded='1';
    return;
  }

  const rows=data||[];
  if(!rows.length){
    list.innerHTML=`<div class="notice"><span class="dot"></span><div><strong>No new notifications</strong><small>Academy updates will appear here.</small></div><time></time></div>`;
    list.dataset.notificationCount='0';
    list.dataset.notificationsLoaded='1';
    return;
  }

  // Keep one clean notification cycle. main.js will create only the
  // temporary copies needed for smooth continuous scrolling.
  const html=rows.map(row).join('');
  list.innerHTML=html;
  list.dataset.cleanHtml=html;
  list.dataset.notificationCount=String(rows.length);
  list.dataset.notificationsLoaded='1';
  window.dispatchEvent(new CustomEvent('sga:homeNotificationsLoaded'));
}

viewAll?.addEventListener('click',()=>{ window.location.href='public-notifications.html'; });
load();
})();