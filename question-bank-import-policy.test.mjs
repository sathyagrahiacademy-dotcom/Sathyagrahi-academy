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
