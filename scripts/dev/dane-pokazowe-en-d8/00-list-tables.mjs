// TYLKO ODCZYT — listuje nazwy tabel pasujace do wzorcow, zeby dobrac dokladne zapytania D8.
import fs from 'node:fs';
import pg from 'pg';

const secrets = JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/railway-staging.json', 'utf8'));
const url = secrets.DATABASE_PUBLIC_URL;
const host = new URL(url).hostname;
if (!host.includes('thomas')) {
  console.error('GUARD: host nie zawiera "thomas" — przerywam.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: false });
await client.connect();
try {
  const patterns = ['%initiative%', '%task%', '%raid%', '%decision%', '%kpi%', 'rvn_%', '%budget%', '%financial%', '%statement%', '%v8_output%', '%meeting%', '%conversation%', '%interview%', '%audit_program%', '%execution_report%', '%organization_member%', '%ie_aggregate%'];
  const res = await client.query(
    `select table_name from information_schema.tables where table_schema='public' and (${patterns.map((_, i) => `table_name like $${i + 1}`).join(' or ')}) order by table_name`,
    patterns
  );
  console.log(res.rows.map(r => r.table_name).join('\n'));
} finally {
  await client.end();
}
