import fs from 'node:fs';
import pg from 'pg';
const secrets = JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/railway-staging.json', 'utf8'));
const url = secrets.DATABASE_PUBLIC_URL;
if (!new URL(url).hostname.includes('thomas')) { console.error('GUARD FAIL'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: false });
await client.connect();
const NORTHWIND = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
async function q(sql, params) { return (await client.query(sql, params)).rows; }
try {
  console.log(await q(`select kpi_id, kpi_code, status from rvn_kpi_definitions where organization_id=$1`, [NORTHWIND]));
} finally { await client.end(); }
