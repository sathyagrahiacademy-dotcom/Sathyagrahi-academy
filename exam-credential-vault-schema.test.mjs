import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath='EXAM_CREDENTIAL_VAULT_MIGRATION.sql';

test('exam credential vault migration exists',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'EXAM_CREDENTIAL_VAULT_MIGRATION.sql must exist');
});

if(fs.existsSync(migrationPath)){
  const sql=fs.readFileSync(migrationPath,'utf8');

  test('private vault table stores ciphertext only and cascades with exam',()=>{
    assert.match(sql,/create\s+schema\s+if\s+not\s+exists\s+private/i);
    assert.match(sql,/create\s+table\s+if\s+not\s+exists\s+private\.exam_credentials/i);
    assert.match(sql,/exam_id\s+uuid\s+primary\s+key[\s\S]*references\s+public\.exams\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/i);
    assert.match(sql,/ciphertext\s+text\s+not\s+null/i);
    assert.match(sql,/iv\s+text\s+not\s+null/i);
    assert.match(sql,/key_version\s+smallint\s+not\s+null[\s\S]*check\s*\(\s*key_version\s*>\s*0\s*\)/i);
    assert.match(sql,/created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
    assert.match(sql,/updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
    assert.match(sql,/updated_by\s+uuid/i);
    assert.doesNotMatch(sql,/plain(?:text)?_?password|password_plain/i);
  });

  test('browser roles cannot access private credential storage',()=>{
    assert.match(sql,/revoke\s+all\s+on\s+schema\s+private\s+from\s+public/i);
    assert.match(sql,/revoke\s+all\s+on\s+schema\s+private\s+from\s+anon\s*,\s*authenticated/i);
    assert.match(sql,/revoke\s+all\s+on\s+table\s+private\.exam_credentials\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i);
    assert.match(sql,/grant\s+usage\s+on\s+schema\s+private\s+to\s+service_role/i);
    assert.match(sql,/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+private\.exam_credentials\s+to\s+service_role/i);
  });

  test('credential RPCs are service-role-only security invoker functions',()=>{
    assert.match(sql,/create\s+or\s+replace\s+function\s+public\.upsert_exam_credential_v1\s*\(\s*p_exam_id\s+uuid\s*,\s*p_exam_code\s+text\s*,\s*p_password_hash\s+text\s*,\s*p_ciphertext\s+text\s*,\s*p_iv\s+text\s*,\s*p_key_version\s+smallint\s*,\s*p_updated_by\s+uuid\s*\)/i);
    assert.match(sql,/create\s+or\s+replace\s+function\s+public\.get_exam_credential_v1\s*\(\s*p_exam_id\s+uuid\s*\)/i);
    const invokers=sql.match(/security\s+invoker/ig)||[];
    assert.ok(invokers.length>=2,'both credential RPCs must use SECURITY INVOKER');
    assert.doesNotMatch(sql,/security\s+definer/i);
    for(const fn of ['upsert_exam_credential_v1','get_exam_credential_v1']){
      assert.match(sql,new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\([^;]+\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,'i'));
      assert.match(sql,new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\([^;]+\\)\\s+to\\s+service_role`,'i'));
    }
  });

  test('upsert RPC atomically writes exam_access hash and encrypted vault row',()=>{
    const start=sql.search(/create\s+or\s+replace\s+function\s+public\.upsert_exam_credential_v1/i);
    const end=sql.indexOf('$$;',start);
    const body=sql.slice(start,end>start?end+3:undefined);
    assert.match(body,/insert\s+into\s+public\.exam_access/i);
    assert.match(body,/password_hash/i);
    assert.match(body,/on\s+conflict\s*\(\s*exam_id\s*\)\s+do\s+update/i);
    assert.match(body,/insert\s+into\s+private\.exam_credentials/i);
    assert.match(body,/ciphertext/i);
    assert.match(body,/key_version/i);
  });
}
