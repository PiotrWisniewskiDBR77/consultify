// TYLKO ODCZYT (SELECT). Liczby D8 dla Northwind + DBR77 na stagingu.
import fs from 'node:fs';
import pg from 'pg';

const secrets = JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/railway-staging.json', 'utf8'));
const url = secrets.DATABASE_PUBLIC_URL;
const host = new URL(url).hostname;
if (!host.includes('thomas')) { console.error('GUARD FAIL: host nie zawiera thomas'); process.exit(1); }

const NORTHWIND = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const DBR77 = 'a3e05d4a-5397-419d-b486-8e44366c0063';

const client = new pg.Client({ connectionString: url, ssl: false });
await client.connect();

async function q(sql, params) {
  const r = await client.query(sql, params);
  return r.rows;
}

try {
  console.log('########## D8 LICZBY ze stagingu (thomas.proxy.rlwy.net) ##########\n');

  console.log('=== NORTHWIND (' + NORTHWIND + ') ===');
  console.log('users:', (await q('select count(*) from users where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('organization_members:', (await q('select count(*) from organization_members where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('initiatives per status:');
  for (const row of await q('select status, count(*) from initiatives where organization_id=$1 group by status order by status', [NORTHWIND])) console.log('  ', row.status, row.count);
  console.log('ie_aggregate_state per aggregate_type:');
  for (const row of await q('select aggregate_type, count(*) from ie_aggregate_state where organization_id=$1 group by aggregate_type order by aggregate_type', [NORTHWIND])) console.log('  ', row.aggregate_type, row.count);
  console.log('tasks:', (await q('select count(*) from tasks where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('raid_items:', (await q('select count(*) from raid_items where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('decisions:', (await q('select count(*) from decisions where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('initiative_milestones:', (await q('select count(*) from initiative_milestones where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('kpis:', (await q('select count(*) from kpis where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('kpi_definitions:', (await q('select count(*) from kpi_definitions where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('rvn_kpi_definitions:', (await q('select count(*) from rvn_kpi_definitions where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('rvn_kpi_measurements:', (await q('select count(*) from rvn_kpi_measurements where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('budgets:', (await q('select count(*) from budgets where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('financial_statements:', (await q('select count(*) from financial_statements where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('v8_output_artifacts:', (await q('select count(*) from v8_output_artifacts where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('meetings:', (await q('select count(*) from meetings where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('conversations:', (await q('select count(*) from conversations where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('interview_sessions:', (await q('select count(*) from interview_sessions where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('audit_programs:', (await q('select count(*) from audit_programs where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('audit_program_findings:', (await q('select count(*) from audit_program_findings where organization_id=$1', [NORTHWIND]))[0].count);
  console.log('execution_report_snapshots:', (await q('select count(*) from execution_report_snapshots where organization_id=$1', [NORTHWIND]))[0].count);

  console.log('\n=== DBR77 (' + DBR77 + ') ===');
  console.log('initiatives:', (await q('select count(*) from initiatives where organization_id=$1', [DBR77]))[0].count);
  console.log('tasks:', (await q('select count(*) from tasks where organization_id=$1', [DBR77]))[0].count);
  console.log('users:', (await q('select count(*) from users where organization_id=$1', [DBR77]))[0].count);

} finally {
  await client.end();
}
