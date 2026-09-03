export function canReadPerformance({requesterRole,requesterId,rowStudentId,resultPublished}={}){
  if(requesterRole==='admin') return true;
  if(requesterRole==='student') return String(requesterId||'')===String(rowStudentId||'') && Boolean(resultPublished);
  return false;
}
