import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modulePath = './supabase/functions/admin-question-bank/import-policy.mjs';

test('canonical import policy module exists', () => {
  assert.ok(fs.existsSync(modulePath), 'import policy module is missing');
});

test('normalized exact hierarchy resolves and invalid hierarchy is rejected', async (t) => {
  if (!fs.existsSync(modulePath)) return t.skip('module not implemented yet');
  const { buildSyllabusLookup, resolveSyllabusLabels } = await import(modulePath);
  const lookup = buildSyllabusLookup({
    units: [{id:1,subject:'Physics',unit_no:2,unit_title:'Kinematics'}],
    chapters: [{id:10,unit_id:1,topic_title:'Motion in a Plane'}],
    subtopics: [{id:100,chapter_id:10,subtopic_title:'Projectile Motion',status:'approved'}]
  });
  const ok = resolveSyllabusLabels(lookup,{subject:' physics ',unit:' KINEMATICS ',chapter:'Motion in a Plane',topic:'Projectile Motion'});
  assert.equal(ok.ok,true);
  assert.deepEqual({unitId:ok.unitId,chapterId:ok.chapterId,subtopicId:ok.subtopicId},{unitId:1,chapterId:10,subtopicId:100});
  const bad = resolveSyllabusLabels(lookup,{subject:'Physics',unit:'Kinematics',chapter:'Laws of Motion',topic:'Friction'});
  assert.equal(bad.ok,false);
  assert.match(bad.error,/Chapter/i);
});

test('only approved topics are auto-mapped', async (t) => {
  if (!fs.existsSync(modulePath)) return t.skip('module not implemented yet');
  const { buildSyllabusLookup, resolveSyllabusLabels } = await import(modulePath);
  const lookup = buildSyllabusLookup({
    units:[{id:1,subject:'Chemistry',unit_no:1,unit_title:'Some Basic Concepts of Chemistry'}],
    chapters:[{id:2,unit_id:1,topic_title:'Mole Concept'}],
    subtopics:[{id:3,chapter_id:2,subtopic_title:'Stoichiometry',status:'suggested'}]
  });
  const result=resolveSyllabusLabels(lookup,{subject:'Chemistry',unit:'Some Basic Concepts of Chemistry',chapter:'Mole Concept',topic:'Stoichiometry'});
  assert.equal(result.ok,false);
  assert.match(result.error,/approved/i);
});

test('full import policy rejects blank or non-numeric marks before any write', async (t) => {
  if (!fs.existsSync(modulePath)) return t.skip('module not implemented yet');
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  assert.equal(typeof validateImportQuestions,'function','validateImportQuestions policy is required');
  const lookup=buildSyllabusLookup({
    units:[{id:1,subject:'Physics',unit_no:1,unit_title:'Kinematics'}],
    chapters:[{id:2,unit_id:1,topic_title:'Motion in a Plane'}],
    subtopics:[{id:3,chapter_id:2,subtopic_title:'Projectile Motion',status:'approved'}]
  });
  const base={questionNo:1,subject:'Physics',unit:'Kinematics',chapter:'Motion in a Plane',topic:'Projectile Motion',questionText:'Q?',optionA:'A',optionB:'B',optionC:'C',optionD:'D',correctOption:'A',marks:'4',negativeMarks:'1',explanation:'',difficulty:'Medium',questionType:'Concept',source:'Practice',sourceYear:''};
  const ok=validateImportQuestions(lookup,[base]);
  assert.equal(ok.ok,true);
  assert.equal(ok.items[0].marks,4);
  assert.equal(ok.items[0].negativeMarks,1);
  for(const patch of [{marks:''},{marks:'abc'},{negativeMarks:''},{negativeMarks:'abc'}]){
    const result=validateImportQuestions(lookup,[{...base,...patch}]);
    assert.equal(result.ok,false,JSON.stringify(patch));
    assert.match(result.errors.join(' '),/Marks|Negative Marks/i);
    assert.equal(result.items.length,0);
  }
});

test('full import policy rejects duplicate question numbers as one atomic batch', async (t) => {
  if (!fs.existsSync(modulePath)) return t.skip('module not implemented yet');
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  assert.equal(typeof validateImportQuestions,'function','validateImportQuestions policy is required');
  const lookup=buildSyllabusLookup({
    units:[{id:1,subject:'Biology',unit_no:1,unit_title:'Diversity'}],
    chapters:[{id:2,unit_id:1,topic_title:'Living World'}],
    subtopics:[{id:3,chapter_id:2,subtopic_title:'Taxonomy',status:'approved'}]
  });
  const q={questionNo:1,subject:'Biology',unit:'Diversity',chapter:'Living World',topic:'Taxonomy',questionText:'Q?',optionA:'A',optionB:'B',optionC:'C',optionD:'D',correctOption:'B',marks:'4',negativeMarks:'1',difficulty:'Easy'};
  const result=validateImportQuestions(lookup,[q,{...q,questionText:'Q2?'}]);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/duplicate Question No/i);
  assert.equal(result.items.length,0);
});
