#!/usr/bin/env npx tsx
/** Read-only: tasks/orgs/users sanity for My Work personal-tasks debugging. */
import pg from 'pg';

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

const ANNA_EMAIL = process.env.AUDIT_EMAIL?.trim() || 'anna.zielinska@ateliertoys-demo.com';

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'audit-prod-mywork-data',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('audit-prod-mywork-data', target);
  const pool = new pg.Pool({ connectionString: target.connectionString });
  try {
    const orgs = await pool.query(
      `SELECT id, name FROM organizations WHERE id ILIKE '%atelier%' OR id ILIKE '%demo%' ORDER BY id`
    );
    console.log('Organizations (atelier/demo filter):', orgs.rows);

    const anna = await pool.query(
      `SELECT id, email, organization_id, role FROM users WHERE LOWER(email) = LOWER($1)`,
      [ANNA_EMAIL]
    );
    console.log('\nAnna user row(s):', anna.rows);

    const taskOrg = await pool.query(
      `SELECT organization_id, lower(coalesce(task_type,'')) AS tt, COUNT(*)::int AS c
       FROM tasks GROUP BY 1, 2 ORDER BY 1, 3 DESC`
    );
    console.log('\nTasks by org + task_type (sample):', taskOrg.rows.slice(0, 40));

    const personalByOrg = await pool.query(
      `SELECT organization_id, COUNT(*)::int AS c FROM tasks
       WHERE lower(coalesce(task_type,'')) = 'personal' GROUP BY 1 ORDER BY 2 DESC`
    );
    console.log('\nPersonal tasks by org:', personalByOrg.rows);

    if (anna.rows[0]) {
      const aid = (anna.rows[0] as { id: string }).id;
      const oid = (anna.rows[0] as { organization_id: string }).organization_id;
      const forAnna = await pool.query(
        `SELECT COUNT(*)::int AS c FROM tasks
         WHERE organization_id = $1 AND assignee_id = $2 AND lower(coalesce(task_type,'')) = 'personal'
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
        [oid, aid]
      );
      console.log(`\nOpen personal tasks org=${oid} assignee=${aid}:`, forAnna.rows[0]?.c);
    }

    const demoOrgEnv = process.env.DEMO_ORG_ID || '(unset in script env)';
    console.log('\nNote: script DEMO_ORG_ID from env:', demoOrgEnv);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
