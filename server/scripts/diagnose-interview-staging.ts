#!/usr/bin/env tsx
/**
 * Diagnose Interview data presence on a given DB (staging/local).
 *
 * Usage:
 *   ENV_FILE=.env.staging.local DOTENV_OVERRIDE=1 DB_MANAGED_SCHEMA=off npx tsx server/scripts/diagnose-interview-staging.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

type Row = Record<string, any>;

function loadEnv() {
  const extra = String(process.env.ENV_FILE || '').trim();
  if (extra) {
    const p = path.resolve(process.cwd(), extra);
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  }
  if (!extra) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  }
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
}

async function main() {
  loadEnv();

  // Avoid schema auto-patching on older staging DBs.
  process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA || 'off';

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const orgs = (await db.all(
    `SELECT o.id, o.name,
            (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS users_count,
            (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.role IN ('OWNER','ADMIN','PROJECT_MANAGER','SUPERADMIN')) AS admin_users_count
     FROM organizations o
     ORDER BY o.created_at DESC
     LIMIT 25`,
    []
  )) as Row[];

  console.log('## Orgs (latest 25)');
  for (const o of orgs) {
    console.log(`- ${o.id} | ${o.name} | users=${o.users_count} | admins=${o.admin_users_count}`);
  }

  const counts = (await db.all(
    `SELECT organization_id, 'templates' AS t, COUNT(*)::int AS c FROM interview_library_templates GROUP BY organization_id
     UNION ALL
     SELECT organization_id, 'assignments' AS t, COUNT(*)::int AS c FROM interview_assignments GROUP BY organization_id
     UNION ALL
     SELECT organization_id, 'sessions' AS t, COUNT(*)::int AS c FROM interview_sessions GROUP BY organization_id
     UNION ALL
     SELECT organization_id, 'insights' AS t, COUNT(*)::int AS c FROM interview_insights GROUP BY organization_id
     ORDER BY organization_id, t`,
    []
  )) as Row[];

  console.log('\n## Interview counts by org');
  if (!counts.length) {
    console.log('(no interview rows found in any org)');
  } else {
    for (const r of counts) console.log(`- ${r.organization_id} | ${r.t}=${r.c}`);
  }

  const adminUsers = (await db.all(
    `SELECT u.organization_id, u.email, u.role
     FROM users u
     WHERE u.role IN ('OWNER','ADMIN','PROJECT_MANAGER','SUPERADMIN')
     ORDER BY u.created_at DESC
     LIMIT 30`,
    []
  )) as Row[];

  console.log('\n## Admin-like users (latest 30)');
  for (const u of adminUsers) {
    console.log(`- ${u.organization_id} | ${u.role} | ${u.email}`);
  }
}

main().catch((e) => {
  console.error('❌ diagnose failed:', e?.message || e);
  process.exit(1);
});

