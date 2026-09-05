const freezeTemplate = value => Object.freeze({...value})

export const EXAM_TYPES = Object.freeze({
  daily: freezeTemplate({code:'DLY',questions:45,durationMinutes:45,totalMarks:180,negativeMarking:true}),
  unit: freezeTemplate({code:'UNT',questions:180,durationMinutes:180,totalMarks:720,negativeMarking:true}),
  monthly: freezeTemplate({code:'MON',questions:180,durationMinutes:180,totalMarks:720,negativeMarking:true})
})

const TYPE_ALIASES = Object.freeze({
  daily:'daily',dly:'daily',
  unit:'unit',unt:'unit',
  monthly:'monthly',mon:'monthly'
})

const QUESTION_TYPES = Object.freeze({
  Physics:Object.freeze([
    'Direct Concept MCQ',
    'Numerical / Application',
    'Graph / Diagram',
    'Circuit Based',
    'Formula / Relation',
    'Statement I–II',
    'Match / Order'
  ]),
  Chemistry:Object.freeze([
    'Direct Concept / NCERT',
    'Numerical / Application',
    'Reaction / Product',
    'Reagent / Conversion',
    'Statement Based',
    'Assertion–Reason',
    'Match / Order / Trend'
  ]),
  Biology:Object.freeze([
    'NCERT Direct',
    'Multiple Statements',
    'Statement I–II',
    'Assertion–Reason',
    'Match the Following',
    'Sequence / Order',
    'Diagram / Image'
  ])
})

const SUBJECTS = Object.freeze(['Physics','Chemistry','Biology'])

export function normaliseExamType(value){
  const key=String(value??'').trim().toLowerCase()
  return TYPE_ALIASES[key]||null
}

export function templateForExamType(value){
  const type=normaliseExamType(value)
  if(!type) throw new Error('Invalid exam type')
  return {...EXAM_TYPES[type]}
}

function validIsoDate(value){
  const text=String(value??'').trim()
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const [y,m,d]=text.split('-').map(Number)
  const dt=new Date(Date.UTC(y,m-1,d))
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d
}

export function buildExamCode({type,date,sequence}){
  const norm=normaliseExamType(type)
  if(!norm) throw new Error('Invalid exam type')
  if(!validIsoDate(date)) throw new Error('Invalid exam date')
  const seq=Number(sequence)
  if(!Number.isInteger(seq)||seq<1||seq>999) throw new Error('Invalid exam sequence')
  const compact=String(date).replaceAll('-','')
  return `SGA-${EXAM_TYPES[norm].code}-${compact}-${String(seq).padStart(3,'0')}`
}

export function allowedQuestionTypes(subject){
  const key=String(subject??'').trim()
  return QUESTION_TYPES[key]?[...QUESTION_TYPES[key]]:[]
}

export function validateQuestionType(subject,type){
  const subjectName=String(subject??'').trim()
  const value=String(type??'').trim()
  if(!QUESTION_TYPES[subjectName]) return {ok:false,error:'Invalid subject for question type'}
  if(!value) return {ok:false,error:'Question Type is required'}
  if(!QUESTION_TYPES[subjectName].includes(value)) return {ok:false,error:`${value} is not an approved ${subjectName} question type`}
  return {ok:true}
}

export function validateOfficialQuestionMarking({marks,negativeMarks}){
  const positive=Number(marks),negative=Number(negativeMarks)
  if(!Number.isFinite(positive)||positive!==4) return {ok:false,error:'Official NEET question Marks must be 4'}
  if(!Number.isFinite(negative)||negative!==1) return {ok:false,error:'Official NEET question Negative Marks must be 1'}
  return {ok:true}
}

function subjectCount(subjectCounts,subject){
  const n=Number(subjectCounts?.[subject]??0)
  return Number.isFinite(n)?n:0
}

export function validateExamTemplateCounts({examType,examSubject,totalQuestions,subjectCounts}){
  const type=normaliseExamType(examType)
  if(!type) return {ok:false,error:'Invalid exam type'}
  const template=EXAM_TYPES[type]
  const total=Number(totalQuestions)
  if(!Number.isInteger(total)||total!==template.questions){
    return {ok:false,error:`${type} exam requires exactly ${template.questions} questions`}
  }

  const counts={}
  for(const subject of SUBJECTS) counts[subject]=subjectCount(subjectCounts,subject)
  const mappedTotal=SUBJECTS.reduce((sum,subject)=>sum+counts[subject],0)
  if(mappedTotal!==total) return {ok:false,error:'Mapped subject counts do not match total questions'}

  if(type==='unit'||type==='monthly'){
    if(counts.Physics!==45||counts.Chemistry!==45||counts.Biology!==90){
      return {ok:false,error:'Unit/Monthly exam requires Physics 45, Chemistry 45 and Biology 90 questions'}
    }
    return {ok:true}
  }

  const subject=String(examSubject??'').trim()
  if(SUBJECTS.includes(subject)){
    for(const name of SUBJECTS){
      const expected=name===subject?45:0
      if(counts[name]!==expected) return {ok:false,error:`Daily ${subject} exam requires all 45 questions from ${subject}`}
    }
    return {ok:true}
  }
  if(subject==='Mixed'||subject==='NEET') return {ok:true}
  return {ok:false,error:'Daily exam subject must be Physics, Chemistry, Biology, Mixed or NEET'}
}
