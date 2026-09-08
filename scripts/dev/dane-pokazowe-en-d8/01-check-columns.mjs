import fs from 'node:fs';
import pg from 'pg';
const secrets = JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/railway-staging.json', 'utf8'));
const url = secrets.DATABASE_PUBLIC_URL;
const host = new URL(url).hostname;
if (!host.includes('thomas')) { console.error('GUARD FAIL'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: false });
await client.connect();
try {
  const tables = ['users','organization_members','initiatives','ie_aggregate_state','tasks','raid_items','decisions','initiative_milestones','kpis','kpi_definitions','budgets','financial_statements','v8_output_artifacts','meetings','conversations','interview_sessions','audit_programs','audit_program_findings','execution_report_snapshots'];
  for (const t of tables) {
    const res = await client.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and column_name ilike '%org%'`, [t]);
    console.log(t, '=>', res.rows.map(r=>r.column_name).join(','));
  }
} finally { await client.end(); }
