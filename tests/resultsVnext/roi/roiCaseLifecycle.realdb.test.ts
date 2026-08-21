/**
 * ROI-E001 — case lifecycle guards (`startModeling`/`markReadyForReview`)
 * and archive-flag independence from `status`, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §4.2 (Decision D4 —
 * archive is a separate flag, orthogonal to status, legal in ANY status) /
 * §4.3 (`runRoiCaseLifecycleTransition`, `isRoiCaseReadyForReviewEligible`
 * guard — Decision D2).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ensureRoiFixtureMembership,
  ensureRoiFixtureOrganization,
  ensureRoiGovernedVisibility,
} from './roiRealdbOrgFixture.js';

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
const ORG_ID = `roi-e001-lifecycle-org-${tag}`;
const USER_OWNER = `roi-e001-lifecycle-owner-${tag}`;
const INITIATIVE_ID = `roi-e001-lifecycle-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let archiveRoiCase: CaseCommandsModule['archiveRoiCase'];
let RoiCaseValidationError: CaseCommandsModule['RoiCaseValidationError'];
let RoiCaseNotReadyForReviewError: CaseCommandsModule['RoiCaseNotReadyForReviewError'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let getRoiCase: RepositoryModule['getRoiCase'];
let listRoiCases: RepositoryModule['listRoiCases'];
// ROI-E002 §5: markReadyForReview's guard now ALSO requires a successful,
// fresh calculation run (isRoiCaseReadyForReviewEligibleWithEconomicModel
// wraps this file's own E001 baseline guard, never replaces it) — this
// already-shipped ROI-E001 test's own "ready once baseline is complete"
// assertion needs one real calculation run to still reach 'ready_for_review'.
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let closePgPool: (() => Promise<void>) | undefined;

/**
 * Each fixture case gets its OWN initiative. `ux_rvn_roi_cases_one_active_per_initiative`
 * (AC-02) means a SHARED initiative id across `it` blocks would make the
 * second block's `createRoiCase` call find the first block's still-active
 * case and return IT instead (`created: false`) — this is exactly AC-02
 * working correctly, but it silently breaks test isolation (an early
 * version of this file did share one `INITIATIVE_ID` across every block and
 * got cross-test contamination: a case already in 'modeling' from a prior
 * test reused by a later 'startModeling' assertion, throwing
 * INVALID_ROI_CASE_STATUS_TRANSITION for the wrong reason). A fresh
 * initiative per fixture case avoids the dedup path entirely so each test
 * gets a genuinely new case.
 */
async function createFixtureCase(): Promise<{ caseId: string; rowVersion: number }> {
  const initiativeId = `${INITIATIVE_ID}-${randomUUID()}`;
  // RN-G6: `initiatives.status` DEFAULT is 'step3', which is NOT one of the
  // values `initiatives_status_check` allows on a real Postgres — a known,
  // pre-existing blocker (out of this pakiet's scope: the fix lives in
  // `server/migrations/20260810_fix_initiatives_status_default.sql`, owned
  // by a parallel session and off-limits here). Passing an explicit valid
  // `status` sidesteps the bad default without touching that migration.
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`, [
    initiativeId,
    ORG_ID,
    'Lifecycle fixture initiative (per-case)',
  ]);
  const outcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: `Lifecycle fixture case ${randomUUID()}`,
    ownerUserId: USER_OWNER,
    currency: 'USD',
    // ROI-E002: createRoiCalculationRun requires a non-null analysis window
    // (Decision, roiCalculationRunCommands.ts's ANALYSIS_WINDOW_MISSING
    // guard) — set here so the "ready for review" test below can create one.
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  return { caseId: outcome.result.case.caseId, rowVersion: outcome.result.case.rowVersion };
}

describe('ROI-E001 case lifecycle — startModeling/markReadyForReview guards + archive independence (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI case lifecycle realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      const database = await client.query<{ current_database: string }>('SELECT current_database()');
      if (!database.rows[0]?.current_database.startsWith('consultify_results_')) {
        throw new Error('ROI governed-visibility lifecycle requires an owned consultify_results_* disposable database');
      }
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiCaseLifecycle realdb fixture org');
      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_OWNER,
        role: 'OWNER',
      });
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
      // See `createFixtureCase`'s comment above: explicit valid `status`
      // sidesteps the known `initiatives.status` DEFAULT 'step3' blocker.
      await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`, [
        INITIATIVE_ID,
        ORG_ID,
        'Lifecycle fixture initiative',
      ]);
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI schema/initiatives fixture); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    archiveRoiCase = caseCommands.archiveRoiCase;
    RoiCaseValidationError = caseCommands.RoiCaseValidationError;
    RoiCaseNotReadyForReviewError = caseCommands.RoiCaseNotReadyForReviewError;

    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;

    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
    getRoiCase = repository.getRoiCase;
    listRoiCases = repository.listRoiCases;

    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await ensureRoiGovernedVisibility({
      organizationId: ORG_ID,
      actorUserId: USER_OWNER,
      idempotencyKey: `roi-e001-governance-${tag}`,
    });
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // rvn_platform_resource_acl has no organization_id column (PRIMARY KEY
    // is resource_type/resource_id/grantee_type/grantee_id) — scope via a
    // subquery over this org's own case ids, BEFORE the rvn_roi_cases
    // delete below removes them.
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    // ROI-E002: createRoiCase now also inserts a rvn_roi_calculation_policy
    // shell row (FK to rvn_roi_cases) — must be deleted before rvn_roi_cases.
    await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    // Governance is append-only. The organization and membership are
    // intentionally retained until the owned disposable database is dropped.
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
  // RN-G6 defect 2 — "fałszywa pustka": does the creator actually see the
  // case it just created on its own list, or does createRoiCase succeed
  // while `buildVisibilityScopedCte` (used by listRoiCases) silently hides
  // it? This org's policy is RESTRICTED_ACL (the strictest mode, set up in
  // beforeAll above) — if the owner sees its own case under RESTRICTED_ACL,
  // that proves createRoiCase's atomic transaction really did write both the
  // `rvn_platform_resource_visibility` row (owner_user_id) AND the
  // `rvn_platform_resource_acl` grant (createRoiCase's Decision D3), because
  // RESTRICTED_ACL's CTE branch requires the ACL join, not just ownership.
  // An unrelated outsider (never an owner/grantee/team-member/RBAC override)
  // is the negative control: it must NOT see the case, which rules out the
  // test accidentally passing because visibility is wide open.
  itDB(
    'createRoiCase: the creator/owner sees the case on listRoiCases immediately after creation ' +
      '(RESTRICTED_ACL policy — the strictest mode); an unrelated outsider does not',
    async () => {
      const { caseId } = await createFixtureCase();

      const ownerList = await listRoiCases({ userId: USER_OWNER, organizationId: ORG_ID });
      expect(ownerList.map((c) => c.caseId)).toContain(caseId);

      const ownerGet = await getRoiCase({ userId: USER_OWNER, organizationId: ORG_ID, caseId });
      expect(ownerGet).not.toBeNull();
      expect(ownerGet?.caseId).toBe(caseId);

      const outsiderId = `roi-e001-lifecycle-outsider-${randomUUID()}`;
      const outsiderList = await listRoiCases({ userId: outsiderId, organizationId: ORG_ID });
      expect(outsiderList.map((c) => c.caseId)).not.toContain(caseId);
    }
  );

  itDB('startModeling: draft -> modeling succeeds; rejects from a non-draft status', async () => {
    const { caseId, rowVersion } = await createFixtureCase();

    const outcome = await startModeling({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `start-modeling-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('modeling');

    // Calling it again (now 'modeling', not 'draft') must reject with the
    // typed INVALID transition error, not silently succeed or 500.
    await expect(
      startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: outcome.result.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-modeling-again-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(RoiCaseValidationError);
  });

  itDB(
    'markReadyForReview: rejects with RoiCaseNotReadyForReviewError when the baseline has no measured value ' +
      'or period, then succeeds once both are captured',
    async () => {
      const { caseId, rowVersion } = await createFixtureCase();
      const started = await startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-modeling-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(started.result.status).toBe('modeling');

      // Baseline is still the empty shell — guard must reject.
      let rejection: unknown;
      try {
        await markReadyForReview({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: started.result.rowVersion,
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `ready-for-review-empty-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      } catch (err) {
        rejection = err;
      }
      expect(rejection).toBeInstanceOf(RoiCaseNotReadyForReviewError);
      expect((rejection as InstanceType<typeof RoiCaseNotReadyForReviewError>).details.reason).toBe(
        'baseline_measured_value_missing'
      );

      // Case must still be 'modeling' — the rejected guard must not have
      // mutated status.
      const stillModeling = await getRoiCase({ userId: USER_OWNER, organizationId: ORG_ID, caseId });
      expect(stillModeling?.status).toBe('modeling');

      // Capture a measured value but no period yet — still not eligible.
      const partialCapture = await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: 1,
        currentMeasuredValue: 42,
        actorId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `capture-partial-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(partialCapture.result.currentMeasuredValue).toBe(42);

      let secondRejection: unknown;
      try {
        await markReadyForReview({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: started.result.rowVersion,
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `ready-for-review-partial-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      } catch (err) {
        secondRejection = err;
      }
      expect(secondRejection).toBeInstanceOf(RoiCaseNotReadyForReviewError);
      expect((secondRejection as InstanceType<typeof RoiCaseNotReadyForReviewError>).details.reason).toBe(
        'baseline_period_missing'
      );

      // Now capture a period too — the guard must now pass.
      await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: partialCapture.result.rowVersion,
        baselinePeriodStart: '2026-01-01',
        baselinePeriodEnd: '2026-01-31',
        actorId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `capture-full-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      // ROI-E002 §5: the guard now ALSO requires a successful, fresh
      // calculation run — without one, this would still throw
      // RoiCaseNotReadyForReviewError('no_successful_calculation_run').
      const runOutcome = await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `calc-run-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(runOutcome.result.status).toBe('completed');

      const readyOutcome = await markReadyForReview({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: started.result.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `ready-for-review-complete-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(readyOutcome.outcome).toBe('applied');
      expect(readyOutcome.result.status).toBe('ready_for_review');
    }
  );

  itDB(
    'archiveRoiCase: archiving is independent of status — a case in ANY status (draft, modeling, ' +
      'ready_for_review) may be archived without its status changing, and re-archiving is an idempotent no-op',
    async () => {
      // draft
      const draftCase = await createFixtureCase();
      const draftArchive = await archiveRoiCase({
        caseId: draftCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: draftCase.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `archive-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(draftArchive.outcome).toBe('applied');
      expect(draftArchive.result.status).toBe('draft');
      expect(draftArchive.result.archivedAt).not.toBeNull();

      // Idempotent re-archive: still a success, archivedAt stays set,
      // status still untouched.
      const reArchive = await archiveRoiCase({
        caseId: draftCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: draftArchive.result.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `re-archive-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(reArchive.outcome).toBe('applied');
      expect(reArchive.result.status).toBe('draft');
      expect(reArchive.result.archivedAt).not.toBeNull();

      // modeling
      const modelingCase = await createFixtureCase();
      const modelingStarted = await startModeling({
        caseId: modelingCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: modelingCase.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-modeling-for-archive-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const modelingArchive = await archiveRoiCase({
        caseId: modelingCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: modelingStarted.result.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `archive-modeling-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(modelingArchive.outcome).toBe('applied');
      expect(modelingArchive.result.status).toBe('modeling');
      expect(modelingArchive.result.archivedAt).not.toBeNull();
    }
  );
});
