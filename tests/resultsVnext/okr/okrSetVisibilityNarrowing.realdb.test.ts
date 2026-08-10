/**
 * OKR-E002 — `narrowOkrSetVisibility`: every narrowing accepted, every
 * widening rejected, across ALL rank pairs of the 5 visibility modes; and
 * narrowing is permitted while the Set is `active` (D19) — against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.3, D12/D19
 * (OKR-F-006-AC-01: "Visibility inherits the Program's visibility_default;
 * a per-record override may ONLY narrow").
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
const ORG_PREFIX = `okr-e002-narrow-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e002-narrow-admin-${tag}`;
const USER_OWNER = `okr-e002-narrow-owner-${tag}`;
const USER_REVIEWER = `okr-e002-narrow-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let narrowOkrSetVisibility: SetCommandsModule['narrowOkrSetVisibility'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let OkrSetVisibilityWideningDeniedError: SetCommandsModule['OkrSetVisibilityWideningDeniedError'];
let VISIBILITY_NARROWNESS_RANK: SetCommandsModule['VISIBILITY_NARROWNESS_RANK'];
let closePgPool: (() => Promise<void>) | undefined;

const ALL_MODES = ['OPEN_ORG', 'SCOPE', 'MANAGEMENT_CHAIN', 'RESTRICTED_ACL', 'PRIVATE'] as const;

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

/** Creates a fresh org whose Program's `visibility_default` (the ceiling
 * `narrowOkrSetVisibility` checks candidates against) is `ceilingMode`, a
 * Cycle under it, and one draft Set. */
async function createOrgWithCeilingAndDraftSet(
  ceilingMode: (typeof ALL_MODES)[number]
): Promise<{ organizationId: string; setId: string; rowVersion: number }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: `Narrowing fixture Program (${ceilingMode})`,
    visibilityDefault: ceilingMode,
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
  });
  await publishProgram({
    programId: created.result.programId,
    organizationId,
    expectedVersion: created.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
  });
  const cycle = await createCycle({
    organizationId,
    programId: created.result.programId,
    name: 'Narrowing fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  const set = await createOkrSet({
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: USER_OWNER,
    ownerUserId: USER_OWNER,
    reviewerUserId: USER_REVIEWER,
    title: `Narrowing fixture Set (ceiling=${ceilingMode})`,
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  return { organizationId, setId: set.result.set.setId, rowVersion: set.result.set.rowVersion };
}

describe('OKR-E002 narrowOkrSetVisibility — every narrowing accepted, every widening rejected, D19 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Set narrowing realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Set schema); refusing to report a green run. ' +
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

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    narrowOkrSetVisibility = setCommands.narrowOkrSetVisibility;
    submitOkrSetForApproval = setCommands.submitOkrSetForApproval;
    approveOkrSet = setCommands.approveOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_ACTIVATE_SPEC = setCommands.OKR_SET_ACTIVATE_SPEC;
    OkrSetVisibilityWideningDeniedError = setCommands.OkrSetVisibilityWideningDeniedError;
    VISIBILITY_NARROWNESS_RANK = setCommands.VISIBILITY_NARROWNESS_RANK;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(
      `UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
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
  // Full rank-pair matrix: for each of the 5 possible ceilings, every one
  // of the 5 candidate modes is attempted — accepted iff
  // rank(candidate) >= rank(ceiling), rejected otherwise.
  // ==========================================

  for (const ceilingMode of ALL_MODES) {
    itDB(`ceiling=${ceilingMode}: every candidate mode resolves exactly per VISIBILITY_NARROWNESS_RANK`, async () => {
      const { organizationId, setId, rowVersion } = await createOrgWithCeilingAndDraftSet(ceilingMode);
      let currentVersion = rowVersion;
      const ceilingRank = VISIBILITY_NARROWNESS_RANK[ceilingMode];

      for (const candidateMode of ALL_MODES) {
        const candidateRank = VISIBILITY_NARROWNESS_RANK[candidateMode];
        const shouldAccept = candidateRank >= ceilingRank;

        if (shouldAccept) {
          const outcome = await narrowOkrSetVisibility({
            setId,
            organizationId,
            expectedVersion: currentVersion,
            visibilityMode: candidateMode,
            actorUserId: USER_OWNER,
            actorEffectiveRole: 'member',
            idempotencyKey: `narrow-${ceilingMode}-${candidateMode}-${randomUUID()}`,
          });
          expect(outcome.result.visibilityMode).toBe(candidateMode);
          currentVersion = outcome.result.set.rowVersion;

          const visRow = await client.query<{ visibility_mode: string }>(
            `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type = 'okr_set' AND resource_id = $1::text`,
            [setId]
          );
          expect(visRow.rows[0]?.visibility_mode).toBe(candidateMode);
        } else {
          await expect(
            narrowOkrSetVisibility({
              setId,
              organizationId,
              expectedVersion: currentVersion,
              visibilityMode: candidateMode,
              actorUserId: USER_OWNER,
              actorEffectiveRole: 'member',
              idempotencyKey: `narrow-${ceilingMode}-${candidateMode}-rejected-${randomUUID()}`,
            })
          ).rejects.toBeInstanceOf(OkrSetVisibilityWideningDeniedError);
          // rowVersion must NOT have advanced on a rejected attempt.
          const row = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
            setId,
          ]);
          expect(row.rows[0]?.row_version).toBe(currentVersion);
        }
      }
    });
  }

  // ==========================================
  // D19 — narrowing permitted in 'active', not just draft states
  // ==========================================

  itDB(
    'D19: narrowing is accepted while the Set is "active" (a widening attempt in the same state is still rejected)',
    async () => {
      const { organizationId, setId, rowVersion } = await createOrgWithCeilingAndDraftSet('OPEN_ORG');

      const submitted = await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-active-narrow-${randomUUID()}`,
      });
      const approved = await approveOkrSet({
        setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-active-narrow-${randomUUID()}`,
      });
      const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
        setId,
        organizationId,
        expectedVersion: approved.result.set.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `activate-active-narrow-${randomUUID()}`,
      });
      expect(activated.result.status).toBe('active');

      // Ceiling is OPEN_ORG (rank 0) — narrowing to RESTRICTED_ACL (rank 3)
      // while active must succeed.
      const narrowed = await narrowOkrSetVisibility({
        setId,
        organizationId,
        expectedVersion: activated.result.rowVersion,
        visibilityMode: 'RESTRICTED_ACL',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `narrow-while-active-${randomUUID()}`,
      });
      expect(narrowed.result.set.status).toBe('active');
      expect(narrowed.result.visibilityMode).toBe('RESTRICTED_ACL');

      // Now attempt to WIDEN back toward OPEN_ORG while still active — must
      // still be rejected (ceiling is still OPEN_ORG, but the whole point
      // is narrowing-only relative to the ceiling; RESTRICTED_ACL(3) ->
      // OPEN_ORG(0) is itself only ever compared against the ceiling, and
      // OPEN_ORG(0) < ceiling rank 0 is false — 0 >= 0 is actually true, so
      // re-narrowing to OPEN_ORG when the ceiling IS OPEN_ORG is legal by
      // this command's own contract (D12 checks candidate-vs-ceiling, not
      // candidate-vs-current). Use a mode ABOVE the ceiling instead — there
      // is none above OPEN_ORG, so assert the true negative differently:
      // a Set under a SCOPE-ceiling Program cannot widen to OPEN_ORG even
      // while active.
      const { organizationId: scopeOrgId, setId: scopeSetId, rowVersion: scopeRowVersion } =
        await createOrgWithCeilingAndDraftSet('SCOPE');
      const scopeSubmitted = await submitOkrSetForApproval({
        setId: scopeSetId,
        organizationId: scopeOrgId,
        expectedVersion: scopeRowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-scope-active-narrow-${randomUUID()}`,
      });
      const scopeApproved = await approveOkrSet({
        setId: scopeSetId,
        organizationId: scopeOrgId,
        expectedVersion: scopeSubmitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-scope-active-narrow-${randomUUID()}`,
      });
      const scopeActivated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
        setId: scopeSetId,
        organizationId: scopeOrgId,
        expectedVersion: scopeApproved.result.set.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `activate-scope-active-narrow-${randomUUID()}`,
      });

      await expect(
        narrowOkrSetVisibility({
          setId: scopeSetId,
          organizationId: scopeOrgId,
          expectedVersion: scopeActivated.result.rowVersion,
          visibilityMode: 'OPEN_ORG',
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `widen-while-active-rejected-${randomUUID()}`,
        })
      ).rejects.toBeInstanceOf(OkrSetVisibilityWideningDeniedError);
    }
  );

  // ==========================================
  // Guard: narrowing on a cancelled Set is rejected (NOT in
  // OKR_SET_NARROWABLE_STATUSES)
  // ==========================================

  itDB('narrowing is rejected on a "cancelled" Set', async () => {
    const { organizationId, setId, rowVersion } = await createOrgWithCeilingAndDraftSet('OPEN_ORG');
    const cancelSpecModule: SetCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetCommands.js'
    );
    const cancelled = await cancelSpecModule.runOkrSetLifecycleTransition(cancelSpecModule.OKR_SET_CANCEL_SPEC, {
      setId,
      organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-for-narrow-guard-${randomUUID()}`,
    });
    expect(cancelled.result.status).toBe('cancelled');

    await expect(
      narrowOkrSetVisibility({
        setId,
        organizationId,
        expectedVersion: cancelled.result.rowVersion,
        visibilityMode: 'PRIVATE',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `narrow-cancelled-rejected-${randomUUID()}`,
      })
    ).rejects.toThrow();
  });
});
