/**
 * OKR-E001 — Cycle lifecycle: `createCycle`'s program-not-active guard
 * (fail-closed BEFORE any INSERT), all 5 status transitions, cancel from
 * every non-terminal state, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.4/§6.5
 * (OKR-F-001-AC-02, OKR-F-002-AC-01).
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
const ORG_PREFIX = `okr-e001-cyclelife-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e001-cyclelife-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');
type AtomicWriteModule = typeof import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let runOkrCycleLifecycleTransition: CycleCommandsModule['runOkrCycleLifecycleTransition'];
let OkrCycleProgramNotActiveError: CycleCommandsModule['OkrCycleProgramNotActiveError'];
let OkrCycleValidationError: CycleCommandsModule['OkrCycleValidationError'];
let OKR_CYCLE_OPEN_DRAFTING_SPEC: CycleCommandsModule['OKR_CYCLE_OPEN_DRAFTING_SPEC'];
let OKR_CYCLE_ACTIVATE_SPEC: CycleCommandsModule['OKR_CYCLE_ACTIVATE_SPEC'];
let OKR_CYCLE_OPEN_REVIEW_SPEC: CycleCommandsModule['OKR_CYCLE_OPEN_REVIEW_SPEC'];
let OKR_CYCLE_CLOSE_SPEC: CycleCommandsModule['OKR_CYCLE_CLOSE_SPEC'];
let OKR_CYCLE_CANCEL_SPEC: CycleCommandsModule['OKR_CYCLE_CANCEL_SPEC'];
let getCycle: RepositoryModule['getCycle'];
let AtomicWriteAggregateNotFoundError: AtomicWriteModule['AtomicWriteAggregateNotFoundError'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes(): {
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  activeStartAt: string;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  closeAt: string;
} {
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

/** Creates + publishes a fresh Program in a fresh org, returns its id and
 * current row_version (post-publish). */
async function createActiveProgram(): Promise<{ organizationId: string; programId: string; rowVersion: number }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Cycle-lifecycle fixture Program',
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

describe('OKR-E001 Cycle lifecycle — program-not-active guard, transitions, cancel (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR Cycle lifecycle realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_cycles LIMIT 0');
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
    runOkrCycleLifecycleTransition = cycleCommands.runOkrCycleLifecycleTransition;
    OkrCycleProgramNotActiveError = cycleCommands.OkrCycleProgramNotActiveError;
    OkrCycleValidationError = cycleCommands.OkrCycleValidationError;
    OKR_CYCLE_OPEN_DRAFTING_SPEC = cycleCommands.OKR_CYCLE_OPEN_DRAFTING_SPEC;
    OKR_CYCLE_ACTIVATE_SPEC = cycleCommands.OKR_CYCLE_ACTIVATE_SPEC;
    OKR_CYCLE_OPEN_REVIEW_SPEC = cycleCommands.OKR_CYCLE_OPEN_REVIEW_SPEC;
    OKR_CYCLE_CLOSE_SPEC = cycleCommands.OKR_CYCLE_CLOSE_SPEC;
    OKR_CYCLE_CANCEL_SPEC = cycleCommands.OKR_CYCLE_CANCEL_SPEC;

    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
    getCycle = repository.getCycle;

    const atomicWrite: AtomicWriteModule = await import(
      '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
    );
    AtomicWriteAggregateNotFoundError = atomicWrite.AtomicWriteAggregateNotFoundError;

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
  // createCycle — program-not-active guard (OKR-F-001-AC-02)
  // ==========================================

  itDB('createCycle rejects with OkrCycleProgramNotActiveError when the Program is still "draft"', async () => {
    const organizationId = freshOrgId();
    const draftProgram = await createProgram({
      organizationId,
      name: 'Draft-status guard fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    await expect(
      createCycle({
        organizationId,
        programId: draftProgram.result.programId,
        name: 'Should never be created',
        ...baseCycleTimes(),
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-guard-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(OkrCycleProgramNotActiveError);

    // Fail-closed BEFORE any INSERT — zero Cycle rows for this Program.
    const rows = await client.query(`SELECT cycle_id FROM okr_vnext_cycles WHERE program_id = $1`, [
      draftProgram.result.programId,
    ]);
    expect(rows.rowCount).toBe(0);
  });

  itDB(
    'createCycle rejects with OkrCycleProgramNotActiveError when the Program is "suspended" ' +
      '(status reachable only via direct manipulation — no suspend command exists in this epic)',
    async () => {
      const { organizationId, programId } = await createActiveProgram();
      await client.query(`UPDATE okr_vnext_programs SET status = 'suspended' WHERE program_id = $1`, [programId]);

      await expect(
        createCycle({
          organizationId,
          programId,
          name: 'Should never be created (suspended)',
          ...baseCycleTimes(),
          createdBy: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `create-cycle-guard-suspended-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrCycleProgramNotActiveError);

      const rows = await client.query(`SELECT cycle_id FROM okr_vnext_cycles WHERE program_id = $1`, [programId]);
      expect(rows.rowCount).toBe(0);
    }
  );

  itDB('createCycle rejects with AtomicWriteAggregateNotFoundError when the Program does not exist at all', async () => {
    const organizationId = freshOrgId();
    await expect(
      createCycle({
        organizationId,
        programId: randomUUID(),
        name: 'Should never be created (no program)',
        ...baseCycleTimes(),
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-guard-missing-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(AtomicWriteAggregateNotFoundError);
  });

  itDB('createCycle succeeds when the Program is active, pinning policy_version_id', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const program = await client.query<{ active_policy_version_id: string }>(
      `SELECT active_policy_version_id FROM okr_vnext_programs WHERE program_id = $1`,
      [programId]
    );

    const outcome = await createCycle({
      organizationId,
      programId,
      name: 'Successful create fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-success-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('planned');
    expect(outcome.result.policyVersionId).toBe(program.rows[0].active_policy_version_id);
  });

  // ==========================================
  // All 5 transitions, in sequence
  // ==========================================

  itDB(
    'runOkrCycleLifecycleTransition: full pipeline planned -> drafting -> active -> review -> closed, ' +
      'rejecting an out-of-order attempt at each step',
    async () => {
      const { organizationId, programId } = await createActiveProgram();
      const created = await createCycle({
        organizationId,
        programId,
        name: 'Full pipeline fixture Cycle',
        ...baseCycleTimes(),
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-pipeline-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const cycleId = created.result.cycleId;

      // Out-of-order: cannot activate directly from 'planned'.
      await expect(
        runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
          cycleId,
          organizationId,
          expectedVersion: created.result.rowVersion,
          actorUserId: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `activate-out-of-order-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrCycleValidationError);

      const drafting = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
        cycleId,
        organizationId,
        expectedVersion: created.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `open-drafting-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(drafting.result.status).toBe('drafting');

      const active = await runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
        cycleId,
        organizationId,
        expectedVersion: drafting.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `activate-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(active.result.status).toBe('active');

      const review = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_REVIEW_SPEC, {
        cycleId,
        organizationId,
        expectedVersion: active.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `open-review-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(review.result.status).toBe('review');

      const closed = await runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
        cycleId,
        organizationId,
        expectedVersion: review.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(closed.result.status).toBe('closed');

      // Terminal — closing again must reject, not silently no-op.
      await expect(
        runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
          cycleId,
          organizationId,
          expectedVersion: closed.result.rowVersion,
          actorUserId: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `close-again-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrCycleValidationError);

      const persisted = await getCycle({ organizationId, cycleId });
      expect(persisted?.status).toBe('closed');
    }
  );

  // ==========================================
  // cancel — from every non-terminal state (design addition, §6.5)
  // ==========================================

  itDB('cancel from "planned"', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Cancel-from-planned fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-cancel-planned-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelled = await runOkrCycleLifecycleTransition(OKR_CYCLE_CANCEL_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-planned-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelled.result.status).toBe('cancelled');
  });

  itDB('cancel from "drafting"', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Cancel-from-drafting fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-cancel-drafting-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const drafting = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-drafting-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelled = await runOkrCycleLifecycleTransition(OKR_CYCLE_CANCEL_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: drafting.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-drafting-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelled.result.status).toBe('cancelled');
  });

  itDB('cancel from "active"', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Cancel-from-active fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const drafting = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-drafting-for-active-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const active = await runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: drafting.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `activate-for-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelled = await runOkrCycleLifecycleTransition(OKR_CYCLE_CANCEL_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: active.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelled.result.status).toBe('cancelled');
  });

  itDB('cancel from "review"', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Cancel-from-review fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-cancel-review-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const drafting = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-drafting-for-review-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const active = await runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: drafting.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `activate-for-review-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const review = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_REVIEW_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: active.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-review-for-cancel-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelled = await runOkrCycleLifecycleTransition(OKR_CYCLE_CANCEL_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: review.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-review-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelled.result.status).toBe('cancelled');
  });

  itDB('cancel from "closed" (terminal) is rejected — closed is not in the cancel spec\'s fromStatuses', async () => {
    const { organizationId, programId } = await createActiveProgram();
    const created = await createCycle({
      organizationId,
      programId,
      name: 'Cancel-from-closed fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-cancel-closed-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const drafting = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_DRAFTING_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-drafting-for-closed-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const active = await runOkrCycleLifecycleTransition(OKR_CYCLE_ACTIVATE_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: drafting.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `activate-for-closed-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const review = await runOkrCycleLifecycleTransition(OKR_CYCLE_OPEN_REVIEW_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: active.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `open-review-for-closed-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const closed = await runOkrCycleLifecycleTransition(OKR_CYCLE_CLOSE_SPEC, {
      cycleId: created.result.cycleId,
      organizationId,
      expectedVersion: review.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-for-cancel-attempt-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(closed.result.status).toBe('closed');

    await expect(
      runOkrCycleLifecycleTransition(OKR_CYCLE_CANCEL_SPEC, {
        cycleId: created.result.cycleId,
        organizationId,
        expectedVersion: closed.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `cancel-closed-attempt-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(OkrCycleValidationError);
  });
});
