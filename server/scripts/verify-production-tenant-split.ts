#!/usr/bin/env tsx

import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

async function queryRows<T extends Record<string, unknown>>(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return (result.rows || []) as T[];
}

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'verify-production-tenant-split',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('verify-production-tenant-split', target);

  const requiredOrgs = parseCsv(process.env.TENANT_SPLIT_REQUIRED_ORGS, ['vts', 'dbr77', 'atelier']);
  const forbiddenOrgs = parseCsv(process.env.TENANT_SPLIT_FORBIDDEN_ORGS, ['org-dbr77-system']);

  const pool = new pg.Pool({ connectionString: target.connectionString });
  try {
    const organizations = await queryRows<{
      id: string;
      name: string;
      status: string | null;
      plan: string | null;
    }>(
      pool,
      `SELECT id, name, status, plan
       FROM organizations
       WHERE lower(id) = ANY($1)
          OR lower(id) = ANY($2)
       ORDER BY id ASC`,
      [requiredOrgs, forbiddenOrgs]
    );

    const orgIds = organizations.map((org) => String(org.id).toLowerCase());
    const presentRequired = requiredOrgs.filter((orgId) => orgIds.includes(orgId));
    const missingRequired = requiredOrgs.filter((orgId) => !orgIds.includes(orgId));
    const presentForbidden = forbiddenOrgs.filter((orgId) => orgIds.includes(orgId));

    const userCounts = await queryRows<{ organization_id: string; user_count: string }>(
      pool,
      `SELECT organization_id, COUNT(*)::text AS user_count
       FROM users
       WHERE lower(organization_id) = ANY($1)
       GROUP BY organization_id
       ORDER BY organization_id ASC`,
      [requiredOrgs]
    );

    const initiativeCounts = await queryRows<{ organization_id: string; initiative_count: string }>(
      pool,
      `SELECT organization_id, COUNT(*)::text AS initiative_count
       FROM initiatives
       WHERE lower(organization_id) = ANY($1)
       GROUP BY organization_id
       ORDER BY organization_id ASC`,
      [requiredOrgs]
    ).catch(() => []);

    const taskCounts = await queryRows<{ organization_id: string; task_count: string }>(
      pool,
      `SELECT organization_id, COUNT(*)::text AS task_count
       FROM tasks
       WHERE lower(organization_id) = ANY($1)
       GROUP BY organization_id
       ORDER BY organization_id ASC`,
      [requiredOrgs]
    ).catch(() => []);

    const report = {
      target: {
        host: target.host,
        database: target.database,
        source: target.source,
      },
      requiredOrgs,
      forbiddenOrgs,
      summary: {
        presentRequired,
        missingRequired,
        presentForbidden,
        ready:
          missingRequired.length === 0 &&
          presentForbidden.length === 0 &&
          presentRequired.length === requiredOrgs.length,
      },
      organizations,
      userCounts,
      initiativeCounts,
      taskCounts,
    };

    console.log(JSON.stringify(report, null, 2));

    if (report.summary.ready) {
      console.log('\nTenant split verification passed.\n');
      return;
    }

    throw new Error('Tenant split verification failed. Review missingRequired/presentForbidden.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
