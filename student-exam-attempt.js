(() => {
const c=window.sgaSupabase,$=id=>document.getElementById(id);
let exam=null,attempt=null,questions=[],responses={},visited=new Set(),current=0,endsAt=0,timerId=null,submitting=false;

async function invoke(body){
  const {data,error}=await c.functions.invoke('student-exam-attempt',{body});
  if(error){let m='Exam operation failed.';try{const b=await error.context?.json?.();if(b?.error)m=b.error}catch(_){}throw new Error(m)}
  if(data?.error)throw new Error(data.error);return data;
}
async function guard(){
  const {data:{session}}=await c.auth.getSession(); if(!session){location.replace('index.html#student-portal');return false}
  const {data:p}=await c.from('profiles').select('full_name,student_id,role,is_active').eq('id',session.user.id).single();
  if(!p||p.role!=='student'||!p.is_active){location.replace('index.html#student-portal');return false}
  $('candidateName').textContent=p.full_name||'Student';$('candidateId').textContent='ID: '+(p.student_id||'—');return true;
}
function responseFor(qid){return responses[qid]||{selected_option:null,marked_for_review:false}}
function statusFor(i){
  const q=questions[i],r=responseFor(q.id),v=visited.has(q.id);
  if(r.marked_for_review&&r.selected_option)return'reviewanswered';
  if(r.marked_for_review)return'review';
  if(r.selected_option)return'answered';
  if(v)return'notanswered';
  return'notvisited';
}
function renderPalette(){
  $('palette').innerHTML=questions.map((q,i)=>`<button class="pbtn ${statusFor(i)} ${i===current?'current':''}" data-i="${i}">${q.question_no}</button>`).join('');
}
function render(){
  const q=questions[current];if(!q)return;
  visited.add(q.id);
  $('questionNo').textContent=q.question_no;
  $('questionText').textContent=q.question_text;
  $('marksInfo').textContent=`+${Number(q.marks)} / -${Number(q.negative_marks)}`;
  const r=responseFor(q.id);
  $('options').innerHTML=['A','B','C','D'].map(k=>{const txt=q['option_'+k.toLowerCase()];return `<label class="option ${r.selected_option===k?'selected':''}"><input type="radio" name="answer" value="${k}" ${r.selected_option===k?'checked':''}><span class="letter">${k}</span><span>${escapeHtml(txt)}</span></label>`}).join('');
  document.querySelectorAll('input[name=answer]').forEach(el=>el.onchange=e=>{responses[q.id]={...responseFor(q.id),selected_option:e.target.value};render();});
  $('prevBtn').disabled=current===0;
  $('saveNextBtn').textContent=current===questions.length-1?'SAVE':'SAVE & NEXT';
  renderPalette();
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
async function saveCurrent(markedOverride=null){
  const q=questions[current],r=responseFor(q.id);
  const marked=markedOverride===null?r.marked_for_review:markedOverride;
  await invoke({action:'save',attemptId:attempt.id,questionId:q.id,selectedOption:r.selected_option,markedForReview:marked});
  responses[q.id]={...r,marked_for_review:marked};
  renderPalette();
}
function next(){if(current<questions.length-1){current++;render()}}
function fmt(sec){sec=Math.max(0,sec);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')}
function startTimer(){
  const tick=async()=>{const sec=Math.floor((endsAt-Date.now())/1000);$('timer').textContent=fmt(sec);if(sec<=0){clearInterval(timerId);await submit(true)}};
  tick();timerId=setInterval(tick,1000);
}
function open(id){$(id).classList.add('open')}function close(id){$(id).classList.remove('open')}
function summary(){
  let answered=0,review=0,notVisited=0,notAnswered=0;
  questions.forEach((q,i)=>{const s=statusFor(i);if(s==='answered'||s==='reviewanswered')answered++;if(s==='review'||s==='reviewanswered')review++;if(s==='notvisited')notVisited++;if(s==='notanswered'||s==='review')notAnswered++;});
  $('sumAnswered').textContent=answered;$('sumReview').textContent=review;$('sumNotVisited').textContent=notVisited;$('sumUnanswered').textContent=notAnswered;
}
async function submit(auto=false){
  if(submitting)return;submitting=true;
  try{
    try{await saveCurrent()}catch(_){}
    const data=await invoke({action:'submit',attemptId:attempt.id,auto});
    sessionStorage.removeItem('sga_active_exam_id');sessionStorage.removeItem('sga_verified_exam');
    alert(auto?'Time is over. Your exam has been auto-submitted.':'Your exam has been submitted successfully.');
    location.replace('dashboard.html');
  }catch(e){alert(e.message||'Could not submit exam.');submitting=false}
}
$('saveNextBtn').onclick=async()=>{try{await saveCurrent(false);next()}catch(e){alert(e.message)}};
$('reviewBtn').onclick=async()=>{try{await saveCurrent(true);next()}catch(e){alert(e.message)}};
$('clearBtn').onclick=async()=>{const q=questions[current];responses[q.id]={selected_option:null,marked_for_review:false};render();try{await saveCurrent(false)}catch(e){alert(e.message)}};
$('prevBtn').onclick=()=>{if(current>0){current--;render()}};
$('palette').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;current=Number(b.dataset.i);render()};
$('submitBtn').onclick=()=>{summary();open('submitModal')};$('confirmSubmit').onclick=()=>submit(false);
$('instructionsBtn').onclick=()=>open('instructionsModal');$('paperBtn').onclick=()=>open('paperModal');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));

(async()=>{
  if(!await guard())return;
  const examId=sessionStorage.getItem('sga_active_exam_id');if(!examId){location.replace('student-examinations.html');return}
  try{
    const data=await invoke({action:'start',examId});
    exam=data.exam;attempt=data.attempt;questions=data.questions;endsAt=new Date(data.ends_at).getTime();
    (data.responses||[]).forEach(r=>responses[r.question_id]=r);
    $('examTitle').textContent=exam.title;$('subjectName').textContent=exam.subject+(exam.syllabus?' • '+exam.syllabus:'');
    $('instructionsContent').innerHTML=`<p><strong>${escapeHtml(exam.title)}</strong></p><ul><li>Duration: ${exam.duration_minutes} minutes.</li><li>Total Marks: ${exam.total_marks}.</li><li>${exam.negative_marking?'Negative marking is enabled.':'No negative marking.'}</li><li>Use SAVE & NEXT to save an answer and continue.</li><li>Use MARK FOR REVIEW & NEXT when you want to revisit a question.</li><li>The test auto-submits when the timer reaches zero.</li></ul>${exam.instructions?`<p>${escapeHtml(exam.instructions)}</p>`:''}`;
    $('paperContent').innerHTML=questions.map(q=>`<p><strong>Q${q.question_no}.</strong> ${escapeHtml(q.question_text)}</p>`).join('');
    current=0;render();startTimer();
  }catch(e){alert(e.message||'Unable to start exam.');location.replace('student-examinations.html')}
})();
})();