export function normalizeLabel(value){
  return String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
}

export function buildSyllabusLookup({units=[],chapters=[],subtopics=[]}={}){
  const unitsBySubject=new Map();
  for(const u of units){
    const subject=normalizeLabel(u.subject), title=normalizeLabel(u.unit_title);
    const keys=[title,normalizeLabel(`Unit ${u.unit_no} ${u.unit_title}`),normalizeLabel(`${u.unit_no} ${u.unit_title}`)];
    if(!unitsBySubject.has(subject))unitsBySubject.set(subject,new Map());
    for(const key of keys.filter(Boolean)){
      const map=unitsBySubject.get(subject); const arr=map.get(key)||[]; arr.push(u); map.set(key,arr);
    }
  }
  const chaptersByUnit=new Map();
  for(const c of chapters){
    const key=String(c.unit_id), label=normalizeLabel(c.topic_title);
    if(!chaptersByUnit.has(key))chaptersByUnit.set(key,new Map());
    const map=chaptersByUnit.get(key), arr=map.get(label)||[]; arr.push(c); map.set(label,arr);
  }
  const topicsByChapter=new Map();
  for(const s of subtopics){
    const key=String(s.chapter_id), label=normalizeLabel(s.subtopic_title);
    if(!topicsByChapter.has(key))topicsByChapter.set(key,new Map());
    const map=topicsByChapter.get(key), arr=map.get(label)||[]; arr.push(s); map.set(label,arr);
  }
  return {unitsBySubject,chaptersByUnit,topicsByChapter};
}

function uniqueMatch(rows,label){
  const a=Array.isArray(rows)?rows:[];
  if(a.length===1)return {ok:true,row:a[0]};
  if(a.length>1)return {ok:false,error:`${label} is ambiguous`};
  return {ok:false,error:`${label} was not found`};
}

export function resolveSyllabusLabels(lookup,raw={}){
  const subjectText=String(raw.subject??'').trim();
  const subject=normalizeLabel(subjectText);
  if(!['physics','chemistry','biology'].includes(subject))return {ok:false,error:'Subject must be Physics, Chemistry or Biology'};
  const unitMap=lookup?.unitsBySubject?.get(subject);
  if(!unitMap)return {ok:false,error:`Unit was not found for ${subjectText||'Subject'}`};
  const um=uniqueMatch(unitMap.get(normalizeLabel(raw.unit)),'Unit'); if(!um.ok)return um;
  const chapterMap=lookup?.chaptersByUnit?.get(String(um.row.id));
  const cm=uniqueMatch(chapterMap?.get(normalizeLabel(raw.chapter)),'Chapter'); if(!cm.ok)return cm;
  const topicMap=lookup?.topicsByChapter?.get(String(cm.row.id));
  const candidates=topicMap?.get(normalizeLabel(raw.topic))||[];
  if(!candidates.length)return {ok:false,error:'Topic was not found under selected Chapter'};
  const approved=candidates.filter(x=>String(x.status||'').toLowerCase()==='approved');
  if(approved.length!==1)return {ok:false,error:approved.length>1?'Topic is ambiguous':'Topic is not approved'};
  return {ok:true,subject:um.row.subject,unitId:um.row.id,chapterId:cm.row.id,subtopicId:approved[0].id,unit:um.row,chapter:cm.row,topic:approved[0]};
}
