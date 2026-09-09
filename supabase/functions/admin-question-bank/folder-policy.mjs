const SUBJECTS=['Physics','Chemistry','Biology'];
const SORTS=new Set(['newest','oldest','difficulty','question_type','source','source_year']);
const positiveInt=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const order=(a,b)=>Number(a?.sort_order||0)-Number(b?.sort_order||0)||Number(a?.id||0)-Number(b?.id||0);

export function normalizeTopicQuestionRequest(input={}){
  const subject=String(input.subject||'').trim();
  const unitId=positiveInt(input.unitId),chapterId=positiveInt(input.chapterId),subtopicId=positiveInt(input.subtopicId);
  const sort=String(input.sort||'newest').toLowerCase();
  const search=String(input.search||'').trim().slice(0,160);
  const limit=input.limit==null?50:Number(input.limit);
  const offset=input.offset==null?0:Number(input.offset);
  if(!SUBJECTS.includes(subject)||!unitId||!chapterId||!subtopicId)return{ok:false,error:'Canonical Subject, Unit, Chapter and Topic are required'};
  if(!SORTS.has(sort))return{ok:false,error:'Unsupported question sort'};
  if(!Number.isInteger(limit)||limit<1||limit>100)return{ok:false,error:'Question page size must be 1 to 100'};
  if(!Number.isInteger(offset)||offset<0)return{ok:false,error:'Question offset must be zero or greater'};
  return{ok:true,value:{subject,unitId,chapterId,subtopicId,sort,search,limit,offset}};
}

export function buildFolderSummary(tree={units:[],chapters:[],subtopics:[]},rows=[]){
  const countByTopic=new Map();
  for(const row of rows||[]){
    const key=String(row?.subtopic_id??'');
    if(key)countByTopic.set(key,(countByTopic.get(key)||0)+1);
  }
  const chaptersByUnit=new Map();
  for(const chapter of (tree.chapters||[]).slice().sort(order)){
    const key=String(chapter.unit_id);
    if(!chaptersByUnit.has(key))chaptersByUnit.set(key,[]);
    chaptersByUnit.get(key).push(chapter);
  }
  const topicsByChapter=new Map();
  for(const topic of (tree.subtopics||[]).filter(x=>!x.status||x.status==='approved').slice().sort(order)){
    const key=String(topic.chapter_id);
    if(!topicsByChapter.has(key))topicsByChapter.set(key,[]);
    topicsByChapter.get(key).push(topic);
  }
  const subjects=SUBJECTS.map(subject=>{
    const chapters=[];
    const units=(tree.units||[]).filter(unit=>unit.subject===subject).slice().sort(order);
    for(const unit of units){
      for(const chapter of chaptersByUnit.get(String(unit.id))||[]){
        const topics=(topicsByChapter.get(String(chapter.id))||[]).map(topic=>({
          id:topic.id,
          title:topic.subtopic_title||'',
          count:countByTopic.get(String(topic.id))||0
        }));
        chapters.push({
          id:chapter.id,
          title:chapter.topic_title||'',
          unitId:unit.id,
          unitNo:unit.unit_no??null,
          unitTitle:unit.unit_title||'',
          count:topics.reduce((sum,topic)=>sum+topic.count,0),
          topics
        });
      }
    }
    return{subject,count:chapters.reduce((sum,chapter)=>sum+chapter.count,0),chapters};
  });
  return{total:subjects.reduce((sum,subject)=>sum+subject.count,0),subjects};
}
