/**
 * Case Workspace — LIGHT one-click start, proved against a REAL PostgreSQL
 * (packet CW-T-C). Exercises
 * server/src/services/caseWorkspace/lightOneClickService.ts directly (no
 * HTTP layer — see integration/lightOneClick.pg.test.ts for the HTTP-level
 * proof) against the real `caseCoreService`, `casePlanVersionService`,
 * `runBindingService`, `nodeRunService`, `contextSnapshotService` and
 * `v8_execution_runs`.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as every `*.pg.test.ts` sibling in this directory:
 * `NODE_ENV=test` ALONE is a trap — `Database.ts` hands back an in-memory
 * MOCK unless `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`. This file gates
 * on that AND probes that the migrated schema is present, and SKIPS LOUDLY
 * (never silently passes) when either is missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run src/services/caseWorkspace/__tests__/lightOneClickService.pg.test.ts --environment node
 *
 * ===========================================================================
 * ISOLATION
 * ===========================================================================
 * Every test seeds its own organization/project/user/membership/Case inside
 * the test body and tears everything down itself in a `finally` — including
 * rows OUTSIDE this packet's own tables (`v8_execution_runs`,
 * `v8_context_snapshots`, `case_workspace_node_runs`,
 * `case_workspace_node_run_attempts`) that the service creates but no
 * shared fixture helper in this codebase knows how to clean up, because no
 * prior packet created Runs from inside case-workspace at all.
 *
 * ===========================================================================
 * WHY ASSERTIONS READ POSTGRES DIRECTLY, NOT JUST THE RETURN VALUE
 * ===========================================================================
 * Every scenario below confirms its claim with a `SELECT ... FROM <real
 * table>` on an out-of-band `pg.Pool` (`control`) in addition to the
 * service's own return value — a return value only proves what the service
 * THINKS it wrote. The "DOKLADNIE zero albo jeden Run" invariant in
 * particular is asserted this way after every scenario that touches a Run.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as planSvc from '../casePlanVersionService.js';
import * as lightSvc from '../lightOneClickService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000 });
  try {
    const result = await probe.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [
        [
          'organizations',
          'organization_members',
          'projects',
          'users',
          'case_core',
          'case_plan_versions',
          'case_workspace_run_bindings',
          'case_workspace_node_runs',
          'case_workspace_node_run_attempts',
          'case_workspace_event_outbox',
          'v8_execution_runs',
          'v8_context_snapshots',
        ],
      ]
    );
    const present = new Set(result.rows.map((r) => r.table_name));
    return [
      'organizations',
      'organization_members',
      'projects',
      'users',
      'case_core',
      'case_plan_versions',
      'case_workspace_run_bindings',
      'case_workspace_node_runs',
      'case_workspace_node_run_attempts',
      'case_workspace_event_outbox',
      'v8_execution_runs',
      'v8_context_snapshots',
    ].every((t) => present.has(t));
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[lightOneClickService pg suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and ` +
      `every case-workspace + v8-execution-spine migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('lightOneClickService — LIGHT one-click start against a real PostgreSQL (CW-T-C)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 10 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — every test seeds and tears down its own everything.
  // -------------------------------------------------------------------------

  async function seedFixture(label: string): Promise<{ orgId: string; projectId: string; userId: string }> {
    const suffix = randomUUID();
    // orgId/userId are DELIBERATELY bare UUIDs, not `light1c-org-<label>-<uuid>`
    // style prefixed ids other suites in this directory use: this system's
    // REAL identities are not always UUID-shaped (scripts/dev/case-workspace-
    // seed-local.mjs mints 'cw-local-org'/'cw-local-user' verbatim), and
    // lightOneClickService.ts's own header explains exactly why that matters
    // — but these fixtures use real UUIDs anyway so this suite exercises the
    // COMMON case; the non-UUID case is exactly what makes
    // executionSpineService.createRun unusable here, which is covered by
    // reading this file's header rather than a dedicated negative test (this
    // packet does not own executionSpineService.ts to assert against it).
    const orgId = suffix;
    const projectId = `light1c-project-${label}-${suffix}`;
    const userId = randomUUID();
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [orgId, `LIGHT 1-click org (${label})`]);
    await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      projectId,
      orgId,
      `LIGHT 1-click project (${label})`,
    ]);
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [randomUUID(), orgId, userId]
    );
    return { orgId, projectId, userId };
  }

  async function teardown(caseId: string, orgId: string, projectId: string, userId: string): Promise<void> {
    await control.query(`DELETE FROM case_workspace_node_run_attempts WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_node_runs WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_run_bindings WHERE case_id = $1`, [caseId]).catch(() => undefined);
    const runs = await control
      .query<{ run_id: string; context_snapshot_id: string }>(
        `SELECT run_id, context_snapshot_id FROM v8_execution_runs WHERE metadata::text LIKE $1`,
        [`%${caseId}%`]
      )
      .catch(() => ({ rows: [] as { run_id: string; context_snapshot_id: string }[] }));
    for (const run of runs.rows) {
      await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [run.run_id]).catch(() => undefined);
      await control
        .query(`DELETE FROM v8_context_snapshots WHERE snapshot_id = $1`, [run.context_snapshot_id])
        .catch(() => undefined);
    }
    await control.query(`DELETE FROM case_plan_versions WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_event_outbox WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_core WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]).catch(() => undefined);
    await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }

  async function countRunBindings(caseId: string): Promise<number> {
    const r = await control.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM case_workspace_run_bindings WHERE case_id = $1`,
      [caseId]
    );
    return r.rows[0]?.c ?? 0;
  }

  async function countNodeRuns(caseId: string): Promise<number> {
    const r = await control.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM case_workspace_node_runs WHERE case_id = $1`,
      [caseId]
    );
    return r.rows[0]?.c ?? 0;
  }

  async function countCompletedEvents(caseId: string): Promise<number> {
    const r = await control.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM case_workspace_event_outbox
        WHERE case_id = $1 AND event_type = 'case.light_one_click.started'`,
      [caseId]
    );
    return r.rows[0]?.c ?? 0;
  }

  async function countPlanVersions(caseId: string): Promise<number> {
    const r = await control.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM case_plan_versions WHERE case_id = $1`,
      [caseId]
    );
    return r.rows[0]?.c ?? 0;
  }

  // -------------------------------------------------------------------------
  // 1. HAPPY PATH — "LIGHT zaakceptowane i uruchomione"
  // -------------------------------------------------------------------------
  it('LIGHT case: one call publishes a real Plan, binds exactly one Run and creates its NodeRun', async () => {
    const { orgId, projectId, userId } = await seedFixture('happy');
    let caseId = '';
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'LIGHT',
        createdByActorId: userId,
      });
      caseId = created.caseId;
      expect(created.caseStatus).toBe('DRAFT');

      const result = await lightSvc.startLightOneClick({ caseId, actorUserId: userId });

      expect(result.outcome).toBe('started');
      if (result.outcome !== 'started') throw new Error('unreachable');
      expect(result.alreadyStarted).toBe(false);
      expect(result.case.caseStatus).toBe('ACTIVE');
      expect(result.planVersion.status).toBe('PUBLISHED');
      expect(result.planVersion.graphDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(result.runId).toBeTruthy();
      expect(result.nodeRunIds).toHaveLength(1);

      // READBACK — Postgres, out of band, not the return value.
      const caseRow = await control.query<{ case_status: string; case_profile: string }>(
        `SELECT case_status, case_profile FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]).toMatchObject({ case_status: 'ACTIVE', case_profile: 'LIGHT' });

      const planRow = await control.query<{ status: string }>(
        `SELECT status FROM case_plan_versions WHERE case_plan_version_id = $1`,
        [result.casePlanVersionId]
      );
      expect(planRow.rows[0]?.status).toBe('PUBLISHED');

      const bindingRow = await control.query<{ run_id: string; case_plan_version_id: string }>(
        `SELECT run_id, case_plan_version_id FROM case_workspace_run_bindings WHERE case_id = $1`,
        [caseId]
      );
      expect(bindingRow.rowCount).toBe(1);
      expect(bindingRow.rows[0]).toMatchObject({
        run_id: result.runId,
        case_plan_version_id: result.casePlanVersionId,
      });

      const runRow = await control.query<{ organization_id: string }>(
        `SELECT organization_id FROM v8_execution_runs WHERE run_id = $1`,
        [result.runId]
      );
      expect(runRow.rows[0]?.organization_id).toBe(orgId);

      expect(await countNodeRuns(caseId)).toBe(1);
      expect(await countRunBindings(caseId)).toBe(1);
      expect(await countCompletedEvents(caseId)).toBe(1);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 2. DOUBLE-CLICK / RETRY-AFTER-LOST-RESPONSE / "REFRESH" / "RESTART"
  //    — all collapse to: a SECOND, independent call for the same caseId
  //    (whatever triggered it client-side) must read back the SAME result
  //    and create NOTHING new.
  // -------------------------------------------------------------------------
  it('double-click / retry / refresh: a second call returns already_started with the SAME Run, zero new rows', async () => {
    const { orgId, projectId, userId } = await seedFixture('doubleclick');
    let caseId = '';
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'LIGHT',
        createdByActorId: userId,
      });
      caseId = created.caseId;

      const first = await lightSvc.startLightOneClick({ caseId, actorUserId: userId });
      expect(first.outcome).toBe('started');

      // "restart": a completely independent call, as a fresh page load would
      // make, reading nothing from the first call's in-memory result.
      const second = await lightSvc.startLightOneClick({ caseId, actorUserId: userId });
      expect(second.outcome).toBe('already_started');
      expect(second.runId).toBe((first as { runId: string }).runId);
      expect(second.casePlanVersionId).toBe((first as { casePlanVersionId: string }).casePlanVersionId);

      // "refresh": an independent read confirms the SAME state a fresh page
      // load would show — CW-RT-064, API/service and DB readback agree.
      const fresh = await caseCoreService.getCase({ caseId }, userId);
      expect(fresh?.caseStatus).toBe('ACTIVE');

      expect(await countRunBindings(caseId)).toBe(1);
      expect(await countNodeRuns(caseId)).toBe(1);
      expect(await countCompletedEvents(caseId)).toBe(1);
      expect(await countPlanVersions(caseId)).toBe(1);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 3. CONCURRENT CONFIRMATION — two calls fired with NO prior completed
  //    attempt, at the same time. The advisory-lock mutex (see the service's
  //    own header) must serialize them without hanging.
  // -------------------------------------------------------------------------
  it('concurrent confirmation: two simultaneous calls converge on exactly one Run, never hang, never race', async () => {
    const { orgId, projectId, userId } = await seedFixture('concurrent');
    let caseId = '';
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'LIGHT',
        createdByActorId: userId,
      });
      caseId = created.caseId;

      const [a, b] = await Promise.all([
        lightSvc.startLightOneClick({ caseId, actorUserId: userId }),
        lightSvc.startLightOneClick({ caseId, actorUserId: userId }),
      ]);

      // Exactly one 'started' and one 'already_started' — OR (a narrower race
      // window than the mutex is meant to allow, but still safe) both
      // reporting 'started' with the identical runId, never two different runs.
      const outcomes = [a.outcome, b.outcome].sort();
      const bothStartedSameRun =
        a.outcome === 'started' && b.outcome === 'started' && a.runId === b.runId;
      const oneEach = outcomes[0] === 'already_started' && outcomes[1] === 'started';
      expect(oneEach || bothStartedSameRun).toBe(true);
      expect((a as { runId: string }).runId).toBe((b as { runId: string }).runId);

      // DOKLADNIE JEDEN Run — the hard invariant, read from Postgres.
      expect(await countRunBindings(caseId)).toBe(1);
      expect(await countNodeRuns(caseId)).toBe(1);
      expect(await countCompletedEvents(caseId)).toBe(1);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 4. STANDARD/TRANSFORMATION — this command does not apply to them, and
  //    they stay at ZERO Run, exactly as before the call.
  // -------------------------------------------------------------------------
  it.each(['STANDARD', 'TRANSFORMATION'] as const)(
    '%s case: refused before touching Plan or Run — zero Run, zero Plan, unchanged status',
    async (profile) => {
      const { orgId, projectId, userId } = await seedFixture(`profile-${profile.toLowerCase()}`);
      let caseId = '';
      try {
        const created = await caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          caseProfile: profile,
          createdByActorId: userId,
        });
        caseId = created.caseId;

        await expect(lightSvc.startLightOneClick({ caseId, actorUserId: userId })).rejects.toThrow(
          'light_one_click_requires_light_profile'
        );

        const caseRow = await control.query<{ case_status: string }>(
          `SELECT case_status FROM case_core WHERE case_id = $1`,
          [caseId]
        );
        expect(caseRow.rows[0]?.case_status).toBe('DRAFT');
        expect(await countPlanVersions(caseId)).toBe(0);
        expect(await countRunBindings(caseId)).toBe(0);
      } finally {
        await teardown(caseId, orgId, projectId, userId);
      }
    },
    60_000
  );

  // -------------------------------------------------------------------------
  // 5. Case not in a startable status (BLOCKED) — refused, thrown, honest code.
  // -------------------------------------------------------------------------
  it('BLOCKED case: refused with an honest reason, zero Run created', async () => {
    const { orgId, projectId, userId } = await seedFixture('blocked');
    let caseId = '';
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'LIGHT',
        createdByActorId: userId,
      });
      caseId = created.caseId;
      await caseCoreService.transitionStatus(caseId, 'ACTIVE', { actorUserId: userId });
      await caseCoreService.transitionStatus(caseId, 'BLOCKED', { actorUserId: userId }, 'test block');

      await expect(lightSvc.startLightOneClick({ caseId, actorUserId: userId })).rejects.toThrow(
        'light_one_click_case_not_ready'
      );

      expect(await countRunBindings(caseId)).toBe(0);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 6. SAFE-START GATE — "LIGHT utworzone bez Run z uczciwym powodem" /
  //    "rollback": a plan that cannot validate is refused, not force-started,
  //    and leaves ZERO Run/NodeRun behind.
  // -------------------------------------------------------------------------
  it('refuses with the exact validation reason when the LIGHT plan cannot validate — zero Run either way', async () => {
    const { orgId, projectId, userId } = await seedFixture('refused');
    let caseId = '';
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'LIGHT',
        createdByActorId: userId,
      });
      caseId = created.caseId;

      // Seed an INVALID draft under the exact marker changeReason this
      // service resumes by — simulates a prior attempt (or an operator) that
      // left a broken LIGHT draft behind. `terminalNodeIds` names a node
      // that does not exist, which computeValidationBlockers flags as
      // NO_TERMINAL_PATH (BLOCKING).
      await planSvc.createPlanDraft({
        caseId,
        changeReason: 'case-workspace:light-one-click:v1',
        createdByActorId: userId,
        semanticGraph: {
          schemaVersion: '1',
          entryNodeIds: ['a'],
          terminalNodeIds: ['b'],
          nodes: [{ nodeId: 'a', type: 'CAPABILITY' }],
          edges: [],
          variables: [],
        },
      });

      const result = await lightSvc.startLightOneClick({ caseId, actorUserId: userId });

      expect(result.outcome).toBe('refused');
      if (result.outcome !== 'refused') throw new Error('unreachable');
      expect(result.reasonCode).toBe('light_one_click_plan_validation_failed');
      expect(result.reasonDetail).toContain('NO_TERMINAL_PATH');
      expect(result.blockers.some((b) => b.code === 'NO_TERMINAL_PATH')).toBe(true);
      expect(result.blockers.every((b) => b.severity === 'BLOCKING')).toBe(true);

      // "rollback": nothing downstream of the refused plan exists.
      expect(await countRunBindings(caseId)).toBe(0);
      expect(await countNodeRuns(caseId)).toBe(0);
      expect(await countCompletedEvents(caseId)).toBe(0);

      // Retrying after fixing nothing refuses again, identically — not a
      // crash, not a different answer, and STILL creates no Run.
      const retry = await lightSvc.startLightOneClick({ caseId, actorUserId: userId });
      expect(retry.outcome).toBe('refused');
      expect(await countRunBindings(caseId)).toBe(0);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 7. Unknown / inaccessible Case — fails closed, enumeration-safe.
  // -------------------------------------------------------------------------
  it('unknown caseId: fails closed via requireCaseAccess, never a fabricated result', async () => {
    const { orgId, projectId, userId } = await seedFixture('unknown');
    try {
      await expect(
        lightSvc.startLightOneClick({ caseId: `case-${randomUUID()}`, actorUserId: userId })
      ).rejects.toBeInstanceOf(Error);
    } finally {
      await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  }, 30_000);
});
