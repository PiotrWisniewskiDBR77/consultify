/**
 * ROI-E004 — Actual entry append-only chain (AC-02/AC-06), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D10.
 *
 * ==========================================================================
 * THE D10 PROOF — self-verification walk-back through a correction chain
 * ==========================================================================
 * Recorder A creates an entry. Someone else, B, corrects it. A then attempts
 * to verify B's correction. This MUST still be denied — A is still the
 * chain's original recorder, even though the row A is trying to verify was
 * never directly written BY A. `verifyActualEntry` must walk
 * `correction_of_actual_entry_id` all the way back to the root row (not just
 * check the immediately-prior row's `recorded_by`) to catch this. A third
 * party, C, who is neither A nor B, is then proven ABLE to verify the same
 * correction — proving the denial is specific to the chain's original
 * recorder, not a blanket "nobody but a stranger may verify" rule.
 *
 * Also proves: the full record -> correct -> verify -> dispute chain;
 * `RoiActualEntryNotFoundError` for a bogus id; raw `UPDATE`/`DELETE`
 * genuinely revoked from PUBLIC at the schema level (via
 * `has_table_privilege`, which is deterministic regardless of which role the
 * TEST's own connection happens to use — see the migration's own documented
 * "does not stop an owner/superuser connection" caveat); dispute never
 * changes the recorded value (AC-06).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureRoiFixtureOrganization } from './roiRealdbOrgFixture.js';

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
const ORG_ID = `roi-e004-actual-org-${tag}`;
const USER_MAKER = `roi-e004-actual-maker-${tag}`;
const USER_APPROVER = `roi-e004-actual-approver-${tag}`;
const USER_A = `roi-e004-actual-recorder-a-${tag}`;
const USER_B = `roi-e004-actual-corrector-b-${tag}`;
const USER_C = `roi-e004-actual-verifier-c-${tag}`;
const USER_D = `roi-e004-actual-disputer-d-${tag}`;
const INITIATIVE_ID = `roi-e004-actual-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ActualEntryCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let startRoiCaseTracking: TrackingCommandsModule['startRoiCaseTracking'];
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let correctActualEntry: ActualEntryCommandsModule['correctActualEntry'];
let verifyActualEntry: ActualEntryCommandsModule['verifyActualEntry'];
let disputeActualEntry: ActualEntryCommandsModule['disputeActualEntry'];
let RoiActualEntryNotFoundError: ActualEntryCommandsModule['RoiActualEntryNotFoundError'];
let RoiActualSelfVerificationDeniedError: ActualEntryCommandsModule['RoiActualSelfVerificationDeniedError'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

interface TrackingCaseFixture {
  caseId: string;
  costLineId: string;
}

async function buildTrackingCase(suffix: string): Promise<TrackingCaseFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Actual-entry fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Actual-entry fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

  const startOutcome = await startModeling({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: createOutcome.result.case.rowVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `start-${randomUUID()}`,
  });

  await captureOrUpdateBaseline({
    organizationId: ORG_ID,
    caseId,
    expectedVersion: createOutcome.result.baseline.rowVersion,
    currentMeasuredValue: 100,
    baselinePeriodStart: '2026-01-01',
    baselinePeriodEnd: '2026-01-31',
    actorId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `baseline-${randomUUID()}`,
  });

  const costLineOutcome = await addCostLine({
    caseId,
    organizationId: ORG_ID,
    category: 'implementation',
    label: 'Setup',
    amount: 1000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-01-15',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `cost-${randomUUID()}`,
  });
  await addBenefitLine({
    caseId,
    organizationId: ORG_ID,
    category: 'revenue',
    label: 'New revenue',
    isFinancial: true,
    amount: 2000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-15',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `benefit-${randomUUID()}`,
  });

  await createRoiCalculationRun({
    organizationId: ORG_ID,
    caseId,
    scenarioId: null,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `run-${randomUUID()}`,
  });

  const readyOutcome = await markReadyForReview({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: startOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `ready-${randomUUID()}`,
  });
  const submitOutcome = await submitRoiCaseForApproval({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: readyOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `submit-${randomUUID()}`,
  });
  const approveOutcome = await approveRoiCase({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: submitOutcome.resultingVersion,
    approverId: USER_APPROVER,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
  });
  await startRoiCaseTracking({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: approveOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `tracking-${randomUUID()}`,
  });

  return { caseId, costLineId: costLineOutcome.result.costLineId };
}

describe('ROI-E004 Actual entry append-only chain (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 actual-entry realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_actual_entries LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiActualEntryAppendOnly realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL)`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E004 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;
    approveRoiCase = approvalCommands.approveRoiCase;
    const trackingCommands: TrackingCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js'
    );
    startRoiCaseTracking = trackingCommands.startRoiCaseTracking;
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    recordActualEntry = actualEntryCommands.recordActualEntry;
    correctActualEntry = actualEntryCommands.correctActualEntry;
    verifyActualEntry = actualEntryCommands.verifyActualEntry;
    disputeActualEntry = actualEntryCommands.disputeActualEntry;
    RoiActualEntryNotFoundError = actualEntryCommands.RoiActualEntryNotFoundError;
    RoiActualSelfVerificationDeniedError = actualEntryCommands.RoiActualSelfVerificationDeniedError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_variance_causes WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_variances WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_roi_cases SET original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
              decision_calculation_run_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
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
    await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
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
    'record -> correct -> verify -> dispute chain: each step inserts a NEW row referencing the prior one; dispute never changes the recorded value (AC-02/AC-06)',
    async () => {
      const fixture = await buildTrackingCase('1');

      const recordOutcome = await recordActualEntry({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        entryType: 'cost',
        costLineId: fixture.costLineId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        amount: 950,
        currency: 'USD',
        source: 'invoice-1042',
        recordedBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `record-${randomUUID()}`,
      });
      expect(recordOutcome.outcome).toBe('applied');
      const original = recordOutcome.result;
      expect(original.dataQualityStatus).toBe('unverified');
      expect(original.correctionOfActualEntryId).toBeNull();
      expect(original.recordedBy).toBe(USER_A);

      const correctOutcome = await correctActualEntry({
        actualEntryId: original.actualEntryId,
        organizationId: ORG_ID,
        amount: 1000,
        correctionReason: 'Invoice amount corrected after vendor reconciliation',
        recordedBy: USER_B,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `correct-${randomUUID()}`,
      });
      const corrected = correctOutcome.result.superseding;
      expect(corrected.actualEntryId).not.toBe(original.actualEntryId);
      expect(corrected.correctionOfActualEntryId).toBe(original.actualEntryId);
      expect(corrected.amount).toBe(1000);
      expect(corrected.recordedBy).toBe(USER_B);
      // Correction does not, by itself, change data-quality workflow state.
      expect(corrected.dataQualityStatus).toBe('unverified');

      // ---- THE D10 PROOF ----
      // A (the chain's ORIGINAL recorder) attempts to verify B's correction
      // — must still be denied, proving the walk-back reaches past the
      // immediately-prior row (B) to the root (A).
      await expect(
        verifyActualEntry({
          actualEntryId: corrected.actualEntryId,
          organizationId: ORG_ID,
          verifierId: USER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `verify-denied-${randomUUID()}`,
        })
      ).rejects.toThrow(RoiActualSelfVerificationDeniedError);

      // No row was inserted by the denied attempt — chain is still exactly
      // 2 rows deep.
      const chainAfterDenial = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM rvn_roi_actual_entries WHERE case_id = $1`,
        [fixture.caseId]
      );
      expect(chainAfterDenial.rows[0]!.count).toBe('2');

      // C — neither the original recorder (A) nor the corrector (B) — CAN
      // verify the same correction, proving the denial is specific to the
      // original recorder, not a blanket rule.
      const verifyOutcome = await verifyActualEntry({
        actualEntryId: corrected.actualEntryId,
        organizationId: ORG_ID,
        verifierId: USER_C,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `verify-ok-${randomUUID()}`,
        notes: 'Confirmed against vendor statement',
      });
      const verified = verifyOutcome.result.superseding;
      expect(verified.correctionOfActualEntryId).toBe(corrected.actualEntryId);
      expect(verified.dataQualityStatus).toBe('verified');
      expect(verified.verifiedBy).toBe(USER_C);
      expect(verified.verifiedAt).not.toBeNull();
      expect(verified.amount).toBe(1000); // unchanged from the row it verifies

      // ---- dispute (AC-06: value never changes; no self-check) ----
      const disputeOutcome = await disputeActualEntry({
        actualEntryId: verified.actualEntryId,
        organizationId: ORG_ID,
        disputedBy: USER_D,
        disputeReason: 'Vendor now claims a different total',
        actorEffectiveRole: 'consultant',
        idempotencyKey: `dispute-${randomUUID()}`,
      });
      const disputed = disputeOutcome.result.superseding;
      expect(disputed.correctionOfActualEntryId).toBe(verified.actualEntryId);
      expect(disputed.dataQualityStatus).toBe('disputed');
      // AC-06: dispute never silently changes the recorded value.
      expect(disputed.amount).toBe(1000);
      expect(disputed.currency).toBe('USD');
      // A disputed row is not, by definition, a verified one.
      expect(disputed.verifiedBy).toBeNull();
      expect(disputed.verifiedAt).toBeNull();

      // Full chain: 4 rows, each referencing the prior one.
      const fullChain = await client.query<{ actual_entry_id: string; correction_of_actual_entry_id: string | null }>(
        `SELECT actual_entry_id, correction_of_actual_entry_id FROM rvn_roi_actual_entries
          WHERE case_id = $1 ORDER BY recorded_at`,
        [fixture.caseId]
      );
      expect(fullChain.rows).toHaveLength(4);
      expect(fullChain.rows.map((r) => r.actual_entry_id)).toEqual([
        original.actualEntryId,
        corrected.actualEntryId,
        verified.actualEntryId,
        disputed.actualEntryId,
      ]);
    }
  );

  itDB('correcting/verifying/disputing a nonexistent actual_entry_id throws RoiActualEntryNotFoundError', async () => {
    await expect(
      correctActualEntry({
        actualEntryId: randomUUID(),
        organizationId: ORG_ID,
        amount: 1,
        correctionReason: 'n/a',
        recordedBy: USER_B,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `correct-missing-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiActualEntryNotFoundError);

    await expect(
      verifyActualEntry({
        actualEntryId: randomUUID(),
        organizationId: ORG_ID,
        verifierId: USER_C,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `verify-missing-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiActualEntryNotFoundError);
  });

  itDB('raw UPDATE/DELETE on rvn_roi_actual_entries is genuinely revoked from PUBLIC at the schema level', async () => {
    // has_table_privilege('PUBLIC', ...) is NOT a valid call — 'PUBLIC' is a
    // reserved keyword in GRANT/REVOKE, not a queryable role name (Postgres
    // raises 42704 "role PUBLIC does not exist"). More importantly, this
    // test's own connection is a superuser/owner — has_table_privilege for
    // that role would return true regardless of any REVOKE (superuser
    // bypasses ACL checks entirely), exactly the bypass the migration's own
    // header comment documents. The only way to prove the REVOKE's real
    // effect deterministically is to act as a genuinely unprivileged role: a
    // fresh role with no explicit grant of its own inherits ONLY whatever
    // PUBLIC has, so if UPDATE/DELETE are truly revoked from PUBLIC, this
    // role's own attempt fails with 42501 (insufficient_privilege).
    const lowPrivRole = `roi_e004_lowpriv_${randomUUID().replace(/-/g, '_')}`;
    await client.query(`CREATE ROLE ${lowPrivRole} NOLOGIN`);
    try {
      await client.query(`SET ROLE ${lowPrivRole}`);
      try {
        await expect(
          client.query(`UPDATE rvn_roi_actual_entries SET amount = 1 WHERE actual_entry_id = gen_random_uuid()`)
        ).rejects.toThrow(/permission denied/i);
        await expect(
          client.query(`DELETE FROM rvn_roi_actual_entries WHERE actual_entry_id = gen_random_uuid()`)
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await client.query('RESET ROLE');
      }
    } finally {
      await client.query(`DROP ROLE ${lowPrivRole}`);
    }
  });
});
