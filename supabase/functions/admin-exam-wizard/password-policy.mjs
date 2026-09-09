export function validateExamPassword(value){
  const password=String(value??'');
  if(!/^\d{6}$/.test(password))return{ok:false,error:'Exam Password must be exactly 6 digits'};
  return{ok:true,password};
}
