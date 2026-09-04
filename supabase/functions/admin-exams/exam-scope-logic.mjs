function positiveInt(value){
  const n=Number(value);
  return Number.isInteger(n)&&n>0?n:null;
}

export function normaliseExamScopeItems(items){
  if(!Array.isArray(items))return{ok:false,error:'Scope items must be an array'};
  const out=[];
  const seen=new Set();
  for(let i=0;i<items.length;i++){
    const raw=items[i]||{};
    const unitId=positiveInt(raw.unitId);
    const chapterId=positiveInt(raw.chapterId);
    const subtopicId=raw.subtopicId==null||raw.subtopicId===''?null:positiveInt(raw.subtopicId);
    if(!unitId||!chapterId||(raw.subtopicId!=null&&raw.subtopicId!==''&&!subtopicId))return{ok:false,error:`Invalid scope row ${i+1}`};
    const key=`${unitId}:${chapterId}:${subtopicId??0}`;
    if(seen.has(key))return{ok:false,error:'Duplicate exam scope row'};
    seen.add(key);
    out.push({unitId,chapterId,subtopicId,sortOrder:i});
  }
  return{ok:true,items:out};
}

export function canSaveExamScope({action,hadStructuredScope,items}){
  const rows=Array.isArray(items)?items:[];
  if(action==='create'&&!rows.length)return{ok:false,error:'Add at least one syllabus scope row'};
  if(action==='update'&&hadStructuredScope&&!rows.length)return{ok:false,error:'Structured exam scope cannot be cleared'};
  return{ok:true};
}

function mapGet(map,key){
  if(!map?.get)return null;
  return map.get(key)||map.get(String(key))||null;
}

export function buildExamScopeSummary(items,lookup={}){
  const labels=[];
  const seen=new Set();
  for(const item of Array.isArray(items)?items:[]){
    const chapter=mapGet(lookup.chapters,item.chapterId??item.chapter_id);
    const subtopic=mapGet(lookup.subtopics,item.subtopicId??item.subtopic_id);
    const label=[chapter?.topic_title,subtopic?.subtopic_title].filter(Boolean).join(' • ');
    if(label&&!seen.has(label)){seen.add(label);labels.push(label);}
  }
  return labels.join('; ');
}
