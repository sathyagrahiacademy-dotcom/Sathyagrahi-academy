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

export function normalizeTopicName(value){
  return String(value??'').trim().replace(/\s+/g,' ');
}

export function normaliseExamScopeDraftV2(items){
  if(!Array.isArray(items))return{ok:false,error:'Scope items must be an array'};
  const allowed=new Set(['Physics','Chemistry','Biology']);
  const out=[];
  const seen=new Set();
  for(let i=0;i<items.length;i++){
    const raw=items[i]||{};
    const subject=String(raw.subject||'').trim();
    const unitId=positiveInt(raw.unitId);
    const chapterId=positiveInt(raw.chapterId);
    const scopeType=String(raw.scopeType||((raw.subtopicId!=null&&raw.subtopicId!=='')?'topic':'chapter')).trim().toLowerCase();
    if(!allowed.has(subject))return{ok:false,error:`Select Subject for syllabus scope row ${i+1}`};
    if(!unitId)return{ok:false,error:`Select Unit for syllabus scope row ${i+1}`};
    if(!chapterId)return{ok:false,error:`Select Chapter for syllabus scope row ${i+1}`};
    if(!['chapter','topic'].includes(scopeType))return{ok:false,error:`Select Scope Type for syllabus scope row ${i+1}`};
    let topicName='',subtopicId=null,key='';
    if(scopeType==='topic'){
      topicName=normalizeTopicName(raw.topicName);
      if(!topicName)return{ok:false,error:`Enter Topic Name for syllabus scope row ${i+1}`};
      subtopicId=raw.subtopicId==null||raw.subtopicId===''?null:positiveInt(raw.subtopicId);
      if(raw.subtopicId!=null&&raw.subtopicId!==''&&!subtopicId)return{ok:false,error:`Invalid Topic for syllabus scope row ${i+1}`};
      key=subtopicId?`${unitId}:${chapterId}:id:${subtopicId}`:`${unitId}:${chapterId}:name:${topicName.toLowerCase()}`;
    }else{
      key=`${unitId}:${chapterId}:chapter`;
    }
    if(seen.has(key))return{ok:false,error:'Duplicate syllabus scope row'};
    seen.add(key);
    out.push({subject,unitId,chapterId,scopeType,topicName,subtopicId,sortOrder:i});
  }
  return{ok:true,items:out};
}
