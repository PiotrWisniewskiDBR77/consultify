#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
type Db = { query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }> };
async function main() {
  const t = resolveScriptDatabaseTarget({ label: 'diag-elk', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  logSelectedDatabaseTarget('diag-elk', t);
  process.env.DATABASE_URL = t.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;
  console.log('\nINSIGHTS per org:');
  console.table((await db.query<any>(`SELECT organization_id, count(*)::int n FROM interview_insights GROUP BY organization_id ORDER BY n DESC`)).rows);
  console.log('\nelkomtech insights (id/status/archived):');
  console.table((await db.query<any>(`SELECT id, status, archived_at, organization_id FROM interview_insights WHERE id LIKE 'ii_elkomtech%' ORDER BY id`)).rows);
  console.log('\nINITIATIVES per org:');
  console.table((await db.query<any>(`SELECT organization_id, count(*)::int n FROM initiatives GROUP BY organization_id ORDER BY n DESC`)).rows);
  console.log('\nsample elkomtech initiatives:');
  console.table((await db.query<any>(`SELECT id, status, archived_at, source_type FROM initiatives WHERE id LIKE 'init_elkomtech%' ORDER BY id LIMIT 4`)).rows);
}
main().catch((e) => { console.error('Failed:', e); process.exit(1); });
