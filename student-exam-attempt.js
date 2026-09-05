(() => {
const c=window.sgaSupabase,$=id=>document.getElementById(id),u=window.sgaExamAttemptSync,activityApi=window.sgaQuestionActivity;
let exam=null,attempt=null,questions=[],responses={},confirmed={},visited=new Set(),current=0,endsAt=0,timerId=null,submitting=false,navigating=false;
let activityTracker=null,activityHeartbeat=null;

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
function setSaveState(text,kind=''){
  const el=$('saveState');if(!el)return;el.textContent=text;el.className='savestate'+(kind?' '+kind:'');
}
function showRecoverableSaveError(e){setSaveState('Save failed — retry','error');console.error(e)}
function updateSaveIndicator(){if(saveQueue.hasPending())setSaveState('Saving...','saving');else setSaveState('All answers saved')}
const saveQueue=u.createSaveQueue(async(questionId,state)=>{
  setSaveState('Saving...','saving');
  await invoke({action:'save',attemptId:attempt.id,questionId,selectedOption:state.selected_option,markedForReview:state.marked_for_review});
  confirmed[questionId]={...state};
  renderPalette();
});
function queueState(qid,state){
  responses[qid]={selected_option:u.normaliseAnswer(state.selected_option),marked_for_review:Boolean(state.marked_for_review)};
  renderPalette();
  const p=saveQueue.enqueue(qid,responses[qid]);
  p.then(updateSaveIndicator).catch(showRecoverableSaveError);
  return p;
}

function isActivityActive(){return !document.hidden&&document.hasFocus()}
async function sendActivityEvent(event){
  if(!event||!attempt?.id)return;
  await invoke({
    action:'activity',attemptId:attempt.id,questionId:event.questionId,eventId:event.eventId,
    activeSeconds:event.activeSeconds,visitDelta:event.visitDelta,answerChangeDelta:event.answerChangeDelta,viewedAt:event.viewedAt
  });
}
function logActivityEvent(event){
  if(!event)return Promise.resolve();
  return sendActivityEvent(event).catch(e=>console.warn('Activity logging failed',e));
}
function flushActivity(){
  if(!activityTracker)return Promise.resolve();
  return logActivityEvent(activityTracker.flush());
}
function trackCurrentQuestion(questionId){
  if(!activityTracker)return;
  const previousEvent=activityTracker.enter(questionId,{active:isActivityActive()});
  logActivityEvent(previousEvent);
}
function startActivityHeartbeat(){
  if(!activityTracker||activityHeartbeat)return;
  activityHeartbeat=setInterval(()=>{flushActivity();},15_000);
}

document.addEventListener('visibilitychange',()=>{
  if(!activityTracker)return;
  activityTracker.setActive(!document.hidden&&document.hasFocus());
  if(document.hidden)flushActivity();
});
window.addEventListener('focus',()=>{activityTracker?.setActive(!document.hidden)});
window.addEventListener('blur',()=>{if(!activityTracker)return;activityTracker.setActive(false);flushActivity()});

function statusFor(i){
  const q=questions[i],r=responseFor(q.id),v=visited.has(q.id);
  return u.statusForQuestion({questionId:q.id,response:r,visited:v,confirmedCurrent:u.isConfirmedCurrent(q.id,responses,confirmed)});
}
function renderPalette(){
  $('palette').innerHTML=questions.map((q,i)=>`<button class="pbtn ${statusFor(i)} ${i===current?'current':''}" data-i="${i}">${q.question_no}</button>`).join('');
}
function render(){
  const q=questions[current];if(!q)return;
  trackCurrentQuestion(q.id);
  visited.add(q.id);
  $('questionNo').textContent=q.question_no;
  $('questionText').textContent=q.question_text;
  $('marksInfo').textContent=`+${Number(q.marks)} / -${Number(q.negative_marks)}`;
  const r=responseFor(q.id);
  $('options').innerHTML=['A','B','C','D'].map(k=>{const txt=q['option_'+k.toLowerCase()];return `<label class="option ${r.selected_option===k?'selected':''}"><input type="radio" name="answer" value="${k}" ${r.selected_option===k?'checked':''}><span class="letter">${k}</span><span>${escapeHtml(txt)}</span></label>`}).join('');
  document.querySelectorAll('input[name=answer]').forEach(el=>el.onchange=e=>{
    const previousOption=responseFor(q.id).selected_option;
    const nextOption=e.target.value;
    if(previousOption!==nextOption)activityTracker?.answerChanged();
    const latest={...responseFor(q.id),selected_option:nextOption};
    responses[q.id]=latest;
    render();
    queueState(q.id,latest).catch(()=>{});
  });
  $('prevBtn').disabled=current===0;
  $('saveNextBtn').textContent=current===questions.length-1?'SAVE':'SAVE & NEXT';
  renderPalette();
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
async function flushQuestion(qid){
  if(Object.prototype.hasOwnProperty.call(responses,qid)&&!u.isConfirmedCurrent(qid,responses,confirmed))queueState(qid,responseFor(qid)).catch(()=>{});
  await saveQueue.flush(qid);
  if(Object.prototype.hasOwnProperty.call(responses,qid)&&!u.isConfirmedCurrent(qid,responses,confirmed)){
    queueState(qid,responseFor(qid)).catch(()=>{});
    await saveQueue.flush(qid);
  }
  updateSaveIndicator();
}
async function flushCurrent(){const q=questions[current];if(q)await flushQuestion(q.id)}
async function flushAllPending(){
  Object.keys(responses).forEach(qid=>{if(!u.isConfirmedCurrent(qid,responses,confirmed))queueState(qid,responseFor(qid)).catch(()=>{})});
  await saveQueue.flushAll();
  for(const qid of Object.keys(responses))if(!u.isConfirmedCurrent(qid,responses,confirmed))throw new Error('Some answers are not yet saved. Please retry.');
  updateSaveIndicator();
}
async function saveCurrent(markedOverride=null){
  const q=questions[current],r=responseFor(q.id);
  const state={...r,marked_for_review:markedOverride===null?r.marked_for_review:markedOverride};
  queueState(q.id,state).catch(()=>{});
  await flushQuestion(q.id);
}
function next(){if(current<questions.length-1){current++;render()}}
async function goTo(index){
  if(navigating||index===current)return;navigating=true;
  try{await flushCurrent();current=index;render()}catch(e){alert(e.message||'Could not save this answer. Please retry.')}finally{navigating=false}
}
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
    await Promise.race([flushActivity(),new Promise(resolve=>setTimeout(resolve,800))]);
    if(auto){try{await flushAllPending()}catch(e){showRecoverableSaveError(e)}}else await flushAllPending();
    const snapshot=u.buildFullSnapshot(questions,responses);
    await invoke({action:'submit',attemptId:attempt.id,auto,responses:snapshot});
    if(activityHeartbeat){clearInterval(activityHeartbeat);activityHeartbeat=null}
    sessionStorage.removeItem('sga_active_exam_id');sessionStorage.removeItem('sga_verified_exam');
    alert(auto?'Time is over. Your exam has been auto-submitted.':'Your exam has been submitted successfully.');
    location.replace('dashboard.html');
  }catch(e){alert(e.message||'Could not submit exam.');submitting=false;if(auto)setTimeout(()=>submit(true),3000)}
}
$('saveNextBtn').onclick=async()=>{if(navigating)return;navigating=true;try{await saveCurrent(false);next()}catch(e){alert(e.message||'Could not save this answer. Please retry.')}finally{navigating=false}};
$('reviewBtn').onclick=async()=>{if(navigating)return;navigating=true;try{await saveCurrent(true);next()}catch(e){alert(e.message||'Could not save this answer. Please retry.')}finally{navigating=false}};
$('clearBtn').onclick=async()=>{if(navigating)return;navigating=true;const q=questions[current];const previousOption=responseFor(q.id).selected_option;if(previousOption!==null)activityTracker?.answerChanged();responses[q.id]={selected_option:null,marked_for_review:false};render();try{queueState(q.id,responses[q.id]).catch(()=>{});await flushQuestion(q.id)}catch(e){alert(e.message||'Could not clear this answer. Please retry.')}finally{navigating=false}};
$('prevBtn').onclick=()=>{if(current>0)goTo(current-1)};
$('palette').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;goTo(Number(b.dataset.i))};
$('submitBtn').onclick=async()=>{try{await flushAllPending();summary();open('submitModal')}catch(e){alert(e.message||'Could not synchronize answers. Please retry.')}};
$('confirmSubmit').onclick=()=>submit(false);
$('instructionsBtn').onclick=()=>open('instructionsModal');$('paperBtn').onclick=()=>open('paperModal');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));

(async()=>{
  if(!u){alert('Exam save module failed to load. Please refresh the page.');return}
  if(!await guard())return;
  const examId=sessionStorage.getItem('sga_active_exam_id');if(!examId){location.replace('student-examinations.html');return}
  try{
    const data=await invoke({action:'start',examId});
    exam=data.exam;attempt=data.attempt;questions=data.questions;endsAt=new Date(data.ends_at).getTime();
    (data.responses||[]).forEach(r=>{const state={selected_option:u.normaliseAnswer(r.selected_option),marked_for_review:Boolean(r.marked_for_review)};responses[r.question_id]={...state};confirmed[r.question_id]={...state}});
    if(activityApi?.createQuestionActivityTracker){activityTracker=activityApi.createQuestionActivityTracker();startActivityHeartbeat()}
    $('examTitle').textContent=exam.title;$('subjectName').textContent=exam.subject+(exam.syllabus?' • '+exam.syllabus:'');
    $('instructionsContent').innerHTML=`<p><strong>${escapeHtml(exam.title)}</strong></p><ul><li>Duration: ${exam.duration_minutes} minutes.</li><li>Total Marks: ${exam.total_marks}.</li><li>${exam.negative_marking?'Negative marking is enabled.':'No negative marking.'}</li><li>Your selected option is auto-saved. A question turns Answered only after the server confirms the save.</li><li>Navigation waits for any pending answer save.</li><li>FINAL SUBMIT performs a complete answer synchronization before grading.</li><li>The test auto-submits when the timer reaches zero.</li></ul>${exam.instructions?`<p>${escapeHtml(exam.instructions)}</p>`:''}`;
    $('paperContent').innerHTML=questions.map(q=>`<p><strong>Q${q.question_no}.</strong> ${escapeHtml(q.question_text)}</p>`).join('');
    current=0;setSaveState('All answers saved');render();startTimer();
  }catch(e){alert(e.message||'Unable to start exam.');location.replace('student-examinations.html')}
})();
})();