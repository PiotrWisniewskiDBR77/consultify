/**
 * Read-only audit for canonical user function profile coverage.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx server/scripts/audit-user-function-profile.ts
 */

import '../src/config/loadEnv.js';

import {
  getDatabaseHost,
  resolveReachableDatabaseUrl,
} from '../src/config/databaseTargetResolver.js';

type QueryResult<T> = {
  rows: T[];
};

async function main() {
  const resolved = resolveReachableDatabaseUrl();
  if (!resolved.databaseUrl) {
    throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required');
  }
  const databaseUrl = resolved.databaseUrl;
  const parsed = new URL(databaseUrl);
  const target = {
    source: resolved.source,
    host: getDatabaseHost(databaseUrl),
    database: parsed.pathname.replace(/^\/+/, '') || 'unknown',
    reason: resolved.reason,
  };

  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const columns = await client.query<
      { column_name: string }
    >(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'`);
    const availableColumns = new Set(columns.rows.map((row) => row.column_name));
    const requiredColumns = [
      'job_title',
      'department',
      'site_location',
      'seniority_level',
      'tenure_years',
      'expertise_tags',
    ];
    const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));

    const coverage: QueryResult<{
      organization_id: string | null;
      total_users: string;
      with_job_title: string;
      with_department: string;
      with_required_profile: string;
      with_site_location: string;
    }> =
      missingColumns.length > 0
        ? { rows: [] }
        : await client.query(`
            SELECT
              organization_id,
              COUNT(*)::text AS total_users,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(job_title), '') IS NOT NULL)::text AS with_job_title,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(department), '') IS NOT NULL)::text AS with_department,
              COUNT(*) FILTER (
                WHERE NULLIF(TRIM(job_title), '') IS NOT NULL
                  AND NULLIF(TRIM(department), '') IS NOT NULL
              )::text AS with_required_profile,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(site_location), '') IS NOT NULL)::text AS with_site_location
            FROM users
            GROUP BY organization_id
            ORDER BY organization_id NULLS LAST
          `);

    const report = {
      generatedAt: new Date().toISOString(),
      target,
      requiredColumns,
      missingColumns,
      coverage: coverage.rows.map((row) => ({
        organizationId: row.organization_id,
        totalUsers: Number(row.total_users),
        withJobTitle: Number(row.with_job_title),
        withDepartment: Number(row.with_department),
        withRequiredProfile: Number(row.with_required_profile),
        withSiteLocation: Number(row.with_site_location),
      })),
      readOnly: true,
    };

    console.log(JSON.stringify(report, null, 2));

    if (missingColumns.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[audit-user-function-profile] failed:', error);
  process.exit(1);
});
