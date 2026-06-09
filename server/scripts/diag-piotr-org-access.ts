#!/usr/bin/env tsx
/** Read-only: why does piotr.wisniewski@dbr77.com not see VTS/Apator/APLIX/Elkomtech orgs? */
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
const EMAIL = 'piotr.wisniewski@dbr77.com';
type Db = { query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }> };

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'diag-piotr', databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('diag-piotr', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const u = (await db.query<any>(`SELECT id, email, role FROM users WHERE LOWER(email)=LOWER($1)`, [EMAIL])).rows || [];
  console.log('\n=== USER ===');
  console.table(u);
  const uid = u[0]?.id;

  console.log('\n=== ORGS (matching names) ===');
  const orgs = (await db.query<any>(
    `SELECT id, name FROM organizations WHERE LOWER(name) ~ 'vts|apator|aplix|elkom|dbr' OR LOWER(id) ~ 'vts|apator|aplix|elkom|dbr' ORDER BY name`)).rows || [];
  console.table(orgs);

  if (uid) {
    console.log('\n=== organization_members for Piotr ===');
    const mem = (await db.query<any>(
      `SELECT om.organization_id, o.name, om.role, om.status
       FROM organization_members om LEFT JOIN organizations o ON o.id=om.organization_id
       WHERE om.user_id=$1 ORDER BY o.name`, [uid])).rows || [];
    console.table(mem);

    console.log('\n=== membership rows in target orgs (any user) — counts ===');
    for (const o of orgs) {
      const c = (await db.query<any>(`SELECT COUNT(*)::int n FROM organization_members WHERE organization_id=$1`, [o.id])).rows?.[0]?.n;
      const mine = (await db.query<any>(`SELECT role, status FROM organization_members WHERE organization_id=$1 AND user_id=$2`, [o.id, uid])).rows || [];
      console.log(`  ${o.id} (${o.name}): members=${c} · piotr=${mine.length ? JSON.stringify(mine[0]) : 'NOT A MEMBER'}`);
    }
  }
}
main().catch((e) => { console.error('[diag] Failed:', e); process.exit(1); });
