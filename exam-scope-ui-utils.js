(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ExamScopeUIUtils=api;
})(typeof window!=='undefined'?window:null,function(){
  const list=v=>Array.isArray(v)?v:[];
  const pos=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
  const normalizeTopicName=v=>String(v??'').trim().replace(/\s+/g,' ');

  function unitsForSubject(tree,subject){return list(tree).filter(x=>!subject||String(x.subject)===String(subject));}
  function findUnit(tree,unitId){return list(tree).find(x=>String(x.id)===String(unitId));}
  function chaptersForUnit(tree,unitId){return list(findUnit(tree,unitId)?.chapters);}
  function findChapter(tree,chapterId){for(const unit of list(tree)){const chapter=list(unit.chapters).find(x=>String(x.id)===String(chapterId));if(chapter)return chapter;}return null;}
  function approvedSubtopicsForChapter(tree,chapterId){return list(findChapter(tree,chapterId)?.subtopics).filter(x=>x.status==='approved');}
  function activeTopicSuggestionsForChapter(tree,chapterId){return list(findChapter(tree,chapterId)?.subtopics).filter(x=>x.status!=='disabled');}

  function key(row){return `${Number(row?.unitId)||0}:${Number(row?.chapterId)||0}:${row?.subtopicId==null||row?.subtopicId===''?0:Number(row.subtopicId)||0}`;}
  function isDuplicateScopeRow(rows,candidate,ignoreIndex=-1){const target=key(candidate);return list(rows).some((row,i)=>i!==ignoreIndex&&key(row)===target);}
  function normaliseScopeDraft(rows){const out=[],seen=new Set();for(let i=0;i<list(rows).length;i++){const raw=rows[i]||{},unitId=pos(raw.unitId),chapterId=pos(raw.chapterId);const subtopicId=raw.subtopicId==null||raw.subtopicId===''?null:pos(raw.subtopicId);if(!unitId||!chapterId||(raw.subtopicId!=null&&raw.subtopicId!==''&&!subtopicId))return{ok:false,error:`Complete syllabus scope row ${i+1}`};const k=`${unitId}:${chapterId}:${subtopicId??0}`;if(seen.has(k))return{ok:false,error:'Duplicate syllabus scope row'};seen.add(k);out.push({unitId,chapterId,subtopicId,sortOrder:i});}return{ok:true,items:out};}

  function normaliseScopeDraftV2(rows){
    const out=[],seen=new Set(),allowed=new Set(['Physics','Chemistry','Biology']);
    for(let i=0;i<list(rows).length;i++){
      const raw=rows[i]||{},subject=String(raw.subject||'').trim(),unitId=pos(raw.unitId),chapterId=pos(raw.chapterId);
      const scopeType=String(raw.scopeType||((raw.subtopicId!=null&&raw.subtopicId!=='')?'topic':'chapter')).trim().toLowerCase();
      if(!allowed.has(subject))return{ok:false,error:`Select Subject for syllabus scope row ${i+1}`};
      if(!unitId)return{ok:false,error:`Select Unit for syllabus scope row ${i+1}`};
      if(!chapterId)return{ok:false,error:`Select Chapter for syllabus scope row ${i+1}`};
      if(!['chapter','topic'].includes(scopeType))return{ok:false,error:`Select Scope Type for syllabus scope row ${i+1}`};
      let topicName='',subtopicId=null,k='';
      if(scopeType==='topic'){
        topicName=normalizeTopicName(raw.topicName);
        if(!topicName)return{ok:false,error:`Enter Topic Name for syllabus scope row ${i+1}`};
        subtopicId=raw.subtopicId==null||raw.subtopicId===''?null:pos(raw.subtopicId);
        if(raw.subtopicId!=null&&raw.subtopicId!==''&&!subtopicId)return{ok:false,error:`Invalid Topic for syllabus scope row ${i+1}`};
        k=subtopicId?`${unitId}:${chapterId}:id:${subtopicId}`:`${unitId}:${chapterId}:name:${topicName.toLowerCase()}`;
      }else{k=`${unitId}:${chapterId}:chapter`;}
      if(seen.has(k))return{ok:false,error:'Duplicate syllabus scope row'};
      seen.add(k);out.push({subject,unitId,chapterId,scopeType,topicName,subtopicId,sortOrder:i});
    }
    return{ok:true,items:out};
  }

  return{unitsForSubject,chaptersForUnit,approvedSubtopicsForChapter,activeTopicSuggestionsForChapter,isDuplicateScopeRow,normaliseScopeDraft,normalizeTopicName,normaliseScopeDraftV2};
});