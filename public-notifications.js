(async()=>{
const c=window.sgaSupabase,h=document.getElementById('publicNoticeList');
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const fmt=d=>new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
if(!c){h.innerHTML='<div class="public-empty">Notifications unavailable.</div>';return}
const {data,error}=await c.from('notifications')
 .select('title,message,poster_url,published_at,created_at')
 .eq('is_published',true).in('audience',['public','all'])
 .order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
if(error){h.innerHTML=`<div class="public-empty">${esc(error.message)}</div>`;return}
const rows=data||[];
h.innerHTML=rows.length?rows.map(x=>`<article class="public-notice-card">
<h2>${esc(x.title)}</h2><time>${fmt(x.published_at||x.created_at)}</time>
${x.message?`<p>${esc(x.message)}</p>`:''}
${x.poster_url?`<a href="${esc(x.poster_url)}" target="_blank" rel="noopener"><img src="${esc(x.poster_url)}" alt="${esc(x.title)}"></a>`:''}
</article>`).join(''):'<div class="public-empty">No public notifications at present.</div>';
})();