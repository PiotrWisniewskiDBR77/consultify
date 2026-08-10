/**
 * OKR-E006 — `requestDecisionFromSupportRequest`: real `decisions` row
 * created with correct `source_type`/`source_id`, zero FK from
 * `okr_vnext_decision_links` to `decisions`, atomic write, against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §10, §15 DoD
 * ("AC-019 proven: a real decisions row is created via the (Integration-
 * Owner-approved) extended create path with correct source_type/source_id;
 * okr_vnext_decision_links has zero FK to decisions").
 *
 * REAL FINDING this test surfaces and documents: unlike every `okr_vnext_*`
 * table (bare TEXT actor/org ids, no FK), the platform `decisions` table
 * has REAL foreign keys — `organization_id -> organizations(id)`,
 * `decision_maker_id`/`created_by -> users(id)` (both ON DELETE SET NULL,
 * which does NOT relax insert-time constraint checking). This test
 * therefore provisions real `organizations`/`users` fixture rows —
 * `requestDecisionFromSupportRequest` will surface a raw FK-violation if
 * called with an organizationId/actor id that has no matching
 * `organizations`/`users` row, an edge case restated in the closure entry.
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
const ORG_ID = `okr-e006-decision-seam-org-${tag}`;
const USER_ADMIN = `okr-e006-decision-seam-admin-${tag}`;
const USER_OWNER = `okr-e006-decision-seam-owner-${tag}`;
const USER_MANAGER = `okr-e006-decision-seam-manager-${tag}`;

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
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let raiseSupportRequest: SupportCommandsModule['raiseSupportRequest'];
let requestDecisionFromSupportRequest: DecisionCommandsModule['requestDecisionFromSupportRequest'];
let OKR_DECISION_SOURCE_TYPE: DecisionCommandsModule['OKR_DECISION_SOURCE_TYPE'];
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

describe('OKR-E006 requestDecisionFromSupportRequest — Decisions seam (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 decision-seam tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_decision_links LIMIT 0');
      await client.query('SELECT 1 FROM decisions LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E006/decisions schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    // decisions.organization_id/created_by/decision_maker_id carry real FKs
    // (see file header) — provision the real rows this seam depends on.
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG_ID,
      'Decision-seam fixture Org',
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
    OKR_DECISION_SOURCE_TYPE = decisionCommands.OKR_DECISION_SOURCE_TYPE;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Decision-seam fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
    });
    await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
    });
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId: created.result.programId,
      name: 'Decision-seam fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });
    const set = await createOkrSet({
      organizationId: ORG_ID,
      programId: created.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_MANAGER,
      title: 'Decision-seam fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;
    const objective = await createObjective({
      setId,
      organizationId: ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'Decision-seam fixture Objective',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-objective-${randomUUID()}`,
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

  itDB(
    'creates a real `decisions` row with correct source_type/source_id, an okr_vnext_decision_links row with ZERO FK to decisions, and updates the support request atomically',
    async () => {
      const raised = await raiseSupportRequest({
        setId,
        objectiveId,
        organizationId: ORG_ID,
        body: 'Need a scope-change decision.',
        assignedToUserId: USER_MANAGER,
        createdBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `raise-sr-decision-${randomUUID()}`,
      });
      const requestId = raised.result.requestId;

      const outcome = await requestDecisionFromSupportRequest({
        requestId,
        organizationId: ORG_ID,
        expectedVersion: raised.result.rowVersion,
        requestedDecision: 'Approve the extra vendor budget',
        impactOfDelay: 'Blocks the KR for two weeks',
        desiredDate: '2026-02-15',
        requestedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `request-decision-${randomUUID()}`,
      });

      expect(outcome.outcome).toBe('applied');
      const { decisionLink, supportRequest } = outcome.result;
      expect(supportRequest.decisionLinkId).toBe(decisionLink.linkId);

      const decisionRow = await client.query<{ id: string; source_type: string | null; source_id: string | null; status: string }>(
        `SELECT id, source_type, source_id, status FROM decisions WHERE id = $1`,
        [decisionLink.decisionId]
      );
      expect(decisionRow.rows).toHaveLength(1);
      expect(decisionRow.rows[0]!.source_type).toBe(OKR_DECISION_SOURCE_TYPE);
      expect(decisionRow.rows[0]!.source_id).toBe(requestId);
      expect(decisionRow.rows[0]!.status).toBe('pending');

      // Zero FK from okr_vnext_decision_links to decisions — confirmed by
      // querying pg_constraint for any FK on decision_id.
      const fkCheck = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE conrelid = 'okr_vnext_decision_links'::regclass AND contype = 'f'
            AND conname LIKE '%decision_id%'`
      );
      expect(fkCheck.rows).toHaveLength(0);

      // A second request-decision call on the SAME (now-consumed) support
      // request must be rejected (decision_link_id IS NOT NULL guard).
      await expect(
        requestDecisionFromSupportRequest({
          requestId,
          organizationId: ORG_ID,
          expectedVersion: supportRequest.rowVersion,
          requestedDecision: 'second attempt',
          impactOfDelay: 'n/a',
          requestedBy: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `request-decision-second-${randomUUID()}`,
        })
      ).rejects.toThrow(/already has a Decision requested/);
    }
  );
});
