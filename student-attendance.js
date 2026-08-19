(async()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
const {data:{session}}=await c.auth.getSession(); if(!session)return location.replace('index.html#student-portal');
const p=(await c.from('profiles').select('full_name,student_id').eq('id',session.user.id).single()).data;
$('studentName').textContent=p?.full_name||'Student'; $('studentCode').textContent='ID: '+(p?.student_id||'—');

function fmtTime(v){if(!v)return '—';return new Date(v).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true,timeZone:'Asia/Kolkata'});}function localDate(){
 const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
 return `${y}-${m}-${day}`;
}
const today=localDate();
$('todayText').textContent=new Date(today+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
$('month').value=today.slice(0,7);
let all=[];

async function load(){
 const r=await c.from('attendance').select('attendance_date,status,marked_at,updated_at').eq('student_id',session.user.id).order('attendance_date',{ascending:false});
 if(r.error){$('message').className='error';$('message').textContent='Attendance setup is not active yet.';return}
 all=r.data||[];
 const t=all.find(x=>x.attendance_date===today);
 if(t){$('markBtn').disabled=true;$('markBtn').textContent='ATTENDANCE MARKED';$('message').className='success';$('message').textContent="Today's attendance: "+t.status.toUpperCase()+" - "+fmtTime(t.marked_at||t.updated_at);}
 draw();
}
function draw(){
 const pr=all.filter(x=>x.status==='present').length, ab=all.filter(x=>x.status==='absent').length;
 $('total').textContent=all.length;$('present').textContent=pr;$('absent').textContent=ab;$('percent').textContent=(all.length?pr/all.length*100:0).toFixed(1)+'%';
 const a=all.filter(x=>x.attendance_date.startsWith($('month').value));
 $('rows').innerHTML=a.length?a.map(x=>{let d=new Date(x.attendance_date+'T00:00:00');return `<tr><td>${d.toLocaleDateString('en-IN')}</td><td>${d.toLocaleDateString('en-IN',{weekday:'long'})}</td><td class="${x.status}">${x.status.toUpperCase()}</td><td>${fmtTime(x.marked_at||x.updated_at)}</td></tr>`}).join(''):'<tr><td colspan="4">No attendance recorded for this month.</td></tr>';
}
$('month').onchange=draw;
$('markBtn').onclick=async()=>{
 $('markBtn').disabled=true;$('markBtn').textContent='MARKING...';
 const existing=await c.from('attendance').select('id,status').eq('student_id',session.user.id).eq('attendance_date',today).maybeSingle();
 if(existing.data){$('message').className='success';$('message').textContent='Attendance already marked for today.';$('markBtn').textContent='ATTENDANCE MARKED';return}
 const r=await c.from('attendance').insert({student_id:session.user.id,attendance_date:today,status:'present',marked_by:session.user.id,marked_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 if(r.error){$('message').className='error';$('message').textContent='Unable to mark attendance. Please contact admin.';$('markBtn').disabled=false;$('markBtn').textContent="MARK TODAY'S ATTENDANCE";return}
 $('message').className='success';$('message').textContent='Attendance marked successfully.';$('markBtn').textContent='ATTENDANCE MARKED';await load();
};
$('logoutBtn').onclick=async()=>{await c.auth.signOut();location.replace('index.html#student-portal')};
await load();
})();