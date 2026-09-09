import { MASTER_EXAM_TYPES, normaliseMasterExamType } from '../_shared/exam-master-policy.mjs'

function isRealIsoDate(value){
  const text=String(value??'').trim()
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const d=new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===text
}

function positiveInt(value){
  const n=Number(value)
  return Number.isInteger(n)&&n>0?n:null
}

function mapGet(map,key){
  return map?.get?.(key) ?? map?.get?.(String(key))
}

export function validateResultRelease({mode,publishAt,now=new Date().toISOString()}={}){
  const value=String(mode??'').trim().toLowerCase()
  if(value==='manual') return {ok:true,mode:'manual',publishAt:null}
  if(value!=='scheduled') return {ok:false,error:'Result Publication Mode must be Manual or Scheduled'}
  const at=String(publishAt??'').trim()
  const when=new Date(at)
  const current=new Date(now)
  if(!at||Number.isNaN(when.getTime())) return {ok:false,error:'Scheduled result publication date/time is required'}
  if(Number.isNaN(current.getTime())||when.getTime()<=current.getTime()) return {ok:false,error:'Scheduled result publication must be in the future'}
  return {ok:true,mode:'scheduled',publishAt:when.toISOString()}
}

export function normaliseWizardBasics(input={}){
  const examType=normaliseMasterExamType(input.examType)
  if(!examType) return {ok:false,error:'Select Daily, Weekly, Monthly or Grand Test'}
  const batchNo=positiveInt(input.batchNo)
  if(batchNo==null||batchNo>99) return {ok:false,error:'Batch must be 1 to 99'}
  const examDate=String(input.examDate??'').trim()
  if(!isRealIsoDate(examDate)) return {ok:false,error:'Enter valid Exam Date'}
  const title=String(input.title??'').trim()
  if(!title) return {ok:false,error:'Exam Title is required'}
  const expectedQuestions=positiveInt(input.expectedQuestions)
  if(expectedQuestions==null) return {ok:false,error:'Expected Questions must be a positive integer'}
  const durationMinutes=positiveInt(input.durationMinutes)
  if(durationMinutes==null) return {ok:false,error:'Duration must be a positive number of minutes'}
  const release=validateResultRelease({mode:input.resultPublishMode,publishAt:input.resultPublishAt,now:input.now})
  if(!release.ok) return release
  return {
    ok:true,
    value:{
      examType,
      batchNo,
      examDate,
      title,
      expectedQuestions,
      durationMinutes,
      totalMarks:expectedQuestions*4,
      negativeMarks:1,
      unattemptedMarks:0,
      resultPublishMode:release.mode,
      resultPublishAt:release.publishAt,
      instructions:String(input.instructions??'').trim()
    }
  }
}

export function suggestExamTitle({type,batch,date}={}){
  const examType=normaliseMasterExamType(type)
  const batchNo=positiveInt(batch)
  if(!examType||batchNo==null||batchNo>99||!isRealIsoDate(date)) return ''
  const [year,month,day]=String(date).split('-')
  const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const typeLabel=MASTER_EXAM_TYPES[examType].label.toUpperCase()
  return `SGA ${typeLabel} | BATCH ${String(batchNo).padStart(2,'0')} | ${day} ${months[Number(month)-1]} ${year}`
}

export function normaliseCoverageRows(rows,{syllabusLookup}={}){
  if(!Array.isArray(rows)||!rows.length) return {ok:false,error:'Add at least one syllabus coverage row'}
  const items=[]
  for(let i=0;i<rows.length;i++){
    const raw=rows[i]||{}
    const subject=String(raw.subject??'').trim()
    const unitId=raw.unitId
    const chapterId=raw.chapterId
    const subtopicId=raw.subtopicId==null||raw.subtopicId===''?null:raw.subtopicId
    const plannedQuestions=positiveInt(raw.plannedQuestions)
    if(!subject||unitId==null||unitId===''||chapterId==null||chapterId==='') return {ok:false,error:`Coverage row ${i+1} is incomplete`}
    if(plannedQuestions==null) return {ok:false,error:`Coverage row ${i+1}: Questions Planned must be positive`}
    const unit=mapGet(syllabusLookup?.units,unitId)
    if(!unit||String(unit.subject)!==subject) return {ok:false,error:`Coverage row ${i+1}: Unit does not belong to Subject`}
    const chapter=mapGet(syllabusLookup?.chapters,chapterId)
    if(!chapter||String(chapter.unit_id)!==String(unitId)) return {ok:false,error:`Coverage row ${i+1}: Chapter does not belong to Unit`}
    if(subtopicId!=null){
      const subtopic=mapGet(syllabusLookup?.subtopics,subtopicId)
      if(!subtopic||String(subtopic.chapter_id)!==String(chapterId)) return {ok:false,error:`Coverage row ${i+1}: Topic does not belong to Chapter`}
    }
    items.push({subject,unitId,chapterId,subtopicId,plannedQuestions})
  }
  const issues=detectCoverageOverlap(items)
  if(issues.some(x=>x.code==='DUPLICATE_SCOPE')) return {ok:false,error:'Duplicate syllabus coverage row',issues}
  return {ok:true,items,issues}
}

export function detectCoverageOverlap(rows=[]){
  const issues=[]
  const seen=new Set()
  const wholeChapters=new Set()
  const topicChapters=new Set()
  for(let i=0;i<rows.length;i++){
    const r=rows[i]||{}
    const chapterKey=`${r.subject}|${r.unitId}|${r.chapterId}`
    const exactKey=`${chapterKey}|${r.subtopicId==null?'WHOLE':r.subtopicId}`
    if(seen.has(exactKey)) issues.push({code:'DUPLICATE_SCOPE',severity:'high',row:i+1})
    seen.add(exactKey)
    if(r.subtopicId==null||r.subtopicId==='') wholeChapters.add(chapterKey)
    else topicChapters.add(chapterKey)
  }
  for(const chapterKey of wholeChapters){
    if(topicChapters.has(chapterKey)) issues.push({code:'WHOLE_CHAPTER_TOPIC_OVERLAP',severity:'high',chapterKey})
  }
  return issues
}

export function buildWizardReadiness(input={}){
  const expected=Number(input.expectedQuestions)||0
  const planned=Number(input.plannedQuestions)||0
  const questions=Number(input.questionCount)||0
  const keyed=Number(input.keyedQuestions)||0
  const mapped=Number(input.mappedQuestions)||0
  const assigned=Number(input.assignedCount)||0
  const issues=[]
  if(expected<=0||planned!==expected) issues.push({code:'COVERAGE_TOTAL_MISMATCH',severity:'high',target:'COVERAGE'})
  if(expected<=0||questions!==expected) issues.push({code:'QUESTIONS_INCOMPLETE',severity:'high',target:'QUESTIONS'})
  if(questions<=0||keyed!==questions) issues.push({code:'ANSWER_KEYS_INCOMPLETE',severity:'high',target:'QUESTIONS'})
  if(questions<=0||mapped!==questions) issues.push({code:'MAPPING_INCOMPLETE',severity:'high',target:'QUESTIONS'})
  if(input.blueprintApproved!==true) issues.push({code:'BLUEPRINT_PENDING',severity:'medium',target:'BLUEPRINT'})
  if(assigned<=0) issues.push({code:'STUDENTS_MISSING',severity:'medium',target:'STUDENTS'})
  if(input.resultReleaseValid!==true) issues.push({code:'RESULT_RELEASE_INVALID',severity:'high',target:'PUBLISH'})
  return {ready:issues.length===0,issues}
}
