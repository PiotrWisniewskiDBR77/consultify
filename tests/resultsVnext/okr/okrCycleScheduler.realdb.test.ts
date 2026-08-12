/**
 * OKR-E001 — Cycle scheduler two-call idempotency, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.6/§10, point 2:
 * "run `proposeAndExecuteDueCycleTransitions` twice against the same due
 * Cycle; second call a no-op. Run `generateCadenceOccurrences` twice; row
 * count unchanged on the second run."
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
const ORG_PREFIX = `okr-e001-scheduler-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e001-scheduler-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let proposeAndExecuteDueCycleTransitions: SchedulerModule['proposeAndExecuteDueCycleTransitions'];
let generateCadenceOccurrences: SchedulerModule['generateCadenceOccurrences'];
let getCycle: RepositoryModule['getCycle'];
let closePgPool: (() => Promise<void>) | undefined;

async function createActiveProgram(): Promise<{ organizationId: string; programId: string; rowVersion: number }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Scheduler fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const published = await publishProgram({
    programId: created.result.programId,
    organizationId,
    expectedVersion: created.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  return {
    organizationId,
    programId: created.result.programId,
    rowVersion: published.result.program.rowVersion,
  };
}

describe('OKR-E001 Cycle scheduler — two-call idempotency (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR Cycle scheduler realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_checkin_occurrences LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' +
          String(error)
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

    const scheduler: SchedulerModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js');
    proposeAndExecuteDueCycleTransitions = scheduler.proposeAndExecuteDueCycleTransitions;
    generateCadenceOccurrences = scheduler.generateCadenceOccurrences;

    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
    getCycle = repository.getCycle;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1`, [orgLike]);
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

  // ==========================================
  // proposeAndExecuteDueCycleTransitions
  // ==========================================

  itDB(
    'proposeAndExecuteDueCycleTransitions: first call transitions the one due Cycle ' +
      '(planned -> drafting, draft_open_at long past); second call is a no-op, not an error, no double-transition',
    async () => {
      const { organizationId, programId } = await createActiveProgram();
      const created = await createCycle({
        organizationId,
        programId,
        name: 'Scheduler due-transition fixture Cycle',
        // draft_open_at/submission_due_at are in the PAST (due now); every
        // OTHER column is in the far FUTURE so only the planned->drafting
        // transition is due — proves single-step idempotency, not a
        // same-call cascade through all 4 transitions.
        startDate: '2020-01-01',
        endDate: '2030-12-31',
        draftOpenAt: '2020-01-01T00:00:00.000Z',
        submissionDueAt: '2020-01-15T00:00:00.000Z',
        activeStartAt: '2030-01-01T00:00:00.000Z',
        finalUpdateDueAt: '2030-03-20T00:00:00.000Z',
        reviewOpenAt: '2030-03-21T00:00:00.000Z',
        reflectionDueAt: '2030-03-25T00:00:00.000Z',
        closeAt: '2030-03-31T00:00:00.000Z',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-due-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const cycleId = created.result.cycleId;
      expect(created.result.status).toBe('planned');

      const firstRun = await proposeAndExecuteDueCycleTransitions({ organizationId });
      expect(firstRun.transitioned).toEqual([{ cycleId, toStatus: 'drafting' }]);

      const afterFirst = await getCycle({ organizationId, cycleId });
      expect(afterFirst?.status).toBe('drafting');
      const rowVersionAfterFirst = afterFirst?.rowVersion;

      // Second call: this Cycle is no longer 'planned' (rule 1 no longer
      // matches it) and its active_start_at (2030) is still far in the
      // future (rule 2 does not match it either) — a genuine no-op, not an
      // error, and not a second transition.
      const secondRun = await proposeAndExecuteDueCycleTransitions({ organizationId });
      expect(secondRun.transitioned).toEqual([]);

      const afterSecond = await getCycle({ organizationId, cycleId });
      expect(afterSecond?.status).toBe('drafting');
      expect(afterSecond?.rowVersion).toBe(rowVersionAfterFirst);

      // Exactly one Cycle row — no duplicate row was ever created.
      const rowCount = await client.query(`SELECT cycle_id FROM okr_vnext_cycles WHERE organization_id = $1`, [
        organizationId,
      ]);
      expect(rowCount.rowCount).toBe(1);
    }
  );

  itDB('proposeAndExecuteDueCycleTransitions: a Cycle with nothing due yields an empty result, both calls', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Scheduler nothing-due fixture Cycle',
      startDate: '2030-01-01',
      endDate: '2030-03-31',
      draftOpenAt: '2030-01-01T00:00:00.000Z',
      submissionDueAt: '2030-01-15T00:00:00.000Z',
      activeStartAt: '2030-02-01T00:00:00.000Z',
      finalUpdateDueAt: '2030-03-20T00:00:00.000Z',
      reviewOpenAt: '2030-03-21T00:00:00.000Z',
      reflectionDueAt: '2030-03-25T00:00:00.000Z',
      closeAt: '2030-03-31T00:00:00.000Z',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-nothing-due-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const firstRun = await proposeAndExecuteDueCycleTransitions({ organizationId });
    expect(firstRun.transitioned).toEqual([]);
    const secondRun = await proposeAndExecuteDueCycleTransitions({ organizationId });
    expect(secondRun.transitioned).toEqual([]);

    const stillPlanned = await getCycle({ organizationId, cycleId: created.result.cycleId });
    expect(stillPlanned?.status).toBe('planned');
  });

  // ==========================================
  // generateCadenceOccurrences
  // ==========================================

  itDB(
    'generateCadenceOccurrences: first call materializes the expected biweekly windows; ' +
      'second call is a no-op (created:0), no duplicate rows',
    async () => {
      const { organizationId, programId } = await createActiveProgram();
      const created = await createCycle({
        organizationId,
        programId,
        name: 'Cadence fixture Cycle',
        startDate: '2026-01-01',
        endDate: '2026-02-15',
        draftOpenAt: '2025-12-15T00:00:00.000Z',
        submissionDueAt: '2025-12-28T00:00:00.000Z',
        // active_start_at -> final_update_due_at spans exactly 28 days
        // (2026-01-01 through 2026-01-29) — with the Program's default
        // biweekly (14-day) checkin_frequency this deterministically
        // produces 3 windows: [01-01,01-14], [01-15,01-28], [01-29,01-29].
        activeStartAt: '2026-01-01T00:00:00.000Z',
        finalUpdateDueAt: '2026-01-29T00:00:00.000Z',
        reviewOpenAt: '2026-01-30T00:00:00.000Z',
        reflectionDueAt: '2026-02-02T00:00:00.000Z',
        closeAt: '2026-02-15T00:00:00.000Z',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-cadence-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const cycleId = created.result.cycleId;

      const firstRun = await generateCadenceOccurrences({ organizationId, cycleId });
      expect(firstRun.created).toBe(3);
      expect(firstRun.skippedExisting).toBe(0);

      const rowsAfterFirst = await client.query(
        `SELECT window_start, window_end FROM okr_vnext_checkin_occurrences
          WHERE organization_id = $1 AND cycle_id = $2 ORDER BY window_start ASC`,
        [organizationId, cycleId]
      );
      expect(rowsAfterFirst.rowCount).toBe(3);

      // Second call: fully idempotent — every window already exists, zero
      // new rows, no error, no duplicate row.
      const secondRun = await generateCadenceOccurrences({ organizationId, cycleId });
      expect(secondRun.created).toBe(0);
      expect(secondRun.skippedExisting).toBe(3);

      const rowsAfterSecond = await client.query(
        `SELECT cadence_occurrence_id FROM okr_vnext_checkin_occurrences
          WHERE organization_id = $1 AND cycle_id = $2`,
        [organizationId, cycleId]
      );
      expect(rowsAfterSecond.rowCount).toBe(3);
    }
  );

  itDB('generateCadenceOccurrences: "custom" checkin_frequency is a no-op (design §6.6)', async () => {
    const organizationId = freshOrgId();
    const created = await createProgram({
      organizationId,
      name: 'Custom-cadence fixture Program',
      checkinFrequency: 'custom',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-custom-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const published = await publishProgram({
      programId: created.result.programId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-custom-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(published.result.policyVersion.snapshot.checkinFrequency).toBe('custom');

    const cycle = await createCycle({
      organizationId,
      programId: created.result.programId,
      name: 'Custom-cadence fixture Cycle',
      startDate: '2026-01-01',
      endDate: '2026-02-15',
      draftOpenAt: '2025-12-15T00:00:00.000Z',
      submissionDueAt: '2025-12-28T00:00:00.000Z',
      activeStartAt: '2026-01-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-01-29T00:00:00.000Z',
      reviewOpenAt: '2026-01-30T00:00:00.000Z',
      reflectionDueAt: '2026-02-02T00:00:00.000Z',
      closeAt: '2026-02-15T00:00:00.000Z',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-custom-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const run = await generateCadenceOccurrences({ organizationId, cycleId: cycle.result.cycleId });
    // OKR-E004 addition (IO-6, additive/backward-compatible): the result
    // shape now also carries `createdOccurrenceIds` — updated here to
    // match, still asserting the exact full shape rather than switching to
    // objectContaining (a regression in either `created`/`skippedExisting`
    // OR an unexpectedly non-empty `createdOccurrenceIds` should still
    // fail this test).
    expect(run).toEqual({ created: 0, skippedExisting: 0, createdOccurrenceIds: [] });
  });
});
