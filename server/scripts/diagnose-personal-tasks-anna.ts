#!/usr/bin/env npx tsx
/** One-off: Anna personal tasks visibility (My Work /personal-tasks). Read-only. */
import pg from 'pg';

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

const ORG = process.env.DIAGNOSE_ORG?.trim() || 'ateliertoys-demo';
const EMAIL = process.env.DIAGNOSE_EMAIL?.trim() || 'anna.zielinska@ateliertoys-demo.com';

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'diagnose-personal-tasks-anna',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('diagnose-personal-tasks-anna', target);
  const pool = new pg.Pool({ connectionString: target.connectionString });
  try {
    const users = await pool.query(
      `SELECT id, email, organization_id FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id`,
      [EMAIL]
    );
    console.log('Users with email:', JSON.stringify(users.rows, null, 2));

    for (const u of users.rows as { id: string }[]) {
      const stats = await pool.query(
        `
        SELECT
          lower(coalesce(status,'')) AS st,
          COUNT(*)::int AS c
        FROM tasks
        WHERE organization_id = $1
          AND assignee_id = $2
          AND lower(coalesce(task_type,'')) = 'personal'
        GROUP BY 1
        ORDER BY 2 DESC
      `,
        [ORG, u.id]
      );
      console.log(`\nStatus breakdown (org=${ORG}, assignee=${u.id}):`, stats.rows);

      const openQ = await pool.query(
        `
        SELECT COUNT(*)::int AS c FROM tasks
        WHERE organization_id = $1
          AND assignee_id = $2
          AND lower(coalesce(task_type,'')) = 'personal'
          AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')
      `,
        [ORG, u.id]
      );
      console.log('Open (visible without includeDone):', openQ.rows[0]?.c);
    }

    const anyPersonalOrg = await pool.query(
      `SELECT COUNT(*)::int AS c FROM tasks WHERE organization_id = $1 AND lower(coalesce(task_type,'')) = 'personal'`,
      [ORG]
    );
    console.log('\nTotal personal tasks in org:', anyPersonalOrg.rows[0]?.c);

    const u0 = users.rows[0] as { id: string } | undefined;
    if (u0) {
      const wrongId = '00000000-0000-0000-0000-000000000001';
      const orScope = await pool.query(
        `
        SELECT COUNT(*)::int AS c FROM tasks t
        WHERE t.organization_id = $1
          AND (t.assignee_id = $2 OR EXISTS (
            SELECT 1 FROM users pu WHERE pu.id = t.assignee_id AND lower(coalesce(pu.email,'')) = $3
          ))
          AND lower(coalesce(t.task_type,'')) = 'personal'
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
      `,
        [ORG, wrongId, EMAIL.toLowerCase()]
      );
      console.log(
        '\nOpen personal with WRONG jwt id + email EXISTS (simulates demo scope):',
        orScope.rows[0]?.c
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
