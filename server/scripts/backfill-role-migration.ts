import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';

import { getDatabaseAsync } from '../src/database/index.js';
import {
  ensureProjectRoleTemplateSchema,
  seedFactoryRoleTemplates,
} from '../src/services/effectiveAccessService.js';
import {
  defaultProjectRoleForApplicationRole,
  normalizeApplicationRole,
  normalizeProjectRole,
} from '../src/utils/roleNormalization.js';

type Db = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: any[]) => void) => void;
  run: (
    sql: string,
    params: unknown[],
    cb: (this: { changes: number }, err: Error | null) => void
  ) => void;
};

const isPostgres = process.env.DB_TYPE === 'postgres' || Boolean(process.env.DATABASE_URL);

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

async function ensureOrganizationMemberRoleConstraint(db: Db): Promise<void> {
  if (!isPostgres) return;
  await run(
    db,
    `ALTER TABLE organization_members
     DROP CONSTRAINT IF EXISTS organization_members_role_check`
  );
}

async function restoreOrganizationMemberRoleConstraint(db: Db): Promise<void> {
  if (!isPostgres) return;
  await run(
    db,
    `ALTER TABLE organization_members
     ADD CONSTRAINT organization_members_role_check
     CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'GUEST'))`
  );
}

async function main() {
  const rawDb = (await getDatabaseAsync()) as unknown as Db;
  await ensureProjectRoleTemplateSchema();
  await ensureOrganizationMemberRoleConstraint(rawDb);

  const report = {
    generatedAt: new Date().toISOString(),
    users: {
      scanned: 0,
      updated: 0,
      ambiguous: [] as Array<{ id?: string; email?: string; role: string; normalizedRole: string }>,
    },
    organizationMembers: {
      scanned: 0,
      updated: 0,
      ambiguous: [] as Array<{ id?: string; userId?: string; organizationId?: string; role: string }>,
    },
    projectMembers: {
      scanned: 0,
      updated: 0,
      ambiguous: [] as Array<{
        id?: string;
        userId?: string;
        projectId?: string;
        projectRole: string;
      }>,
      missingSponsor: [] as string[],
      missingLeader: [] as string[],
      projectLeaderManualPromotionCandidates: [] as Array<{
        projectId?: string;
        projectName?: string;
        projectMemberId?: string;
        userId?: string;
        projectRole?: string;
      }>,
      rollbackReadiness: {
        rowsWithLegacyProjectRole: 0,
        rowsWithoutLegacyProjectRoleAfterNormalization: 0,
      },
    },
  };

  const users = await all<{ id?: string; email?: string; role?: string }>(
    rawDb,
    `SELECT id, email, role FROM users`,
    []
  );
  report.users.scanned = users.length;
  for (const user of users) {
    const originalRole = String(user.role || '');
    const normalized = normalizeApplicationRole(user.role);
    if (normalized !== originalRole.toUpperCase()) {
      await run(rawDb, `UPDATE users SET role = ? WHERE id = ?`, [normalized, user.id]);
      report.users.updated++;
    }
    if (
      ['PROJECT_MANAGER', 'CONSULTANT', 'MEMBER', 'TEAM_MEMBER', 'VIEWER', 'CLIENT'].includes(
        originalRole.toUpperCase()
      )
    ) {
      report.users.ambiguous.push({
        id: user.id,
        email: user.email,
        role: originalRole,
        normalizedRole: normalized,
      });
    }
  }

  const orgMembers = await all<{
    id?: string;
    user_id?: string;
    organization_id?: string;
    role?: string;
  }>(rawDb, `SELECT id, user_id, organization_id, role FROM organization_members`, []);

  report.organizationMembers.scanned = orgMembers.length;
  for (const member of orgMembers) {
    const normalized = normalizeApplicationRole(member.role);
    if (normalized !== String(member.role || '').toUpperCase()) {
      await run(rawDb, `UPDATE organization_members SET role = ? WHERE id = ?`, [
        normalized,
        member.id,
      ]);
      report.organizationMembers.updated++;
    }
    if (['PROJECT_MANAGER', 'CONSULTANT'].includes(String(member.role || '').toUpperCase())) {
      report.organizationMembers.ambiguous.push({
        id: member.id,
        userId: member.user_id,
        organizationId: member.organization_id,
        role: String(member.role || ''),
      });
    }
  }

  const orgs = await all<{ organization_id?: string }>(
    rawDb,
    `SELECT DISTINCT organization_id FROM organization_members WHERE organization_id IS NOT NULL`,
    []
  );
  for (const org of orgs) {
    await seedFactoryRoleTemplates(org.organization_id || null);
  }

  const projectMembers = await all<{
    id?: string;
    user_id?: string;
    project_id?: string;
    project_role?: string;
    normalized_project_role?: string;
    role_template_id?: string;
    organization_id?: string;
  }>(
    rawDb,
    `SELECT pm.id, pm.user_id, pm.project_id, pm.project_role, pm.normalized_project_role,
            pm.role_template_id, p.organization_id
     FROM project_members pm
     LEFT JOIN projects p ON p.id = pm.project_id`,
    []
  );
  report.projectMembers.scanned = projectMembers.length;

  for (const member of projectMembers) {
    const normalized = normalizeProjectRole(member.project_role);
    const ambiguous = ['PMO_LEAD', 'DECISION_OWNER', 'STAKEHOLDER'].includes(
      String(member.project_role || '').toUpperCase()
    );
    if (ambiguous) {
      report.projectMembers.ambiguous.push({
        id: member.id,
        userId: member.user_id,
        projectId: member.project_id,
        projectRole: String(member.project_role || ''),
      });
    }

    const resolvedRole = normalized || defaultProjectRoleForApplicationRole('USER');
    const orgKey = member.organization_id || 'GLOBAL';
    const templateId = `factory_${orgKey}_${resolvedRole}`.toLowerCase();
    if (
      member.normalized_project_role !== resolvedRole ||
      !member.role_template_id ||
      member.project_role !== resolvedRole
    ) {
      await run(
        rawDb,
        `UPDATE project_members
         SET legacy_project_role = COALESCE(legacy_project_role, project_role),
             normalized_project_role = ?,
             project_role = ?,
             role_template_id = ?,
             updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [resolvedRole, resolvedRole, templateId, member.id]
      );
      report.projectMembers.updated++;
    }
  }

  const roleAggregateSql = isPostgres
    ? `STRING_AGG(COALESCE(normalized_project_role, project_role), ',')`
    : `GROUP_CONCAT(COALESCE(normalized_project_role, project_role))`;
  const projectRoles = await all<{ project_id?: string; roles?: string }>(
    rawDb,
    `SELECT project_id, ${roleAggregateSql} as roles
     FROM project_members
     GROUP BY project_id`,
    []
  );
  for (const project of projectRoles) {
    const roles = new Set(String(project.roles || '').split(','));
    if (!roles.has('PROJECT_SPONSOR')) report.projectMembers.missingSponsor.push(project.project_id || '');
    if (!roles.has('PROJECT_LEADER') && !roles.has('PMO')) {
      report.projectMembers.missingLeader.push(project.project_id || '');
    }
  }

  report.projectMembers.projectLeaderManualPromotionCandidates = await all(
    rawDb,
    `SELECT p.id as projectId, p.name as projectName, pm.id as projectMemberId, pm.user_id as userId, pm.project_role as projectRole
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE UPPER(COALESCE(pm.legacy_project_role, pm.project_role, '')) = 'PMO_LEAD'
       AND NOT EXISTS (
         SELECT 1 FROM project_members leader
         WHERE leader.project_id = p.id
           AND UPPER(COALESCE(leader.normalized_project_role, leader.project_role, '')) = 'PROJECT_LEADER'
       )`,
    []
  );

  const rollbackRows = await all<{ metric: string; count: number }>(
    rawDb,
    `SELECT 'rowsWithLegacyProjectRole' as metric, COUNT(*) as count
     FROM project_members
     WHERE legacy_project_role IS NOT NULL AND TRIM(legacy_project_role) <> ''
     UNION ALL
     SELECT 'rowsWithoutLegacyProjectRoleAfterNormalization' as metric, COUNT(*) as count
     FROM project_members
     WHERE normalized_project_role IS NOT NULL
       AND (legacy_project_role IS NULL OR TRIM(legacy_project_role) = '')`,
    []
  );
  for (const row of rollbackRows) {
    if (row.metric === 'rowsWithLegacyProjectRole') {
      report.projectMembers.rollbackReadiness.rowsWithLegacyProjectRole = Number(row.count || 0);
    }
    if (row.metric === 'rowsWithoutLegacyProjectRoleAfterNormalization') {
      report.projectMembers.rollbackReadiness.rowsWithoutLegacyProjectRoleAfterNormalization = Number(
        row.count || 0
      );
    }
  }

  await restoreOrganizationMemberRoleConstraint(rawDb);

  const outputPath = path.resolve(process.cwd(), 'role-migration-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Role migration backfill complete. Report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
