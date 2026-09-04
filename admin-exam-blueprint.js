(()=>{
  const c=window.sgaSupabase;
  if(!c)return;
  const tbody=document.getElementById('rows');
  if(!tbody)return;
  const escFile=v=>String(v||'Exam').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'');
  const ist=v=>{if(!v)return 'Not conducted';try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch(_){return String(v)}};
  async function invoke(examId){
    const {data,error}=await c.functions.invoke('admin-exam-blueprint',{body:{examId}});
    if(error){let d=null;try{d=await error.context?.json?.()}catch(_){}throw new Error(d?.error||error.message||'Could not load blueprint data.');}
    if(data?.error)throw new Error(data.error);return data;
  }
  function addBlueprintButtons(){
    tbody.querySelectorAll('tr').forEach(row=>{
      const source=row.querySelector('[data-id]');
      const cell=row.lastElementChild;
      if(!source||!cell||cell.querySelector('[data-blueprint]'))return;
      const b=document.createElement('button');b.type='button';b.className='small-btn';b.dataset.blueprint=source.dataset.id;b.textContent='BLUEPRINT PDF';b.title='Download detailed Exam Blueprint PDF';cell.appendChild(b);
    });
  }
  const observer=new MutationObserver(addBlueprintButtons);observer.observe(tbody,{childList:true,subtree:true});addBlueprintButtons();

  async function downloadBlueprint(examId,button){
    const old=button.textContent;button.disabled=true;button.textContent='BUILDING...';
    try{
      if(!window.jspdf?.jsPDF)throw new Error('PDF engine is still loading. Please try again.');
      const data=await invoke(examId);
      const {buildBlueprintModel}=await import('./exam-blueprint-utils.mjs?v=20260905-1');
      const model=buildBlueprintModel(data),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
      if(typeof doc.autoTable!=='function')throw new Error('PDF table engine is still loading. Please try again.');
      const BLUE=[6,39,95],ORANGE=[224,116,40],INK=[28,39,55],MUTED=[100,116,139];
      const exam=data.exam||{},validation=data.validation||{},audience=data.audience||{},conduct=data.conduct||{};
      const margin=14,pageW=doc.internal.pageSize.getWidth();
      doc.setFillColor(...BLUE);doc.rect(0,0,pageW,27,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('SATHYAGRAHI ACADEMY',margin,11);
      doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('NEET Examination Branch • Detailed Exam Blueprint',margin,18);
      doc.setFillColor(...ORANGE);doc.rect(0,26,pageW,1.3,'F');
      doc.setTextColor(...INK);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(exam.title||'Exam Blueprint',margin,38);
      doc.setFontSize(9);doc.setTextColor(...MUTED);doc.text(`${model.status} • ${exam.exam_code||'NO CODE'}`,margin,44);
      let y=50;
      const section=(title,head,body)=>{
        doc.setTextColor(...BLUE);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(title,margin,y);y+=3;
        doc.autoTable({startY:y,head:[head],body,theme:'grid',margin:{left:margin,right:margin},styles:{fontSize:8,cellPadding:2,textColor:INK},headStyles:{fillColor:BLUE,textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
        y=doc.lastAutoTable.finalY+7;if(y>265){doc.addPage();y=18;}
      };
      section('1. Exam Identity',['Field','Details'],[
        ['Exam Code',exam.exam_code||'—'],['Exam Type',exam.subject||'—'],['Duration',`${Number(exam.duration_minutes||0)} minutes`],['Total Marks',String(exam.total_marks??'—')],['Negative Marking',exam.negative_marking?'Enabled':'Disabled'],['Status',String(exam.status||'draft').toUpperCase()],['Publish Status',exam.is_published?'Published':'Not Published']
      ]);
      const coverage=(data.coverage||[]).map(s=>[s.subject||'—',s.unitTitle||'—',s.chapterTitle||'—',s.scopeType==='topic'?(s.topicTitle||'Specific Topic'):'Whole Chapter']);
      section('2. Syllabus Coverage',['Subject','Unit','Chapter','Scope'],coverage.length?coverage:[['—','—','—','No structured coverage']]);
      const distRows=(rows,label)=>rows.map(r=>[label,r.label,String(r.questions),String(Number(r.marks||0))]);
      section('3. Question Distribution',['Level','Syllabus Area','Questions','Marks'],[
        ...distRows(model.subjects,'Subject'),...distRows(model.units,'Unit'),...distRows(model.chapters,'Chapter'),...distRows(model.topics,'Topic')
      ].length?[...distRows(model.subjects,'Subject'),...distRows(model.units,'Unit'),...distRows(model.chapters,'Chapter'),...distRows(model.topics,'Topic')]:[['—','No questions yet','0','0']]);
      section('4. Mapping Blueprint',['Question Range','Subject','Unit','Chapter','Topic','Coverage'],(data.mappings||[]).map(m=>[m.selector_text||'—',m.subject||'—',m.unitTitle||'—',m.chapterTitle||'—',m.topicTitle||'—',String(m.coverage||'partial').toUpperCase()]).length?(data.mappings||[]).map(m=>[m.selector_text||'—',m.subject||'—',m.unitTitle||'—',m.chapterTitle||'—',m.topicTitle||'—',String(m.coverage||'partial').toUpperCase()]):[['—','—','—','—','No mappings','—']]);
      section('5. Marks / Difficulty / Type',['Dimension','Value','Questions','Marks'],[
        ['Overall','Total',String(model.totalQuestions),String(model.totalMarks)],
        ...model.difficulty.map(r=>['Difficulty',r.label,String(r.questions),String(r.marks)]),
        ...model.types.map(r=>['Question Type',r.label,String(r.questions),String(r.marks)])
      ]);
      section('6. Validation Status',['Check','Status'],[
        ['Questions',String(validation.totalQuestions||0)],['Mapped',`${validation.mappedQuestions||0}/${validation.totalQuestions||0}`],['Answer Keys',`${validation.keyedQuestions||0}/${validation.totalQuestions||0}`],['Question Marks Total',String(validation.questionMarksTotal||0)],['Exam Total Marks',String(validation.totalMarks||0)],['Marks Match',validation.marksMatch?'YES':'NO'],['Publish Ready',validation.publishReady?'YES':'NO']
      ]);
      section('7. Audience / Conduct',['Field','Details'],[
        ['Audience',String(audience.mode||'all').toUpperCase()],['Assigned Students',String(audience.assignedCount||0)],['First Valid Submission',ist(conduct.firstSubmittedAt)]
      ]);
      const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(7);doc.setTextColor(...MUTED);doc.text(`Sathyagrahi Academy • ${exam.exam_code||''} • Page ${p}/${pages}`,margin,291);}
      doc.save(`${escFile(exam.exam_code||exam.title)}_Exam_Blueprint.pdf`);
    }catch(err){alert(err.message||'Could not generate Blueprint PDF.');}
    finally{button.disabled=false;button.textContent=old;}
  }
  tbody.addEventListener('click',e=>{const b=e.target.closest('[data-blueprint]');if(b){e.preventDefault();e.stopPropagation();downloadBlueprint(b.dataset.blueprint,b);}});
})();