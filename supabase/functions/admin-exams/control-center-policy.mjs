import {deriveExamLifecycle,nextExamAction} from '../_shared/exam-master-policy.mjs'

const ISSUE_DEFS=Object.freeze({
  QUESTIONS_INCOMPLETE:Object.freeze({code:'QUESTIONS_INCOMPLETE',severity:'high',label:'Questions incomplete',action:'Add Questions',target:'QUESTIONS'}),
  MAPPING_INCOMPLETE:Object.freeze({code:'MAPPING_INCOMPLETE',severity:'high',label:'Mapping incomplete',action:'Review Mapping',target:'QUESTIONS'}),
  ANSWER_KEYS_INCOMPLETE:Object.freeze({code:'ANSWER_KEYS_INCOMPLETE',severity:'high',label:'Answer keys incomplete',action:'Review Questions',target:'QUESTIONS'}),
  BLUEPRINT_PENDING:Object.freeze({code:'BLUEPRINT_PENDING',severity:'medium',label:'Blueprint approval pending',action:'Review Blueprint',target:'BLUEPRINT'}),
  STUDENTS_MISSING:Object.freeze({code:'STUDENTS_MISSING',severity:'medium',label:'No students assigned',action:'Manage Students',target:'STUDENTS'})
})

const n=v=>Number.isFinite(Number(v))?Number(v):0

function setupReady(input){
  const questionCount=n(input.questionCount)
  const expected=input.expectedQuestions==null?null:n(input.expectedQuestions)
  return questionCount>0
    && (expected==null||questionCount===expected)
    && n(input.mappedQuestions)===questionCount
    && n(input.keyedQuestions)===questionCount
    && input.blueprintApproved===true
    && n(input.assignedCount)>0
}

function generatedIssues(input){
  const out=[]
  const q=n(input.questionCount),expected=input.expectedQuestions==null?null:n(input.expectedQuestions)
  if(q<=0||(expected!=null&&q!==expected))out.push(ISSUE_DEFS.QUESTIONS_INCOMPLETE)
  if(q>0&&n(input.mappedQuestions)!==q)out.push(ISSUE_DEFS.MAPPING_INCOMPLETE)
  if(q>0&&n(input.keyedQuestions)!==q)out.push(ISSUE_DEFS.ANSWER_KEYS_INCOMPLETE)
  // Historical published exams pre-date blueprint approval metadata; do not create
  // a retroactive setup alert merely because that compatibility field is empty.
  if(!input.isPublished&&input.blueprintApproved!==true)out.push(ISSUE_DEFS.BLUEPRINT_PENDING)
  if(n(input.assignedCount)<=0)out.push(ISSUE_DEFS.STUDENTS_MISSING)
  return out
}

function dedupeIssues(primary=[],extra=[]){
  const seen=new Set(),out=[]
  for(const issue of [...primary,...(Array.isArray(extra)?extra:[])]){
    const code=String(issue?.code||'').trim()
    if(!code||seen.has(code))continue
    seen.add(code)
    out.push(issue)
  }
  return out
}

export function buildExamControlItem(input={}){
  const ready=setupReady(input)
  const lifecycle=deriveExamLifecycle({
    archivedAt:input.archivedAt,
    resultPublished:Boolean(input.resultPublished),
    isPublished:Boolean(input.isPublished),
    setupReady:ready,
    activeCount:n(input.activeCount),
    newStartsClosedAt:input.newStartsClosedAt,
    legacyCompleted:input.legacyCompleted===true,
    readyResultCount:n(input.readyResultCount)
  })
  const issues=dedupeIssues(generatedIssues(input),input.issues)
  return {
    id:input.id??null,
    title:String(input.title||'Exam'),
    examType:input.examType??null,
    examDate:input.examDate??null,
    batchNo:input.batchNo??null,
    examCode:input.examCode??null,
    expectedQuestions:input.expectedQuestions??null,
    questionCount:n(input.questionCount),
    mappedQuestions:n(input.mappedQuestions),
    keyedQuestions:n(input.keyedQuestions),
    blueprintApproved:input.blueprintApproved===true,
    assignedCount:n(input.assignedCount),
    activeCount:n(input.activeCount),
    submittedCount:n(input.submittedCount),
    readyResultCount:n(input.readyResultCount),
    publishedResultCount:n(input.publishedResultCount),
    resultPublishMode:String(input.resultPublishMode||'manual'),
    isPublished:Boolean(input.isPublished),
    resultPublished:Boolean(input.resultPublished),
    newStartsClosedAt:input.newStartsClosedAt??null,
    archivedAt:input.archivedAt??null,
    setupReady:ready,
    state:lifecycle.state,
    nextAction:nextExamAction(lifecycle.state),
    issues
  }
}

export function buildControlCenterSummary(items=[],{today}={}){
  const list=Array.isArray(items)?items:[]
  const date=String(today||'')
  return {
    today:list.filter(x=>String(x?.examDate||'')===date&&x?.state!=='archived').length,
    upcomingAvailable:list.filter(x=>x?.state==='available').length,
    liveNow:list.filter(x=>x?.state==='live').length,
    resultsPending:list.filter(x=>x?.state==='conducted'||x?.state==='results_ready').length,
    actionRequired:list.filter(x=>Array.isArray(x?.issues)&&x.issues.length>0).length
  }
}
