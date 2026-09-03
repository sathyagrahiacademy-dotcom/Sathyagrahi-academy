import assert from 'node:assert/strict';
import { normaliseAudience, nextMaxAttempts } from './supabase/functions/admin-exams/audience-policy.mjs';

assert.deepEqual(normaliseAudience('all',['a','b']),{ok:true,mode:'all',studentIds:[]});
assert.deepEqual(normaliseAudience('selected',['a','a','b']),{ok:true,mode:'selected',studentIds:['a','b']});
assert.equal(normaliseAudience('selected',[]).ok,false);
assert.equal(normaliseAudience('bad',['a']).ok,false);
assert.equal(nextMaxAttempts(1),2);
assert.equal(nextMaxAttempts(3),4);
assert.equal(nextMaxAttempts(null),2);

console.log('exam audience policy tests passed');
