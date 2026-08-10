/**
 * OKR-E006 — Support request lifecycle: postComment, raiseSupportRequest ->
 * acknowledge -> resolve, open -> dismissed, obligation create/complete —
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §8/§15 DoD.
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
const ORG_ID = `okr-e006-lifecycle-org-${tag}`;
const USER_ADMIN = `okr-e006-lifecycle-admin-${tag}`;
const USER_OWNER = `okr-e006-lifecycle-owner-${tag}`;
const USER_MANAGER = `okr-e006-lifecycle-manager-${tag}`;

let client: Client;
let reachable = false;
let setId: string;
let objectiveId: string;
let keyResultId: string;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type SupportCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let postComment: SupportCommandsModule['postComment'];
let raiseSupportRequest: SupportCommandsModule['raiseSupportRequest'];
let acknowledgeSupportRequest: SupportCommandsModule['acknowledgeSupportRequest'];
let resolveSupportRequest: SupportCommandsModule['resolveSupportRequest'];
let dismissSupportRequest: SupportCommandsModule['dismissSupportRequest'];
let OkrSupportRequestValidationError: SupportCommandsModule['OkrSupportRequestValidationError'];
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

describe('OKR-E006 Support request lifecycle (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 support-lifecycle tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_support_requests LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E006 support schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

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
    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;
    const supportCommands: SupportCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
    postComment = supportCommands.postComment;
    raiseSupportRequest = supportCommands.raiseSupportRequest;
    acknowledgeSupportRequest = supportCommands.acknowledgeSupportRequest;
    resolveSupportRequest = supportCommands.resolveSupportRequest;
    dismissSupportRequest = supportCommands.dismissSupportRequest;
    OkrSupportRequestValidationError = supportCommands.OkrSupportRequestValidationError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Support-lifecycle fixture Program',
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
      name: 'Support-lifecycle fixture Cycle',
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
      title: 'Support-lifecycle fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;

    const objective = await createObjective({
      setId,
      organizationId: ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'Support-lifecycle fixture Objective',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-objective-${randomUUID()}`,
    });
    objectiveId = objective.result.objectiveId;

    const keyResult = await createKeyResult({
      objectiveId,
      organizationId: ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'Support-lifecycle fixture KeyResult',
      measurementType: 'numeric',
      direction: 'increase',
      targetValue: 100,
      currentValue: 10,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-${randomUUID()}`,
    });
    keyResultId = keyResult.result.keyResultId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM okr_vnext_decision_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id = $1`, [ORG_ID]);
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

  itDB('postComment: kind=comment, no lifecycle fields set', async () => {
    const outcome = await postComment({
      setId,
      objectiveId,
      organizationId: ORG_ID,
      body: 'A plain comment, no lifecycle.',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `post-comment-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.kind).toBe('comment');
    expect(outcome.result.status).toBeNull();
  });

  itDB('raiseSupportRequest -> acknowledgeSupportRequest -> resolveSupportRequest: full happy path + obligation lifecycle', async () => {
    const raised = await raiseSupportRequest({
      setId,
      objectiveId,
      keyResultId,
      organizationId: ORG_ID,
      body: 'I am blocked on vendor access.',
      assignedToUserId: USER_MANAGER,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `raise-sr-${randomUUID()}`,
    });
    expect(raised.outcome).toBe('applied');
    expect(raised.result.kind).toBe('support_request');
    expect(raised.result.status).toBe('open');
    const requestId = raised.result.requestId;

    const obligationAfterRaise = await client.query(
      `SELECT status, assignee_user_id FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'okr_support_request' AND reference_id = $2
          AND obligation_type = 'respond_to_support_request'`,
      [ORG_ID, requestId]
    );
    expect(obligationAfterRaise.rows).toHaveLength(1);
    expect(obligationAfterRaise.rows[0].status).toBe('open');
    expect(obligationAfterRaise.rows[0].assignee_user_id).toBe(USER_MANAGER);

    const acknowledged = await acknowledgeSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: raised.result.rowVersion,
      actorUserId: USER_MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `ack-sr-${randomUUID()}`,
    });
    expect(acknowledged.result.status).toBe('acknowledged');

    // Obligation is NOT completed by acknowledge — only by resolve/dismiss.
    const obligationAfterAck = await client.query(
      `SELECT status FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'okr_support_request' AND reference_id = $2
          AND obligation_type = 'respond_to_support_request'`,
      [ORG_ID, requestId]
    );
    expect(obligationAfterAck.rows[0].status).toBe('open');

    const resolved = await resolveSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: acknowledged.result.rowVersion,
      resolutionNote: 'Vendor access granted.',
      actorUserId: USER_MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `resolve-sr-${randomUUID()}`,
    });
    expect(resolved.result.status).toBe('resolved');
    expect(resolved.result.resolutionNote).toBe('Vendor access granted.');

    const obligationAfterResolve = await client.query(
      `SELECT status, completed_via_command FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'okr_support_request' AND reference_id = $2
          AND obligation_type = 'respond_to_support_request'`,
      [ORG_ID, requestId]
    );
    expect(obligationAfterResolve.rows[0].status).toBe('completed');
    expect(obligationAfterResolve.rows[0].completed_via_command).toBe('resolveSupportRequest');
  });

  itDB('raiseSupportRequest -> dismissSupportRequest: dismissed also completes the obligation', async () => {
    const raised = await raiseSupportRequest({
      setId,
      objectiveId,
      organizationId: ORG_ID,
      body: 'Never mind, I solved it myself.',
      assignedToUserId: USER_MANAGER,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `raise-sr-dismiss-${randomUUID()}`,
    });
    const requestId = raised.result.requestId;

    // No self-approval-denial guard: the SAME user who raised it (the KR
    // Owner) is allowed to dismiss their own request (design §11).
    const dismissed = await dismissSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: raised.result.rowVersion,
      dismissedReason: 'Resolved independently.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `dismiss-sr-${randomUUID()}`,
    });
    expect(dismissed.result.status).toBe('dismissed');

    const obligation = await client.query(
      `SELECT status, completed_via_command FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'okr_support_request' AND reference_id = $2
          AND obligation_type = 'respond_to_support_request'`,
      [ORG_ID, requestId]
    );
    expect(obligation.rows[0].status).toBe('completed');
    expect(obligation.rows[0].completed_via_command).toBe('dismissSupportRequest');
  });

  itDB('raiseSupportRequest rejects a missing assignedToUserId', async () => {
    await expect(
      raiseSupportRequest({
        setId,
        objectiveId,
        organizationId: ORG_ID,
        body: 'no assignee',
        assignedToUserId: '' as unknown as string,
        createdBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `raise-sr-no-assignee-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(OkrSupportRequestValidationError);
  });

  itDB('acknowledgeSupportRequest rejects a non-open request (kind=comment)', async () => {
    const comment = await postComment({
      setId,
      objectiveId,
      organizationId: ORG_ID,
      body: 'a comment, not a support request',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `comment-for-ack-reject-${randomUUID()}`,
    });
    await expect(
      acknowledgeSupportRequest({
        requestId: comment.result.requestId,
        organizationId: ORG_ID,
        expectedVersion: comment.result.rowVersion,
        actorUserId: USER_MANAGER,
        actorEffectiveRole: 'member',
        idempotencyKey: `ack-comment-reject-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(OkrSupportRequestValidationError);
  });
});
