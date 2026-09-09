import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTopicQuestionRequest,buildFolderSummary } from './supabase/functions/admin-question-bank/folder-policy.mjs';

test('topic reads accept only canonical context, approved sort and bounded paging',()=>{
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'newest',limit:50,offset:0}).ok,true);
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,sort:'sql'}).ok,false);
  assert.equal(normalizeTopicQuestionRequest({subject:'Physics',unitId:1,chapterId:2,subtopicId:3,limit:101}).ok,false);
});

test('folder summary counts questions without exposing question text',()=>{
  const tree={units:[{id:1,subject:'Physics',unit_no:1,unit_title:'Physics and Measurement',sort_order:1}],chapters:[{id:11,unit_id:1,topic_title:'Units',sort_order:1}],subtopics:[{id:101,chapter_id:11,subtopic_title:'SI Units',status:'approved',sort_order:1}]};
  const summary=buildFolderSummary(tree,[{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101},{subject:'Physics',unit_id:1,chapter_id:11,subtopic_id:101}]);
  assert.equal(summary.subjects[0].count,2);
  assert.equal(summary.subjects[0].chapters[0].topics[0].count,2);
  assert.equal(JSON.stringify(summary).includes('question_text'),false);
});

test('edge keeps legacy/write actions and adds lazy reads',()=>{
  const edge=fs.readFileSync('supabase/functions/admin-question-bank/index.ts','utf8');
  for(const action of ['folder_summary','topic_questions','list','bulk_import','add_to_exam','sync_exam'])assert.match(edge,new RegExp(`action===['"]${action}['"]`));
  assert.match(edge,/add_bank_questions_to_exam/);
});
