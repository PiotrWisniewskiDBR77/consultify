import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';

import { getDatabaseAsync } from '../src/database/index.js';
import { ensureProjectRoleTemplateSchema } from '../src/services/effectiveAccessService.js';

type Db = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: any[]) => void) => void;
};

function all<T = any>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows || []) as T[])));
  });
}

async function safeAll<T = any>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await all<T>(db, sql, params);
  } catch {
    return [];
  }
}

function classifyPermissionsShape(raw: unknown): string {
  if (!raw) return 'empty';
  if (typeof raw !== 'string') return Array.isArray(raw) ? 'array' : typeof raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return 'capability_array';
    if (parsed && typeof parsed === 'object') return 'legacy_object';
    return typeof parsed;
  } catch {
    return 'invalid_json';
  }
}

async function main() {
  const db = (await getDatabaseAsync()) as unknown as Db;
  await ensureProjectRoleTemplateSchema();
  const report = {
    generatedAt: new Date().toISOString(),
    usersRoleCounts: await safeAll(
      db,
      `SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`
    ),
    organizationMemberRoleCounts: await safeAll(
      db,
      `SELECT role, COUNT(*) as count FROM organization_members GROUP BY role ORDER BY count DESC`
    ),
    projectMemberRoleCounts: await safeAll(
      db,
      `SELECT project_role, COUNT(*) as count FROM project_members GROUP BY project_role ORDER BY count DESC`
    ),
    projectMemberPermissionsShapes: [] as Array<{ shape: string; count: number }>,
    ambiguousOrganizationMembers: await safeAll(
      db,
      `SELECT id, organization_id, user_id, role
       FROM organization_members
       WHERE UPPER(COALESCE(role, '')) IN ('PROJECT_MANAGER', 'CONSULTANT', 'MEMBER', 'TEAM_MEMBER', 'VIEWER', 'CLIENT')`
    ),
    ambiguousProjectMembers: await safeAll(
      db,
      `SELECT id, project_id, user_id, project_role
       FROM project_members
       WHERE UPPER(COALESCE(project_role, '')) IN ('PMO_LEAD', 'DECISION_OWNER', 'STAKEHOLDER', 'CONSULTANT', 'PROJECT_MANAGER')`
    ),
    projectLeaderManualPromotionCandidates: await safeAll(
      db,
      `SELECT p.id as project_id, p.name, pm.id as project_member_id, pm.user_id, pm.project_role
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE UPPER(COALESCE(pm.project_role, '')) = 'PMO_LEAD'
         AND NOT EXISTS (
           SELECT 1 FROM project_members leader
           WHERE leader.project_id = p.id
             AND UPPER(COALESCE(leader.normalized_project_role, leader.project_role, '')) = 'PROJECT_LEADER'
         )`
    ),
    projectsMissingSponsor: await safeAll(
      db,
      `SELECT p.id, p.name
       FROM projects p
       WHERE NOT EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id = p.id
           AND UPPER(COALESCE(pm.normalized_project_role, pm.project_role, '')) IN ('PROJECT_SPONSOR', 'SPONSOR')
       )`
    ),
    projectsMissingLeader: await safeAll(
      db,
      `SELECT p.id, p.name
       FROM projects p
       WHERE NOT EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id = p.id
           AND UPPER(COALESCE(pm.normalized_project_role, pm.project_role, '')) IN ('PROJECT_LEADER', 'PMO', 'PROJECT_MANAGER', 'PMO_LEAD')
       )`
    ),
    rollbackReadiness: {
      rowsWithLegacyProjectRole: 0,
      rowsWithoutLegacyProjectRoleAfterNormalization: 0,
    },
  };

  const permissionRows = await safeAll<{ permissions?: string }>(
    db,
    `SELECT permissions FROM project_members`
  );
  const shapeCounts = new Map<string, number>();
  for (const row of permissionRows) {
    const shape = classifyPermissionsShape(row.permissions);
    shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1);
  }
  report.projectMemberPermissionsShapes = Array.from(shapeCounts.entries()).map(
    ([shape, count]) => ({ shape, count })
  );

  const rollbackRows = await safeAll<{ metric: string; count: number }>(
    db,
    `SELECT 'rowsWithLegacyProjectRole' as metric, COUNT(*) as count
     FROM project_members
     WHERE legacy_project_role IS NOT NULL AND TRIM(legacy_project_role) <> ''
     UNION ALL
     SELECT 'rowsWithoutLegacyProjectRoleAfterNormalization' as metric, COUNT(*) as count
     FROM project_members
     WHERE normalized_project_role IS NOT NULL
       AND (legacy_project_role IS NULL OR TRIM(legacy_project_role) = '')`
  );
  for (const row of rollbackRows) {
    if (row.metric === 'rowsWithLegacyProjectRole') {
      report.rollbackReadiness.rowsWithLegacyProjectRole = Number(row.count || 0);
    }
    if (row.metric === 'rowsWithoutLegacyProjectRoleAfterNormalization') {
      report.rollbackReadiness.rowsWithoutLegacyProjectRoleAfterNormalization = Number(row.count || 0);
    }
  }

  const outputPath = path.resolve(process.cwd(), 'role-migration-inventory.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Role migration inventory complete. Report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
