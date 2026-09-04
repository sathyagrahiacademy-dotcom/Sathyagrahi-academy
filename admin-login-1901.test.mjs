import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('admin-login.html','utf8');
const js=fs.readFileSync('admin-login.js','utf8');

test('admin login shows ID 1901 instead of email',()=>{
  assert.match(html,/for="adminId">Admin ID<\/label>/i);
  assert.match(html,/id="adminId"[^>]*value="1901"/i);
  assert.doesNotMatch(html,/id="email"|type="email"|Admin Email/i);
});

test('login maps ID 1901 to existing authorized admin account internally',()=>{
  assert.match(js,/ADMIN_LOGIN_ID\s*=\s*['"]1901['"]/);
  assert.match(js,/AUTHORIZED_ADMIN_EMAIL\s*=\s*['"]d\.kingshravan@gmail\.com['"]/);
  assert.match(js,/signInWithPassword\s*\(\s*\{\s*email\s*:\s*AUTHORIZED_ADMIN_EMAIL\s*,\s*password\s*:\s*pw\.value\s*\}\s*\)/s);
  assert.doesNotMatch(js,/getElementById\(['"]email['"]\)/);
});

test('forgot password keeps using the existing authorized email behind the ID login',()=>{
  assert.match(js,/resetPasswordForEmail\s*\(\s*AUTHORIZED_ADMIN_EMAIL\s*,/s);
});
