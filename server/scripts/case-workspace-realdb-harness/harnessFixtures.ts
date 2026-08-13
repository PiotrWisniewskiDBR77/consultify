/**
 * Case Workspace real-DB harness — shared fixture helpers (Task 4/5).
 *
 * Mirrors the seedOrg/seedUser/seedMember convention documented in
 * server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts
 * (read there for the canonical pattern this file follows). All inserts run
 * on an out-of-band `pg.Pool` ("control") that is entirely separate from the
 * app's own getDatabase()/getDatabaseAsync() connection the services under
 * test use — same separation the .pg.test.ts suite uses between its
 * `control` pool and the service functions it calls.
 *
 * IMPORTANT: this file does not decide RUN_DB_TESTS/MOCK_DB/DATABASE_URL —
 * callers (the task5_*.ts scripts) must export those in the environment
 * BEFORE importing any caseWorkspace service module, exactly like the
 * `.pg.test.ts` suite's own header documents.
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

export function makeControlPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return new Pool({ connectionString, max: 8 });
}

export interface OrgProjectFixture {
  orgId: string;
  projectId: string;
}

export async function seedOrgAndProject(pool: Pool, label: string): Promise<OrgProjectFixture> {
  const suffix = randomUUID();
  const orgId = `cwharness-org-${label}-${suffix}`;
  const projectId = `cwharness-project-${label}-${suffix}`;
  await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    orgId,
    `Case Workspace realdb harness org (${label})`,
  ]);
  await pool.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
    projectId,
    orgId,
    `Case Workspace realdb harness project (${label})`,
  ]);
  return { orgId, projectId };
}

export async function seedUser(pool: Pool, orgId: string, label: string): Promise<string> {
  const userId = `cwharness-user-${label}-${randomUUID()}`;
  await pool.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    userId,
    orgId,
    `${userId}@example.test`,
  ]);
  return userId;
}

export async function seedMember(
  pool: Pool,
  orgId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER',
  status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
): Promise<void> {
  await pool.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, $5)`,
    [`cwharness-member-${randomUUID()}`, orgId, userId, role, status]
  );
}

export async function seedMemberedUser(
  pool: Pool,
  orgId: string,
  label: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
): Promise<string> {
  const userId = await seedUser(pool, orgId, label);
  await seedMember(pool, orgId, userId, role, 'ACTIVE');
  return userId;
}

/** Seeds a case_core row directly (bypassing caseCoreService — this is fixture setup, not the code under test). */
export async function seedCaseCore(
  pool: Pool,
  fixture: OrgProjectFixture,
  createdByActorId: string,
  label: string
): Promise<string> {
  const caseId = `cwharness-case-${label}-${randomUUID()}`;
  await pool.query(
    `INSERT INTO case_core (
       case_id, project_id, organization_id, contracted_closure_type,
       created_by_actor_id, case_status
     ) VALUES ($1, $2, $3, 'DELIVERY_COMPLETED', $4, 'ACTIVE')`,
    [caseId, fixture.projectId, fixture.orgId, createdByActorId]
  );
  return caseId;
}

/** Seeds a v8_execution_runs row directly (no FK dependency beyond organization_id being a plain TEXT column). */
export async function seedExecutionRun(
  pool: Pool,
  orgId: string,
  initiatorUserId: string,
  label: string
): Promise<string> {
  const runId = `cwharness-run-${label}-${randomUUID()}`;
  await pool.query(
    `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5)`,
    [runId, orgId, `cwharness-ctx-${randomUUID()}`, initiatorUserId, `Harness fixture run (${label})`]
  );
  return runId;
}

/** Seeds a case_workspace_capabilities row directly (bypassing registerCapability — fixture setup only). */
export async function seedCapability(pool: Pool, label: string): Promise<string> {
  const capabilityRegistryId = `cwharness-cap-${label}-${randomUUID()}`;
  await pool.query(
    `INSERT INTO case_workspace_capabilities (
       capability_registry_id, capability_id, capability_version, owner_module,
       provider_type, operation, owning_command_ref, input_schema_ref,
       output_schema_ref, operation_class, effect_class, data_classification,
       idempotency_strategy, reversibility, approval_recommendation,
       created_by_actor_id
     ) VALUES ($1, $2, '1.0.0', 'harness', 'INTERNAL', 'harness.op', 'harness.command',
       'harness://input-schema', 'harness://output-schema', 'COMPUTE', 'SAFE_ADDITIVE',
       'INTERNAL', 'CALLER_KEY', 'IDEMPOTENT_NATURALLY', 'auto_executable', 'cwharness-system')`,
    [capabilityRegistryId, `cwharness-capid-${label}-${randomUUID()}`]
  );
  return capabilityRegistryId;
}

/** Best-effort teardown of everything a harness fixture may have created, respecting FK order. */
export async function teardownAll(
  pool: Pool,
  ids: {
    orgIds?: string[];
    projectIds?: string[];
    userIds?: string[];
    caseIds?: string[];
    runIds?: string[];
    capabilityIds?: string[];
  }
): Promise<void> {
  for (const capabilityId of ids.capabilityIds ?? []) {
    await pool
      .query(`DELETE FROM case_workspace_capability_idempotency_keys WHERE capability_registry_id = $1`, [
        capabilityId,
      ])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_registry_id = $1`, [capabilityId])
      .catch(() => undefined);
  }
  for (const caseId of ids.caseIds ?? []) {
    await pool.query(`DELETE FROM case_workspace_waits WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await pool
      .query(`DELETE FROM case_workspace_action_proposal_decisions WHERE action_proposal_id IN (SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1)`, [caseId])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM case_workspace_action_proposals WHERE case_id = $1`, [caseId])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
      .catch(() => undefined);
    await pool.query(`DELETE FROM case_core WHERE case_id = $1`, [caseId]).catch(() => undefined);
  }
  for (const runId of ids.runIds ?? []) {
    await pool.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [runId]).catch(() => undefined);
  }
  for (const projectId of ids.projectIds ?? []) {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
  }
  for (const userId of ids.userIds ?? []) {
    await pool.query(`DELETE FROM organization_members WHERE user_id = $1`, [userId]).catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
  }
  for (const orgId of ids.orgIds ?? []) {
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }
}
