
(()=>{
  const diagnostics={
    questions:{
      title:'Concept → Example → Basic Practice Gap',
      text:'If reading feels clear but questions do not, verify whether you can explain the concept without notes, then solve a few direct examples before moving to mixed NEET-level questions.',
      actions:['Explain the concept in your own words','Solve direct/basic questions first','Classify each wrong answer']
    },
    memory:{
      title:'Passive Reading → Recall Gap',
      text:'If theory feels familiar while reading but disappears later, replace repeated passive reading with active recall, short spaced revision and question-based retrieval.',
      actions:['Close the book and recall key points','Use diagrams / keywords / short prompts','Schedule spaced revision']
    },
    physics:{
      title:'Method Clarity → Practice Fluency Gap',
      text:'Slow Physics usually improves by making the solving method automatic: identify data, choose the relation, track units/signs, solve, then review where time was lost.',
      actions:['Practise one question type in small sets','Write the solving steps clearly','Time only after accuracy improves']
    },
    score:{
      title:'Test Analysis → Correction Gap',
      text:'If scores stay flat, do not simply take more tests. Compare repeated mistake types, weak chapters, accuracy and time usage, then make one correction plan before the next test.',
      actions:['Group mistakes by type','Find repeated weak topics','Retest corrected weaknesses']
    },
    revision:{
      title:'Too Much New Learning → Revision Capacity Gap',
      text:'A growing revision backlog usually means new learning is moving faster than retention. Protect a fixed revision block and reduce unnecessary rereading.',
      actions:['Fix a daily revision block','Prioritise weak/recent chapters','Use recall instead of full rereading']
    },
    silly:{
      title:'Attention → Exam Habit Gap',
      text:'Silly mistakes need a repeatable checking habit. Identify whether they come from reading, marking, units, signs, option transfer or rushing.',
      actions:['Underline key words mentally','Pause before final marking','Keep a short silly-error checklist']
    }
  };

  const buttons=[...document.querySelectorAll('[data-problem]')];
  const title=document.getElementById('diagTitle');
  const text=document.getElementById('diagText');
  const actions=document.getElementById('diagActions');

  function showProblem(key){
    const d=diagnostics[key];
    if(!d)return;
    buttons.forEach(b=>b.classList.toggle('active',b.dataset.problem===key));
    title.textContent=d.title;
    text.textContent=d.text;
    actions.innerHTML=d.actions.map(a=>`<b>${a}</b>`).join('');
  }

  buttons.forEach(b=>b.addEventListener('click',()=>showProblem(b.dataset.problem)));

  const checks=[...document.querySelectorAll('.ready-check')];
  const score=document.getElementById('readinessScore');
  const bar=document.getElementById('readinessBar');
  const msg=document.getElementById('readinessMessage');

  function readiness(){
    const done=checks.filter(c=>c.checked).length;
    const pct=done*20;
    score.textContent=pct+'%';
    bar.style.width=pct+'%';
    if(pct===0) msg.textContent='Start with concept clarity. Preparation is built step by step.';
    else if(pct<=40) msg.textContent='Learning has started. Strengthen understanding and practice before calling the chapter complete.';
    else if(pct<=60) msg.textContent='Good progress. Now protect the chapter through recall, revision and testing.';
    else if(pct<=80) msg.textContent='The chapter is becoming strong. Check performance under time and after a gap.';
    else msg.textContent='Strong readiness signal. Keep the chapter alive through spaced revision and mixed tests.';
  }
  checks.forEach(c=>c.addEventListener('change',readiness));
  readiness();
})();
