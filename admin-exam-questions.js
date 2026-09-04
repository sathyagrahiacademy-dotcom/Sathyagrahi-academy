(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const examId = params.get("exam");
  let supabase;
  let editingQuestionId = null;

  function msg(text, ok=false){ $("message").textContent=text; $("message").className="msg "+(ok?"ok":"error"); }
  function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  async function getClient(){
    if (window.sgaSupabase) return window.sgaSupabase;
    throw new Error("Supabase client/config not found.");
  }

  async function invoke(body){
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Admin login required.");
    const { data, error } = await supabase.functions.invoke("admin-exam-questions", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function invokeBank(body){
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Admin login required.");
    const { data, error } = await supabase.functions.invoke("admin-question-bank", { body });
    if (error){
      let detail=null;
      try{ detail=await error.context?.json?.(); }catch(_){}
      const e=new Error(detail?.error||error.message||"Question Bank operation failed.");
      e.details=Array.isArray(detail?.errors)?detail.errors:[];
      throw e;
    }
    if(data?.error){ const e=new Error(data.error); e.details=Array.isArray(data.errors)?data.errors:[]; throw e; }
    return data;
  }

  let bulkQuestions = [];
  const requiredHeaders = ["Question No","Subject","Unit","Chapter","Topic","Question","Option A","Option B","Option C","Option D","Correct Answer","Marks","Negative Marks","Explanation","Difficulty","Question Type","Source","Source Year"];

  function normalizeHeader(s){ return String(s??"").trim().toLowerCase().replace(/[^a-z0-9]/g,""); }
  function cell(row,names){
    const keys=Object.keys(row), wanted=names.map(normalizeHeader);
    const key=keys.find(k=>wanted.includes(normalizeHeader(k)));
    return key ? row[key] : "";
  }
  function parseRows(rows){
    return rows.filter(r=>Object.values(r).some(v=>String(v??"").trim()!=="")).map(r=>({
      questionNo:Number(cell(r,["Question No","question_no","questionno"])),
      subject:String(cell(r,["Subject"])).trim(),
      unit:String(cell(r,["Unit","Unit Title","unit_title"])).trim(),
      chapter:String(cell(r,["Chapter","Chapter Title","chapter_title"])).trim(),
      topic:String(cell(r,["Topic","Topic/Subtopic","Subtopic"])).trim(),
      questionText:String(cell(r,["Question","question_text","questiontext"])).trim(),
      optionA:String(cell(r,["Option A","option_a","optiona"])).trim(),
      optionB:String(cell(r,["Option B","option_b","optionb"])).trim(),
      optionC:String(cell(r,["Option C","option_c","optionc"])).trim(),
      optionD:String(cell(r,["Option D","option_d","optiond"])).trim(),
      correctOption:String(cell(r,["Correct Answer","correct_option","correctanswer"])).trim().toUpperCase(),
      marks:Number(cell(r,["Marks"]) || 4),
      negativeMarks:Number(cell(r,["Negative Marks","negative_marks","negativemarks"]) || 0),
      explanation:String(cell(r,["Explanation"])).trim(),
      difficulty:String(cell(r,["Difficulty"])).trim(),
      questionType:String(cell(r,["Question Type","question_type","Type"])).trim(),
      source:String(cell(r,["Source","Source Label"])).trim(),
      sourceYear:String(cell(r,["Source Year","source_year"])).trim()
    }));
  }
  function validateBulk(rows){
    const errors=[], seen=new Set();
    rows.forEach((q,i)=>{
      const r=i+2;
      if(!Number.isInteger(q.questionNo)||q.questionNo<=0) errors.push(`Row ${r}: invalid Question No.`);
      for(const [label,value] of [["Subject",q.subject],["Unit",q.unit],["Chapter",q.chapter],["Topic",q.topic]]) if(!value) errors.push(`Row ${r}: ${label} is required for automatic mapping.`);
      if(!q.questionText) errors.push(`Row ${r}: Question is missing.`);
      [q.optionA,q.optionB,q.optionC,q.optionD].forEach((v,j)=>{ if(!v) errors.push(`Row ${r}: Option ${"ABCD"[j]} is missing.`); });
      if(!["A","B","C","D"].includes(q.correctOption)) errors.push(`Row ${r}: Correct Answer must be A, B, C or D.`);
      if(!Number.isFinite(q.marks)||q.marks<=0) errors.push(`Row ${r}: invalid Marks.`);
      if(!Number.isFinite(q.negativeMarks)||q.negativeMarks<0) errors.push(`Row ${r}: invalid Negative Marks.`);
      if(q.difficulty&&!['easy','medium','hard'].includes(q.difficulty.toLowerCase())) errors.push(`Row ${r}: Difficulty must be Easy, Medium or Hard.`);
      if(q.sourceYear&&(!/^\d{4}$/.test(q.sourceYear)||Number(q.sourceYear)<1900||Number(q.sourceYear)>2200)) errors.push(`Row ${r}: invalid Source Year.`);
      if(seen.has(q.questionNo)) errors.push(`Row ${r}: duplicate Question No. ${q.questionNo}.`);
      seen.add(q.questionNo);
    });
    return errors;
  }

  $("downloadTemplate").addEventListener("click",()=>{
    const sample=[{
      "Question No":1,"Subject":"Physics","Unit":"Kinematics","Chapter":"Motion in a Plane","Topic":"Projectile Motion",
      "Question":"A projectile is launched horizontally. Which component of velocity remains constant?","Option A":"Horizontal","Option B":"Vertical","Option C":"Both","Option D":"Neither",
      "Correct Answer":"A","Marks":4,"Negative Marks":1,"Explanation":"Ignoring air resistance, horizontal acceleration is zero.",
      "Difficulty":"Medium","Question Type":"Concept","Source":"AI Practice","Source Year":""
    }];
    const ws=XLSX.utils.json_to_sheet(sample,{header:requiredHeaders});
    ws["!cols"]=[{wch:12},{wch:14},{wch:28},{wch:30},{wch:28},{wch:52},{wch:22},{wch:22},{wch:22},{wch:22},{wch:16},{wch:10},{wch:16},{wch:45},{wch:12},{wch:18},{wch:18},{wch:12}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Questions");
    XLSX.writeFile(wb,"Sathyagrahi_AI_Exam_Questions_AutoMap_Template.xlsx");
  });

  $("bulkFile").addEventListener("change",async e=>{
    bulkQuestions=[]; $("importQuestions").disabled=true; $("bulkErrors").textContent="";
    const file=e.target.files?.[0];
    if(!file){ $("bulkSummary").textContent="No file selected."; return; }
    try{
      const data=await file.arrayBuffer(), wb=XLSX.read(data,{type:"array"});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      bulkQuestions=parseRows(rows);
      const errors=validateBulk(bulkQuestions);
      if(!bulkQuestions.length) throw new Error("No question rows found in this file.");
      if(errors.length){
        $("bulkSummary").textContent=`${bulkQuestions.length} row(s) found, but validation failed.`;
        $("bulkSummary").className="msg error";
        $("bulkErrors").innerHTML=errors.slice(0,25).map(esc).join("<br>");
        return;
      }
      $("bulkSummary").textContent=`Ready: ${bulkQuestions.length} question(s). Official Subject → Unit → Chapter → Topic will be verified and AUTO MAPPED on import.`;
      $("bulkSummary").className="msg ok";
      $("importQuestions").disabled=false;
    }catch(err){
      $("bulkSummary").textContent=err.message||"Could not read file.";
      $("bulkSummary").className="msg error";
    }
  });

  $("importQuestions").addEventListener("click",async()=>{
    if(!bulkQuestions.length) return;
    if(!confirm(`Validate, auto-map and import ${bulkQuestions.length} questions into this exam and permanent Question Bank?`)) return;
    const btn=$("importQuestions"); btn.disabled=true; btn.textContent="VALIDATING & IMPORTING..."; $("bulkErrors").textContent="";
    try{
      const data=await invokeBank({action:"bulk_import",examId,questions:bulkQuestions});
      msg(`${data.imported||bulkQuestions.length} imported • ${data.autoMapped||0} auto-mapped • Bank: ${data.bankCreated||0} new, ${data.bankReused||0} reused.`,true);
      bulkQuestions=[]; $("bulkFile").value=""; $("bulkSummary").textContent="No file selected."; $("bulkSummary").className="msg"; $("bulkErrors").textContent="";
      await load();
    }catch(err){
      msg(err.message||"Bulk import failed.");
      if(Array.isArray(err.details)&&err.details.length) $("bulkErrors").innerHTML=err.details.slice(0,50).map(esc).join("<br>");
    }
    finally{ btn.textContent="IMPORT ALL QUESTIONS"; btn.disabled=true; }
  });

  async function load(){
    if(!examId){ msg("Exam ID missing."); return; }
    supabase = await getClient();
    const {data:exam,error:e1}=await supabase.from("exams").select("id,title,subject,syllabus,is_published").eq("id",examId).single();
    if(e1) throw e1;
    $("examName").textContent=`${exam.title} • ${exam.subject}${exam.syllabus ? " • "+exam.syllabus : ""}${exam.is_published ? " • PUBLISHED" : " • DRAFT"}`;
    const {data:q,error:e2}=await supabase.from("exam_questions").select("id,question_no,question_text,marks").eq("exam_id",examId).order("question_no");
    if(e2) throw e2;
    $("count").textContent=`${q.length} question(s)`;
    $("questionNo").value=(q.length?Math.max(...q.map(x=>x.question_no))+1:1);
    $("questionsBody").innerHTML=q.length?q.map(x=>`<tr><td>${x.question_no}</td><td>${esc(x.question_text)}</td><td>${x.marks}</td><td><button class="secondary" data-edit="${x.id}">EDIT</button> <button class="danger" data-del="${x.id}">DELETE</button></td></tr>`).join(""):`<tr><td colspan="4">No questions added yet.</td></tr>`;
  }

  $("questionForm").addEventListener("submit", async e=>{
    e.preventDefault(); msg("Saving...");
    try{
      await invoke({action:editingQuestionId?"update":"add",questionId:editingQuestionId||undefined,examId,questionNo:Number($("questionNo").value),questionText:$("questionText").value,optionA:$("optionA").value,optionB:$("optionB").value,optionC:$("optionC").value,optionD:$("optionD").value,correctOption:$("correctOption").value,marks:Number($("marks").value),negativeMarks:Number($("negativeMarks").value),explanation:$("explanation").value});
      e.target.reset(); $("marks").value=4; $("negativeMarks").value=1; msg(editingQuestionId?"Question updated successfully.":"Question saved successfully. Map it below to sync it into the permanent Question Bank.",true); editingQuestionId=null; $("saveQuestionBtn").textContent="SAVE QUESTION"; $("cancelEditQuestion").style.display="none"; await load();
    }catch(err){ msg(err.message||"Could not save question."); }
  });

  $("questionsBody").addEventListener("click", async e=>{
    const editId=e.target?.dataset?.edit;
    const delId=e.target?.dataset?.del;
    if(editId){
      try{
        const data=await invoke({action:"get",questionId:editId});
        const q=data.question;
        editingQuestionId=q.id;
        $("questionNo").value=q.question_no;
        $("questionText").value=q.question_text||"";
        $("optionA").value=q.option_a||"";
        $("optionB").value=q.option_b||"";
        $("optionC").value=q.option_c||"";
        $("optionD").value=q.option_d||"";
        $("correctOption").value=q.correct_option||"";
        $("marks").value=q.marks;
        $("negativeMarks").value=q.negative_marks;
        $("explanation").value=q.explanation||"";
        $("saveQuestionBtn").textContent="UPDATE QUESTION";
        $("cancelEditQuestion").style.display="inline-block";
        window.scrollTo({top:0,behavior:"smooth"});
        msg("Editing Question No. "+q.question_no,true);
      }catch(err){msg(err.message||"Could not load question.");}
      return;
    }
    if(!delId) return;
    if(!confirm("Delete this question?")) return;
    try{ await invoke({action:"delete",questionId:delId}); msg("Question deleted.",true); await load(); }catch(err){msg(err.message||"Could not delete question.");}
  });

  $("cancelEditQuestion").addEventListener("click",()=>{editingQuestionId=null;$("questionForm").reset();$("marks").value=4;$("negativeMarks").value=1;$("saveQuestionBtn").textContent="SAVE QUESTION";$("cancelEditQuestion").style.display="none";load();msg("Edit cancelled.",true);});

  load().catch(e=>msg(e.message||"Could not load questions."));
})();