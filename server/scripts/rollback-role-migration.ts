import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';

import { getDatabaseAsync } from '../src/database/index.js';

type Db = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: any[]) => void) => void;
  run: (
    sql: string,
    params: unknown[],
    cb: (this: { changes: number }, err: Error | null) => void
  ) => void;
};

function all<T = any>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows || []) as T[])));
  });
}

function run(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.changes || 0);
    });
  });
}

async function main() {
  const confirm = process.env.ROLE_MIGRATION_ROLLBACK_CONFIRM;
  if (confirm !== 'RESTORE_LEGACY_PROJECT_ROLES') {
    throw new Error(
      'Set ROLE_MIGRATION_ROLLBACK_CONFIRM=RESTORE_LEGACY_PROJECT_ROLES to run rollback.'
    );
  }

  const db = (await getDatabaseAsync()) as unknown as Db;
  const before = await all<{ count: number }>(
    db,
    `SELECT COUNT(*) as count
     FROM project_members
     WHERE legacy_project_role IS NOT NULL
       AND TRIM(legacy_project_role) <> ''`
  );
  const restored = await run(
    db,
    `UPDATE project_members
     SET project_role = legacy_project_role,
         normalized_project_role = NULL,
         role_template_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE legacy_project_role IS NOT NULL
       AND TRIM(legacy_project_role) <> ''`
  );

  const after = await all<{ count: number }>(
    db,
    `SELECT COUNT(*) as count
     FROM project_members
     WHERE normalized_project_role IS NOT NULL OR role_template_id IS NOT NULL`
  );
  const report = {
    generatedAt: new Date().toISOString(),
    confirmation: confirm,
    rowsEligibleBeforeRollback: Number(before[0]?.count || 0),
    rowsRestored: restored,
    rowsStillNormalizedAfterRollback: Number(after[0]?.count || 0),
  };
  const outputPath = path.resolve(process.cwd(), 'role-migration-rollback-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Role migration rollback complete. Restored project member rows: ${restored}`);
  console.log(`Rollback report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
