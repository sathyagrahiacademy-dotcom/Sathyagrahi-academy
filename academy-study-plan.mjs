const SUBJECT_ORDER=['Biology','Chemistry','Physics']
const isoDay=value=>{
  const [y,m,d]=String(value).split('-').map(Number)
  return Date.UTC(y,m-1,d)/86400000
}

export function dailyPlanFromChapters(rows,date){
  const day=isoDay(date)
  return SUBJECT_ORDER.map(subject=>{
    const subjectRows=(rows||[]).filter(row=>row.subject===subject)
    const studyRow=subjectRows.find(row=>day>=isoDay(row.study_start)&&day<=isoDay(row.study_end))||null
    const revisions=[]
    for(const row of subjectRows){
      for(const [field,stage] of [['r1_date','R1'],['r2_date','R2'],['r3_date','R3'],['r4_date','R4']]){
        if(row[field]===date) revisions.push({chapter:row.chapter,chapterNo:row.chapter_no,stage})
      }
    }
    const study=studyRow?{
      chapter:studyRow.chapter,
      chapterNo:studyRow.chapter_no,
      day:day-isoDay(studyRow.study_start)+1,
      totalDays:isoDay(studyRow.study_end)-isoDay(studyRow.study_start)+1
    }:null
    if(study) study.dayLabel=`Day ${study.day} of ${study.totalDays}`
    return {subject,study,revisions,plannedMinutes:Number(studyRow?.planned_minutes||240)}
  })
}
