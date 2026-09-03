export function canAccessAudience(mode,assignment){
  if(mode==='all')return true;
  if(mode==='selected')return Boolean(assignment?.is_assigned);
  return false;
}
