import assert from 'node:assert/strict';
import { canAccessAudience } from './supabase/functions/student-exam-access/audience-policy.mjs';

assert.equal(canAccessAudience('all',null),true);
assert.equal(canAccessAudience('all',{is_assigned:false}),true);
assert.equal(canAccessAudience('selected',{is_assigned:true}),true);
assert.equal(canAccessAudience('selected',{is_assigned:false}),false);
assert.equal(canAccessAudience('selected',null),false);
assert.equal(canAccessAudience('bad',{is_assigned:true}),false);

console.log('student exam audience tests passed');
