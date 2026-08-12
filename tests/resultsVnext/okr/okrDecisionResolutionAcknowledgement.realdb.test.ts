/**
 * OKR-E006 — `acknowledgeDecisionResolution`: unresolved guard, terminal-
 * status guard (reusing decisionOutcomeService.isTerminalDecisionOutcome),
 * event payload snapshot correctness, and
 * `scanAndAcknowledgeResolvedDecisionLinks`'s scheduled-actor path —
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §10.4/§15 DoD
 * ("resolution is provably written back to okr_vnext's own event log as a
 * real event row, not inferred client-side").
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e006-decision-ack-org-${tag}`;
const USER_ADMIN = `okr-e006-decision-ack-admin-${tag}`;
const USER_OWNER = `okr-e006-decision-ack-owner-${tag}`;
const USER_MANAGER = `okr-e006-decision-ack-manager-${tag}`;

let client: Client;
let reachable = false;
let setId: string;
let objectiveId: string;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type SupportCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
type DecisionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrDecisionCommands.js');
type SchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let raiseSupportRequest: SupportCommandsModule['raiseSupportRequest'];
let requestDecisionFromSupportRequest: DecisionCommandsModule['requestDecisionFromSupportRequest'];
let acknowledgeDecisionResolution: DecisionCommandsModule['acknowledgeDecisionResolution'];
let OkrDecisionNotYetResolvedError: DecisionCommandsModule['OkrDecisionNotYetResolvedError'];
let scanAndAcknowledgeResolvedDecisionLinks: SchedulerModule['scanAndAcknowledgeResolvedDecisionLinks'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
  };
}

async function raiseAndRequestDecision(): Promise<{ requestId: string; linkId: string; decisionId: string; rowVersion: number }> {
  const raised = await raiseSupportRequest({
    setId,
    objectiveId,
    organizationId: ORG_ID,
    body: 'Need a decision.',
    assignedToUserId: USER_MANAGER,
    createdBy: USER_OWNER,
    actorEffectiveRole: 'member',
    idempotencyKey: `raise-sr-ack-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const outcome = await requestDecisionFromSupportRequest({
    requestId: raised.result.requestId,
    organizationId: ORG_ID,
    expectedVersion: raised.result.rowVersion,
    requestedDecision: 'Approve budget',
    impactOfDelay: 'Blocks progress',
    requestedBy: USER_OWNER,
    actorEffectiveRole: 'member',
    idempotencyKey: `request-decision-ack-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  return {
    requestId: raised.result.requestId,
    linkId: outcome.result.decisionLink.linkId,
    decisionId: outcome.result.decisionLink.decisionId,
    rowVersion: outcome.result.decisionLink.rowVersion,
  };
}

describe('OKR-E006 acknowledgeDecisionResolution — terminal-outcome guard + event write-back (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 decision-ack tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_decision_links LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E006 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG_ID,
      'Decision-ack fixture Org',
    ]);
    for (const userId of [USER_ADMIN, USER_OWNER, USER_MANAGER]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [userId, ORG_ID, `${userId}@example.test`]
      );
    }

    const programCommands: ProgramCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;
    const cycleCommands: CycleCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
    createCycle = cycleCommands.createCycle;
    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;
    const supportCommands: SupportCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
    raiseSupportRequest = supportCommands.raiseSupportRequest;
    const decisionCommands: DecisionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrDecisionCommands.js'
    );
    requestDecisionFromSupportRequest = decisionCommands.requestDecisionFromSupportRequest;
    acknowledgeDecisionResolution = decisionCommands.acknowledgeDecisionResolution;
    OkrDecisionNotYetResolvedError = decisionCommands.OkrDecisionNotYetResolvedError;
    const scannerModule: SchedulerModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.js'
    );
    scanAndAcknowledgeResolvedDecisionLinks = scannerModule.scanAndAcknowledgeResolvedDecisionLinks;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Decision-ack fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId: created.result.programId,
      name: 'Decision-ack fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const set = await createOkrSet({
      organizationId: ORG_ID,
      programId: created.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_MANAGER,
      title: 'Decision-ack fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    setId = set.result.set.setId;
    const objective = await createObjective({
      setId,
      organizationId: ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'Decision-ack fixture Objective',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-objective-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveId = objective.result.objectiveId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM okr_vnext_decision_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM decisions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('rejects acknowledgement while the Decision is still pending (not a terminal outcome)', async () => {
    const link = await raiseAndRequestDecision();
    await expect(
      acknowledgeDecisionResolution({
        linkId: link.linkId,
        organizationId: ORG_ID,
        expectedVersion: link.rowVersion,
        actorUserId: USER_MANAGER,
        actorEffectiveRole: 'member',
        idempotencyKey: `ack-pending-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(OkrDecisionNotYetResolvedError);
  });

  itDB('acknowledges once the Decision reaches a terminal outcome (approved) and writes a real event row', async () => {
    const link = await raiseAndRequestDecision();
    await client.query(`UPDATE decisions SET status = 'approved', decision_rationale = $1, decided_at = now() WHERE id = $2`, [
      'Budget approved.',
      link.decisionId,
    ]);

    const outcome = await acknowledgeDecisionResolution({
      linkId: link.linkId,
      organizationId: ORG_ID,
      expectedVersion: link.rowVersion,
      actorUserId: USER_MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `ack-approved-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    expect(outcome.result.decisionLink.resolutionAcknowledged).toBe(true);
    expect(outcome.result.decisionStatus).toBe('approved');
    expect(outcome.result.decisionRationale).toBe('Budget approved.');

    // The literal "resolution written back to the OKR timeline as an
    // event" requirement — a real rvn_platform_events row, not inferred
    // client-side.
    const eventRow = await client.query<{ event_type: string; after_state: Record<string, unknown> }>(
      `SELECT event_type, after_state FROM rvn_platform_events WHERE event_id = $1`,
      [outcome.eventId]
    );
    expect(eventRow.rows).toHaveLength(1);
    expect(eventRow.rows[0]!.event_type).toBe('okr_support.decision_resolution_acknowledged');
    expect((eventRow.rows[0]!.after_state as { decisionStatus?: string }).decisionStatus).toBe('approved');

    // Idempotent-by-construction guard — a second acknowledge on the same
    // link is rejected, not silently re-applied.
    await expect(
      acknowledgeDecisionResolution({
        linkId: link.linkId,
        organizationId: ORG_ID,
        expectedVersion: outcome.result.decisionLink.rowVersion,
        actorUserId: USER_MANAGER,
        actorEffectiveRole: 'member',
        idempotencyKey: `ack-approved-again-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(/already/);
  });

  itDB('scanAndAcknowledgeResolvedDecisionLinks: scheduled-actor path acknowledges a terminal, unattended link', async () => {
    const link = await raiseAndRequestDecision();
    await client.query(`UPDATE decisions SET status = 'rejected', decision_rationale = $1, decided_at = now() WHERE id = $2`, [
      'Not approved.',
      link.decisionId,
    ]);

    const result = await scanAndAcknowledgeResolvedDecisionLinks({ organizationId: ORG_ID });
    expect(result.acknowledged).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);

    const row = await client.query<{ resolution_acknowledged: boolean; resolution_acknowledged_by: string | null }>(
      `SELECT resolution_acknowledged, resolution_acknowledged_by FROM okr_vnext_decision_links WHERE link_id = $1`,
      [link.linkId]
    );
    expect(row.rows[0]!.resolution_acknowledged).toBe(true);
    // Scheduled/service-actor trigger — actorUserId is NULL, not a human id.
    expect(row.rows[0]!.resolution_acknowledged_by).toBeNull();
  });
});
