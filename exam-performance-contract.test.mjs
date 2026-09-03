import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const path=new URL('./supabase/functions/exam-performance/index.ts',import.meta.url);
test('performance API exposes protected admin, student and rebuild actions',()=>{
  const src=fs.readFileSync(path,'utf8');
  assert.match(src,/action === 'admin_list'/);
  assert.match(src,/action === 'student_list'/);
  assert.match(src,/action === 'rebuild_exam'/);
  assert.match(src,/exam_scope_performance_sequenced/);
  assert.match(src,/buildScopePerformance/);
  assert.match(src,/validateExamMapping/);
  assert.match(src,/is_published/);
});
