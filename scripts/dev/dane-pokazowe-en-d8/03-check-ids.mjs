import fs from 'node:fs';
import pg from 'pg';
const secrets = JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/railway-staging.json', 'utf8'));
const url = secrets.DATABASE_PUBLIC_URL;
const host = new URL(url).hostname;
if (!host.includes('thomas')) { console.error('GUARD FAIL'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: false });
await client.connect();
const NORTHWIND = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
async function q(sql, params) { return (await client.query(sql, params)).rows; }
try {
  console.log('initiatives (id, title, status):');
  for (const r of await q('select id, title, status from initiatives where organization_id=$1 order by created_at', [NORTHWIND])) console.log('  ', r.id, '|', r.title, '|', r.status);
  console.log('conversations (id, title):');
  for (const r of await q('select id, title from conversations where organization_id=$1', [NORTHWIND])) console.log('  ', r.id, '|', r.title);
  console.log('meetings (id, title):');
  for (const r of await q('select id, title from meetings where organization_id=$1', [NORTHWIND])) console.log('  ', r.id, '|', r.title);
  console.log('rvn_kpi_definitions (id, name/code):');
  const cols = (await q(`select column_name from information_schema.columns where table_name='rvn_kpi_definitions'`)).map(r=>r.column_name);
  console.log('  cols:', cols.join(','));
} finally { await client.end(); }
