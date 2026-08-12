/**
 * OKR-E007 — `carryForwardOkrSet` (OKR-F-023, D8/D15-D17), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.7, D8/D15-D17.
 *
 * Proves: (1) lineage pointer correctness — the carried Set is a NEW row
 * with `carried_from_set_id` pointing at the closed source, same
 * scope/owner/reviewer/title, `status='draft'`; (2) D8: ZERO Objective/KR
 * content is copied — the carried Set has no Objectives at all; (3) D17's
 * dedupe-tuple reuse via `createOkrSet` — a second call for the same
 * (program, target cycle, scope, owner) returns the SAME carried Set,
 * `created=false`; (4) the `source status==='closed'` guard; (5) the
 * `target Cycle status IN ('planned','drafting')` guard.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  baseCycleTimes,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  readSetVersionAndStatus,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-carryfwd-org-${tag}`;
const USER_ADMIN = `okr-e007-carryfwd-admin-${tag}`;
const USER_OWNER = `okr-e007-carryfwd-owner-${tag}`;
const USER_REVIEWER = `okr-e007-carryfwd-reviewer-${tag}`;

let client: Client;
let reachable = false;

type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type CarryForwardModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCarryForwardCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createCycle: CycleCommandsModule['createCycle'];
let OkrCycleValidationError: CycleCommandsModule['OkrCycleValidationError'];
let closeOkrSet: SetCommandsModule['closeOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let OkrSetValidationError: SetCommandsModule['OkrSetValidationError'];
let carryForwardOkrSet: CarryForwardModule['carryForwardOkrSet'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 carryForwardOkrSet — lineage, dedupe, source/target guards (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 carryForwardOkrSet realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;
    OkrCycleValidationError = cycleCommands.OkrCycleValidationError;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    closeOkrSet = setCommands.closeOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_OPEN_REVIEW_SPEC = setCommands.OKR_SET_OPEN_REVIEW_SPEC;
    OkrSetValidationError = setCommands.OkrSetValidationError;

    const carryForwardModule: CarryForwardModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCarryForwardCommands.js'
    );
    carryForwardOkrSet = carryForwardModule.carryForwardOkrSet;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const organizationId of organizationIdsUsed) {
      await cleanupOkrE007Fixture(client, organizationId);
    }
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

  async function buildClosedSourceSetAndTargetCycle() {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: {
        objectiveRollupModel: 'equal_average',
        managerReviewRequired: false,
      },
    });
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: fixture.setId,
      organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `open-review-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const { rowVersion: reviewVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await closeOkrSet({
      setId: fixture.setId,
      organizationId,
      expectedVersion: reviewVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    // A second Cycle, same Program, status='planned' (createCycle's own
    // starting status) — the realistic "carry into next quarter" target.
    const targetCycle = await createCycle({
      organizationId,
      programId: fixture.programId,
      name: 'Carry-forward target Cycle',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      draftOpenAt: '2026-03-15T00:00:00.000Z',
      submissionDueAt: '2026-03-28T00:00:00.000Z',
      activeStartAt: '2026-04-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-06-20T00:00:00.000Z',
      reviewOpenAt: '2026-06-21T00:00:00.000Z',
      reflectionDueAt: '2026-06-25T00:00:00.000Z',
      closeAt: '2026-06-30T00:00:00.000Z',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-target-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    return { organizationId, fixture, targetCycleId: targetCycle.result.cycleId };
  }

  itDB('lineage + zero content copied: creates a NEW draft Set with carried_from_set_id, zero Objectives', async () => {
    const { organizationId, fixture, targetCycleId } = await buildClosedSourceSetAndTargetCycle();

    const result = await carryForwardOkrSet({
      sourceSetId: fixture.setId,
      targetCycleId,
      organizationId,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `carry-forward-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    expect(result.created).toBe(true);
    expect(result.carriedSet.setId).not.toBe(fixture.setId);
    expect(result.carriedSet.cycleId).toBe(targetCycleId);
    expect(result.carriedSet.scopeType).toBe(result.sourceSet.scopeType);
    expect(result.carriedSet.scopeId).toBe(result.sourceSet.scopeId);
    expect(result.carriedSet.ownerUserId).toBe(USER_OWNER);
    expect(result.carriedSet.reviewerUserId).toBe(USER_REVIEWER);
    expect(result.carriedSet.title).toBe(result.sourceSet.title);
    expect(result.carriedSet.status).toBe('draft');

    const row = await client.query<{ carried_from_set_id: string | null }>(
      `SELECT carried_from_set_id FROM okr_vnext_sets WHERE set_id = $1`,
      [result.carriedSet.setId]
    );
    expect(row.rows[0]!.carried_from_set_id).toBe(fixture.setId);

    // D8: the closed source Set's own Set-level identity is untouched
    // (still the SAME row, still 'closed') — carry-forward never moves it.
    const sourceRow = await client.query<{ status: string }>(`SELECT status FROM okr_vnext_sets WHERE set_id = $1`, [fixture.setId]);
    expect(sourceRow.rows[0]!.status).toBe('closed');

    // D8: zero Objective/KR content copied.
    const objectiveCount = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM okr_vnext_objectives WHERE set_id = $1`,
      [result.carriedSet.setId]
    );
    expect(Number(objectiveCount.rows[0]!.count)).toBe(0);
  });

  itDB('dedupe: a second carryForwardOkrSet call for the same (program, target cycle, scope, owner) reuses the SAME carried Set', async () => {
    const { organizationId, fixture, targetCycleId } = await buildClosedSourceSetAndTargetCycle();
    const first = await carryForwardOkrSet({
      sourceSetId: fixture.setId,
      targetCycleId,
      organizationId,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `carry-forward-1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const second = await carryForwardOkrSet({
      sourceSetId: fixture.setId,
      targetCycleId,
      organizationId,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `carry-forward-2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(second.created).toBe(false);
    expect(second.carriedSet.setId).toBe(first.carriedSet.setId);

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM okr_vnext_sets WHERE cycle_id = $1 AND owner_user_id = $2`,
      [targetCycleId, USER_OWNER]
    );
    expect(Number(countResult.rows[0]!.count)).toBe(1);
  });

  itDB('source-not-closed guard: rejects carrying forward a Set that is still "active"', async () => {
    const organizationId = `${ORG_PREFIX}-notclosed-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average' },
    });
    const targetCycle = await createCycle({
      organizationId,
      programId: fixture.programId,
      name: 'Guard target Cycle',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      draftOpenAt: '2026-03-15T00:00:00.000Z',
      submissionDueAt: '2026-03-28T00:00:00.000Z',
      activeStartAt: '2026-04-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-06-20T00:00:00.000Z',
      reviewOpenAt: '2026-06-21T00:00:00.000Z',
      reflectionDueAt: '2026-06-25T00:00:00.000Z',
      closeAt: '2026-06-30T00:00:00.000Z',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-target-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    await expect(
      carryForwardOkrSet({
        sourceSetId: fixture.setId,
        targetCycleId: targetCycle.result.cycleId,
        organizationId,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `carry-forward-guard-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetValidationError);
  });

  itDB('target-cycle-not-eligible guard: rejects a target Cycle that is not "planned"/"drafting" (already "active")', async () => {
    const { organizationId, fixture, targetCycleId } = await buildClosedSourceSetAndTargetCycle();

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    const cycleRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_cycles WHERE cycle_id = $1`, [
      targetCycleId,
    ]);
    const opened = await cycleCommands.runOkrCycleLifecycleTransition(cycleCommands.OKR_CYCLE_OPEN_DRAFTING_SPEC, {
      cycleId: targetCycleId,
      organizationId,
      expectedVersion: cycleRow.rows[0]!.row_version,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-drafting-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await cycleCommands.runOkrCycleLifecycleTransition(cycleCommands.OKR_CYCLE_ACTIVATE_SPEC, {
      cycleId: targetCycleId,
      organizationId,
      expectedVersion: opened.resultingVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `activate-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    await expect(
      carryForwardOkrSet({
        sourceSetId: fixture.setId,
        targetCycleId,
        organizationId,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `carry-forward-cycleguard-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrCycleValidationError);
  });
});
