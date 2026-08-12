/**
 * OKR-E007 — Decision D9's new Cycle-close guard, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.6, D9.
 *
 * A genuine gap found by direct code read of the LANDED
 * `okrCycleCommands.ts`: `runOkrCycleLifecycleTransition`'s
 * `OkrCycleLifecycleTransitionSpec` carried NO `guard` slot at all before
 * this epic (unlike ROI's own `RoiCaseLifecycleTransitionSpec.guard`,
 * confirmed working in `roiCaseCommands.ts`'s `markReadyForReview`) — a
 * Cycle could close while its Sets were still `active`/`review`. This test
 * proves the guard THIS epic adds to `OKR_CYCLE_CLOSE_SPEC`: rejects while
 * any Set under the Cycle is not `closed`/`cancelled`/`not_required`,
 * succeeds once every Set has reached one of those three statuses.
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
  cleanupOkrE007Fixture,
  readSetVersionAndStatus,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-cycleguard-org-${tag}`;
const USER_ADMIN = `okr-e007-cycleguard-admin-${tag}`;
const USER_OWNER = `okr-e007-cycleguard-owner-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let runOkrCycleLifecycleTransition: CycleCommandsModule['runOkrCycleLifecycleTransition'];
let OKR_CYCLE_OPEN_DRAFTING_SPEC: CycleCommandsModule['OKR_CYCLE_OPEN_DRAFTING_SPEC'];
let OKR_CYCLE_ACTIVATE_SPEC: CycleCommandsModule['OKR_CYCLE_ACTIVATE_SPEC'];
let OKR_CYCLE_OPEN_REVIEW_SPEC: CycleCommandsModule['OKR_CYCLE_OPEN_REVIEW_SPEC'];
let OKR_CYCLE_CLOSE_SPEC: CycleCommandsModule['OKR_CYCLE_CLOSE_SPEC'];
let OkrCycleHasOpenSetsError: CycleCommandsModule['OkrCycleHasOpenSetsError'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_CANCEL_SPEC: SetCommandsModule['OKR_SET_CANCEL_SPEC'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

async function driveCycleToReview(
  organizationId: string,
  cycleId: string,
  expectedVersionStart: number
): Promise<number> {
  const opened = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
    cycleId,
    organizationId,
    expectedVersion: expectedVersionStart,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `open-drafting-${randomUUID()}`,
  });
  const activated = await runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
    cycleId,
    organizationId,
    expectedVersion: opened.resultingVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `activate-${randomUUID()}`,
  });
  const reviewed = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_REVIEW_SPEC, {
    cycleId,
    organizationId,
    expectedVersion: activated.resultingVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `open-review-${randomUUID()}`,
  });
  return reviewed.resultingVersion;
}

describe('OKR-E007 Cycle-close guard (D9) — rejects with open Sets, succeeds once all closed/cancelled (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 Cycle-close-guard realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_cycles LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;
    runOkrCycleLifecycleTransition = cycleCommands.runOkrCycleLifecycleTransition;
    OKR_CYCLE_OPEN_DRAFTING_SPEC = cycleCommands.OKR_CYCLE_OPEN_DRAFTING_SPEC;
    OKR_CYCLE_ACTIVATE_SPEC = cycleCommands.OKR_CYCLE_ACTIVATE_SPEC;
    OKR_CYCLE_OPEN_REVIEW_SPEC = cycleCommands.OKR_CYCLE_OPEN_REVIEW_SPEC;
    OKR_CYCLE_CLOSE_SPEC = cycleCommands.OKR_CYCLE_CLOSE_SPEC;
    OkrCycleHasOpenSetsError = cycleCommands.OkrCycleHasOpenSetsError;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_CANCEL_SPEC = setCommands.OKR_SET_CANCEL_SPEC;

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

  async function freshProgramAndCycle() {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const program = await createProgram({
      organizationId,
      name: 'Cycle-close-guard fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: program.result.programId,
      organizationId,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycle = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Cycle-close-guard fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    return { organizationId, programId: program.result.programId, cycleId: cycle.result.cycleId, cycleVersion: cycle.result.rowVersion };
  }

  itDB('rejects: a Cycle with one still-active Set cannot close, error lists that Set id', async () => {
    const { organizationId, programId, cycleId, cycleVersion } = await freshProgramAndCycle();
    const set = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'Cycle-close-guard fixture Set',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const setId = set.result.set.setId;

    const reviewVersion = await driveCycleToReview(organizationId, cycleId, cycleVersion);

    let caught: unknown;
    try {
      await runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
        cycleId,
        organizationId,
        expectedVersion: reviewVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-cycle-1-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrCycleHasOpenSetsError);
    const details = (caught as InstanceType<typeof OkrCycleHasOpenSetsError>).details as { openSetIds: string[] };
    expect(details.openSetIds).toEqual([setId]);

    // The Cycle must still be "review" — the guard fired BEFORE the UPDATE.
    const cycleRow = await client.query<{ status: string }>(`SELECT status FROM okr_vnext_cycles WHERE cycle_id = $1`, [cycleId]);
    expect(cycleRow.rows[0]!.status).toBe('review');
  });

  itDB('succeeds: once the only Set is cancelled, the Cycle closes', async () => {
    const { organizationId, programId, cycleId, cycleVersion } = await freshProgramAndCycle();
    const set = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'Cycle-close-guard fixture Set',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const setId = set.result.set.setId;

    const reviewVersion = await driveCycleToReview(organizationId, cycleId, cycleVersion);

    // Cancel the Set (a real, reachable terminal state a fresh draft Set
    // can reach directly).
    const { rowVersion: setVersion } = await readSetVersionAndStatus(client, setId);
    await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId,
      organizationId,
      expectedVersion: setVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-set-${randomUUID()}`,
    });

    const outcome = await runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
      cycleId,
      organizationId,
      expectedVersion: reviewVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-cycle-2-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('closed');
  });

  itDB('succeeds trivially: a Cycle with zero Sets closes with no guard rejection', async () => {
    const { organizationId, cycleId, cycleVersion } = await freshProgramAndCycle();
    const reviewVersion = await driveCycleToReview(organizationId, cycleId, cycleVersion);
    const outcome = await runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
      cycleId,
      organizationId,
      expectedVersion: reviewVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-cycle-empty-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('closed');
  });
});
