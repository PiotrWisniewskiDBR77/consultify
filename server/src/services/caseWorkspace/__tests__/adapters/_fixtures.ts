/**
 * Shared fixtures for the module capability adapter suites
 * (decisionAdapter/initiativeAdapter/kpiAdapter `.pg.test.ts`).
 *
 * Follows the SAME "every test seeds its own org/project/case, tears itself
 * down in a `finally`" convention as artifactLinkService.pg.test.ts and
 * capabilityAdapterService.pg.test.ts (own `seedOrgProjectCase`/`seedAdminOrg`
 * helpers) — factored here once because all three adapter suites need the
 * exact same quadruple (org + project + real case_core row + a real,
 * membered actor) plus the same envelope shape.
 */

import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import * as caseCoreService from '../../caseCoreService.js';
import type { CapabilityExecutionEnvelope } from '../../capabilityAdapterService.js';
import { cleanupSuiteFixtures } from '../_helpers/fixtureCleanup.js';
import { uniqueTestId } from '../_helpers/testNamespace.js';

export interface CaseFixture {
  orgId: string;
  projectId: string;
  caseId: string;
  actorId: string;
}

export async function seedUser(control: Pool, orgId: string, label: string): Promise<string> {
  const userId = uniqueTestId(`adapter-user-${label}`);
  await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    userId,
    orgId,
    `${userId}@example.test`,
  ]);
  return userId;
}

export async function seedMember(
  control: Pool,
  orgId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
): Promise<void> {
  await control.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [uniqueTestId('adapter-member'), orgId, userId, role]
  );
}

export async function seedMemberedUser(
  control: Pool,
  orgId: string,
  label: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
): Promise<string> {
  const userId = await seedUser(control, orgId, label);
  await seedMember(control, orgId, userId, role);
  return userId;
}

/** A fresh organization + project + real case_core row + a real membered actor. */
export async function seedCaseFixture(control: Pool, label: string): Promise<CaseFixture> {
  const suffix = randomUUID();
  const orgId = `cwtest-adapter-org-${label}-${suffix}`;
  const projectId = `cwtest-adapter-project-${label}-${suffix}`;
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    orgId,
    `Adapter test org (${label})`,
  ]);
  await control.query(
    `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [projectId, orgId, `Adapter test project (${label})`]
  );
  const actorId = await seedMemberedUser(control, orgId, label);
  const created = await caseCoreService.createCase({
    projectId,
    organizationId: orgId,
    contractedClosureType: 'DELIVERY_COMPLETED',
    createdByActorId: actorId,
  });
  return { orgId, projectId, caseId: created.caseId, actorId };
}

export function buildEnvelope(params: {
  capabilityId: string;
  capabilityVersion: string;
  orgId: string;
  actorId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  timeoutMs?: number;
}): CapabilityExecutionEnvelope {
  return {
    capabilityId: params.capabilityId,
    capabilityVersion: params.capabilityVersion,
    organizationId: params.orgId,
    actor: { type: 'HUMAN', actorId: params.actorId },
    idempotencyKey: params.idempotencyKey ?? `idem-${randomUUID()}`,
    payload: params.payload,
    timeoutMs: params.timeoutMs,
  };
}

/**
 * Cleans up everything a Golden Case adapter test could have written:
 * the case-workspace tables (via the shared `cleanupSuiteFixtures` backstop)
 * PLUS the native module tables this program's adapters write to
 * (`decisions`, `initiatives`, `initiative_kpis`, `financial_models` + their
 * version/audit siblings) — none of which `cleanupSuiteFixtures`'s
 * CLEANUP_ORDER lists, since that helper is scoped to case-workspace's own
 * tables only.
 */
export async function teardownCaseFixture(control: Pool, fixture: CaseFixture): Promise<void> {
  await control.query(`DELETE FROM decisions WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
  await control
    .query(
      `DELETE FROM kpi_metric_audit_log WHERE organization_id = $1`,
      [fixture.orgId]
    )
    .catch(() => undefined);
  await control
    .query(`DELETE FROM kpi_definition_versions WHERE organization_id = $1`, [fixture.orgId])
    .catch(() => undefined);
  await control
    .query(`DELETE FROM initiative_kpis WHERE organization_id = $1`, [fixture.orgId])
    .catch(() => undefined);
  await control.query(`DELETE FROM initiatives WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
  await control
    .query(`DELETE FROM financial_models WHERE organization_id = $1`, [fixture.orgId])
    .catch(() => undefined);
  await cleanupSuiteFixtures(control, { organizationIds: [fixture.orgId] });
}
