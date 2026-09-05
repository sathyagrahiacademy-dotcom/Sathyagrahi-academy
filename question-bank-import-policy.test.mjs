import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modulePath = './supabase/functions/admin-question-bank/import-policy.mjs';

function lookupFor(subject='Physics'){
  const unitTitle=subject==='Biology'?'Diversity':subject==='Chemistry'?'Thermodynamics':'Kinematics';
  const chapterTitle=subject==='Biology'?'Living World':subject==='Chemistry'?'Thermodynamics':'Motion in a Plane';
  const topicTitle=subject==='Biology'?'Taxonomy':subject==='Chemistry'?'Hess Law':'Projectile Motion';
  return {unitTitle,chapterTitle,topicTitle,data:{
    units:[{id:1,subject,unit_no:1,unit_title:unitTitle}],
    chapters:[{id:2,unit_id:1,topic_title:chapterTitle}],
    subtopics:[{id:3,chapter_id:2,subtopic_title:topicTitle,status:'approved'}]
  }};
}

function officialRow({subject='Physics',questionType='Direct Concept MCQ',marks='4',negativeMarks='1'}={}){
  const x=lookupFor(subject);
  return {
    questionNo:1,subject,unit:x.unitTitle,chapter:x.chapterTitle,topic:x.topicTitle,
    questionText:'Q?',optionA:'A',optionB:'B',optionC:'C',optionD:'D',correctOption:'A',
    marks,negativeMarks,explanation:'',difficulty:'Medium',questionType,source:'Practice',sourceYear:''
  };
}

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
  const x=lookupFor('Physics'),lookup=buildSyllabusLookup(x.data),base=officialRow();
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
  const x=lookupFor('Biology'),lookup=buildSyllabusLookup(x.data);
  const q=officialRow({subject:'Biology',questionType:'NCERT Direct'});
  const result=validateImportQuestions(lookup,[q,{...q,questionText:'Q2?'}]);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/duplicate Question No/i);
  assert.equal(result.items.length,0);
});

test('Physics accepts approved Circuit Based format', async () => {
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  const x=lookupFor('Physics');
  const result=validateImportQuestions(buildSyllabusLookup(x.data),[officialRow({subject:'Physics',questionType:'Circuit Based'})]);
  assert.equal(result.ok,true,result.errors.join(' '));
});

test('Chemistry accepts approved Reaction Product format', async () => {
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  const x=lookupFor('Chemistry');
  const result=validateImportQuestions(buildSyllabusLookup(x.data),[officialRow({subject:'Chemistry',questionType:'Reaction / Product'})]);
  assert.equal(result.ok,true,result.errors.join(' '));
});

test('Biology rejects Physics-only Circuit Based format with row-specific error', async () => {
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  const x=lookupFor('Biology');
  const result=validateImportQuestions(buildSyllabusLookup(x.data),[officialRow({subject:'Biology',questionType:'Circuit Based'})]);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/Row 2:.*Circuit Based.*Biology/i);
  assert.equal(result.items.length,0);
});

test('unsupported or missing question type is rejected', async () => {
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  const x=lookupFor('Physics'),lookup=buildSyllabusLookup(x.data);
  for(const questionType of ['Random AI Type','']){
    const result=validateImportQuestions(lookup,[officialRow({questionType})]);
    assert.equal(result.ok,false,questionType||'blank');
    assert.match(result.errors.join(' '),/Question Type|approved Physics question type/i);
  }
});

test('official bank import requires exactly plus 4 and minus 1', async () => {
  const { buildSyllabusLookup, validateImportQuestions } = await import(modulePath);
  const x=lookupFor('Physics'),lookup=buildSyllabusLookup(x.data);
  for(const patch of [{marks:'3'},{marks:'5'},{negativeMarks:'0'},{negativeMarks:'0.5'}]){
    const result=validateImportQuestions(lookup,[officialRow(patch)]);
    assert.equal(result.ok,false,JSON.stringify(patch));
    assert.match(result.errors.join(' '),/Marks must be 4|Negative Marks must be 1/i);
    assert.equal(result.items.length,0);
  }
});
