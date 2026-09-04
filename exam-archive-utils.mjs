const TIME_ZONE='Asia/Kolkata';

function submittedDate(attempt){
  if(String(attempt?.status||'')!=='submitted'||!attempt?.submitted_at)return null;
  const d=new Date(attempt.submitted_at);
  return Number.isNaN(d.getTime())?null:d;
}

function monthParts(date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit'}).formatToParts(date);
  const year=parts.find(p=>p.type==='year')?.value||'';
  const month=parts.find(p=>p.type==='month')?.value||'';
  return {key:`${year}-${month}`,year,month};
}

function monthLabel(date){
  return new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,month:'long',year:'numeric'}).format(date);
}

export function firstSubmittedAt(examId,attempts=[]){
  const dates=attempts.filter(a=>String(a?.exam_id)===String(examId)).map(submittedDate).filter(Boolean).sort((a,b)=>a-b);
  return dates[0]||null;
}

export function groupExamArchive(exams=[],attempts=[]){
  const current=[];
  const byMonth=new Map();
  for(const exam of exams){
    const first=firstSubmittedAt(exam?.id,attempts);
    if(!first){current.push(exam);continue;}
    const {key}=monthParts(first);
    if(!byMonth.has(key))byMonth.set(key,{key,label:monthLabel(first),conductedAt:first.toISOString(),exams:[]});
    const bucket=byMonth.get(key);
    bucket.exams.push(exam);
    if(first.toISOString()<bucket.conductedAt)bucket.conductedAt=first.toISOString();
  }
  const months=[...byMonth.values()].sort((a,b)=>b.key.localeCompare(a.key));
  return {current,months};
}
