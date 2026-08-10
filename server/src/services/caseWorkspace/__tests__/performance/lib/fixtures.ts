/**
 * CW-PERF — minimal org/project/user/membership bootstrap for the
 * performance harness, on a dedicated out-of-band `pg.Pool` ("control"),
 * copying the exact fixture pattern every `*.pg.test.ts` file in this
 * directory already uses (see caseCoreService.pg.test.ts's own
 * seedOrgAndProject/seedUser/seedMember).
 *
 * This is fixture bootstrap ONLY — organizations/projects/users/membership
 * are prerequisite tenancy rows a real caller's session already has before
 * it ever calls a Case Workspace command; no `case_core` /
 * `case_plan_versions` / `case_workspace_event_outbox` / etc. row is ever
 * created by direct INSERT anywhere in this harness — every one of THOSE is
 * always minted through the real caseCoreService / casePlanVersionService /
 * caseHistoryService / eventOutboxService API, per the task's explicit
 * "nie INSERT-em na skroty" instruction.
 */

import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

export interface OrgFixture {
  orgId: string;
  projectId: string;
  actorId: string;
}

export async function seedOrgProjectActor(pool: Pool, label: string): Promise<OrgFixture> {
  const suffix = randomUUID();
  const orgId = `cwperf-org-${label}-${suffix}`;
  const projectId = `cwperf-project-${label}-${suffix}`;
  const userId = `cwperf-user-${label}-${suffix}`;

  await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    orgId,
    `CW perf profile org (${label})`,
  ]);
  await pool.query(
    `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [projectId, orgId, `CW perf profile project (${label})`]
  );
  await pool.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    userId,
    orgId,
    `${userId}@example.test`,
  ]);
  await pool.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`cwperf-member-${randomUUID()}`, orgId, userId]
  );

  return { orgId, projectId, actorId: userId };
}
