import { validateQuestionType, validateOfficialQuestionMarking } from '../_shared/exam-intelligence-policy.mjs';

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

function text(value){return String(value??'').trim()}
function requiredNumber(value){
  const raw=text(value);
  if(!raw)return {ok:false,value:null};
  const n=Number(raw);
  return Number.isFinite(n)?{ok:true,value:n}:{ok:false,value:null};
}

export function validateImportQuestions(lookup,rawQuestions=[]){
  const rows=Array.isArray(rawQuestions)?rawQuestions:[];
  const errors=[],resolved=[],seen=new Set();
  rows.forEach((q,i)=>{
    const row=i+2,rowErrors=[];
    const add=message=>{rowErrors.push(`Row ${row}: ${message}`)};
    const questionNo=Number(q?.questionNo);
    if(!Number.isInteger(questionNo)||questionNo<=0)add('invalid Question No.');
    else if(seen.has(questionNo))add(`duplicate Question No. ${questionNo}.`);
    else seen.add(questionNo);

    const syllabus=resolveSyllabusLabels(lookup,q||{});
    if(!syllabus.ok)add(syllabus.error+'.');

    const questionText=text(q?.questionText),optionA=text(q?.optionA),optionB=text(q?.optionB),optionC=text(q?.optionC),optionD=text(q?.optionD);
    if(!questionText)add('Question is missing.');
    for(const [label,value] of [['A',optionA],['B',optionB],['C',optionC],['D',optionD]])if(!value)add(`Option ${label} is missing.`);
    const correctOption=text(q?.correctOption).toUpperCase();
    if(!['A','B','C','D'].includes(correctOption))add('Correct Answer must be A, B, C or D.');

    const marks=requiredNumber(q?.marks),negative=requiredNumber(q?.negativeMarks);
    if(!marks.ok||marks.value<=0)add('Marks is required and must be a number greater than 0.');
    if(!negative.ok||negative.value<0)add('Negative Marks is required and must be a number 0 or greater.');
    if(marks.ok&&negative.ok&&marks.value>0&&negative.value>=0){
      const officialMarking=validateOfficialQuestionMarking({marks:marks.value,negativeMarks:negative.value});
      if(!officialMarking.ok)add(officialMarking.error+'.');
    }

    const difficultyRaw=text(q?.difficulty),difficulty=difficultyRaw?difficultyRaw[0].toUpperCase()+difficultyRaw.slice(1).toLowerCase():'';
    if(difficulty&&!['Easy','Medium','Hard'].includes(difficulty))add('Difficulty must be Easy, Medium or Hard.');
    const questionType=text(q?.questionType);
    if(syllabus.ok){
      const typeValidation=validateQuestionType(syllabus.subject,questionType);
      if(!typeValidation.ok)add(typeValidation.error+'.');
    }
    const sourceYearRaw=text(q?.sourceYear);
    const sourceYear=sourceYearRaw?Number(sourceYearRaw):null;
    if(sourceYearRaw&&(!/^\d{4}$/.test(sourceYearRaw)||!Number.isInteger(sourceYear)||sourceYear<1900||sourceYear>2200))add('invalid Source Year.');

    errors.push(...rowErrors);
    if(!rowErrors.length&&syllabus.ok){
      resolved.push({
        questionNo,subject:syllabus.subject,unitId:syllabus.unitId,chapterId:syllabus.chapterId,subtopicId:syllabus.subtopicId,
        questionText,optionA,optionB,optionC,optionD,correctOption,marks:marks.value,negativeMarks:negative.value,
        explanation:text(q?.explanation),difficulty,questionType,source:text(q?.source),sourceYear
      });
    }
  });
  return {ok:errors.length===0,errors,items:errors.length?[]:resolved};
}
