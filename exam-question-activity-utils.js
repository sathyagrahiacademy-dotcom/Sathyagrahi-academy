(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.sgaQuestionActivity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function defaultEventId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);
    if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function createQuestionActivityTracker({now=()=>Date.now(),eventId=defaultEventId,maxSampleMs=30_000}={}){
    let questionId=null,active=false,activeSince=null,pendingMs=0,visitDelta=0,answerChangeDelta=0;
    const sampleLimit=Math.max(1,Number(maxSampleMs)||30_000);
    function collect(at){
      if(!active||activeSince==null)return;
      const elapsed=Math.max(0,Number(at)-Number(activeSince));
      pendingMs+=Math.min(elapsed,sampleLimit);
      activeSince=Number(at);
    }
    function build(at){
      if(!questionId)return null;
      collect(at);
      const activeSeconds=Math.floor(pendingMs/1000);
      const remainder=pendingMs-activeSeconds*1000;
      if(activeSeconds===0&&visitDelta===0&&answerChangeDelta===0)return null;
      const out={
        eventId:eventId(),questionId,activeSeconds,
        visitDelta,answerChangeDelta,viewedAt:new Date(Number(at)).toISOString()
      };
      pendingMs=remainder;visitDelta=0;answerChangeDelta=0;
      return out;
    }
    return {
      enter(nextQuestionId,{active:isActive=true}={}){
        const at=Number(now());
        const next=String(nextQuestionId||'');
        if(!next)return null;
        if(questionId===next){
          if(Boolean(isActive)!==active){collect(at);active=Boolean(isActive);activeSince=active?at:null}
          return null;
        }
        const previous=build(at);
        questionId=next;pendingMs=0;visitDelta=1;answerChangeDelta=0;active=Boolean(isActive);activeSince=active?at:null;
        return previous;
      },
      setActive(nextActive){
        const at=Number(now());
        const value=Boolean(nextActive);
        if(value===active)return null;
        collect(at);active=value;activeSince=active?at:null;
        return null;
      },
      answerChanged(){if(questionId)answerChangeDelta+=1},
      flush(){return build(Number(now()))},
      currentQuestionId(){return questionId}
    };
  }
  return {createQuestionActivityTracker};
});
