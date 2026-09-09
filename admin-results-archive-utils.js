(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdminResultsArchiveUtils=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const TYPE_ORDER=['DT','WT','MT','GT'];
  const TYPE_NAMES={DT:'Daily Tests',WT:'Weekly Tests',MT:'Monthly Tests',GT:'Grand Tests'};

  function examOf(row){return row?.exam_attempts?.exams||{};}
  function examTypeCode(value){
    const v=String(value??'').trim().toLowerCase().replace(/[\s_-]+/g,'');
    if(['daily','dt','dailytest'].includes(v))return 'DT';
    if(['weekly','wt','weeklytest'].includes(v))return 'WT';
    if(['monthly','mt','monthlytest'].includes(v))return 'MT';
    if(['grand','gt','grandtest'].includes(v))return 'GT';
    return '';
  }
  function examMonthKey(value){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value??''));
    return m?`${m[1]}-${m[2]}`:'';
  }
  function monthLabel(key){
    const m=/^(\d{4})-(\d{2})$/.exec(String(key??''));
    if(!m)return String(key??'');
    const date=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,1));
    return new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  }
  function partitionResultRows(rows){
    const source=Array.isArray(rows)?rows:[];
    return {pending:source.filter(x=>!x?.is_published),published:source.filter(x=>Boolean(x?.is_published))};
  }
  function groupPublishedResults(rows){
    const months=new Map();
    for(const row of Array.isArray(rows)?rows:[]){
      const exam=examOf(row),key=examMonthKey(exam.exam_date),code=examTypeCode(exam.exam_type);
      if(!key||!code)continue;
      if(!months.has(key))months.set(key,{key,label:monthLabel(key),types:TYPE_ORDER.map(c=>({code:c,label:TYPE_NAMES[c],exams:[]}))});
      const bucket=months.get(key).types.find(x=>x.code===code);
      const examId=String(exam.id||row?.exam_attempts?.exam_id||'');
      let examBucket=bucket.exams.find(x=>x.id===examId);
      if(!examBucket){
        examBucket={id:examId,title:String(exam.title||'Untitled Exam'),exam_date:String(exam.exam_date||''),subject:String(exam.subject||''),rows:[]};
        bucket.exams.push(examBucket);
      }
      examBucket.rows.push(row);
    }
    const result=[...months.values()].sort((a,b)=>b.key.localeCompare(a.key));
    for(const month of result){
      for(const type of month.types){
        type.exams.sort((a,b)=>String(b.exam_date).localeCompare(String(a.exam_date))||a.title.localeCompare(b.title));
      }
    }
    return result;
  }
  return{TYPE_ORDER,TYPE_NAMES,examTypeCode,examMonthKey,monthLabel,partitionResultRows,groupPublishedResults};
});
