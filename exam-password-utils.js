(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ExamPasswordUtils=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const exact=/^\d{6}$/;
  function isValidSixDigitPassword(value){return exact.test(String(value??''));}
  function generateSixDigitPassword(cryptoLike=globalThis.crypto){
    if(!cryptoLike?.getRandomValues)throw new Error('Secure random generator unavailable');
    const bytes=new Uint32Array(1);
    cryptoLike.getRandomValues(bytes);
    return String(bytes[0]%1000000).padStart(6,'0');
  }
  return{isValidSixDigitPassword,generateSixDigitPassword};
});
