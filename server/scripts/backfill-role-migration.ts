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
  const rawDb = (await getDatabaseAsync()) as unknown as Db;
  await ensureProjectRoleTemplateSchema();

  const report = {
    generatedAt: new Date().toISOString(),
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
    },
  };

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
  }>(
    rawDb,
    `SELECT id, user_id, project_id, project_role, normalized_project_role, role_template_id
     FROM project_members`,
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
    const templateId = `factory_global_${resolvedRole}`.toLowerCase();
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

  const projectRoles = await all<{ project_id?: string; roles?: string }>(
    rawDb,
    `SELECT project_id, GROUP_CONCAT(COALESCE(normalized_project_role, project_role)) as roles
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

  const outputPath = path.resolve(process.cwd(), 'role-migration-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Role migration backfill complete. Report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
