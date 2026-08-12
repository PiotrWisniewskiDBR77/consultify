/**
 * Acceptance E2E — RN-G4, points 1+2 of the FALA 3 cross-domain evidence
 * brief (docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md):
 *
 * 1. A ROI Benefit's evidentiary link to a KPI is OPTIONAL — a Benefit line
 *    with NO KPI evidence link does not block the case's real lifecycle
 *    (create -> ... -> approve), and a Benefit line WITH a link resolves
 *    real KPI details through the same read path.
 * 2. Linking to Finance and reconciling a divergence do NOT create a second
 *    source of truth for ROI: the ROI domain's own immutable source tables
 *    (approval snapshot, forecast versions, actual snapshots) plus the
 *    benefit-evidence-link/cost-line/benefit-line rows are hash+count
 *    identical before and after a `finance_projection` dispatch tick that
 *    both projects a value AND opens a reconciliation. This reuses the
 *    hash+count technique already established in EXECUTION_LEDGER.md §53
 *    (`rvn-cross-domain-gold-flow.e2e.test.ts` Step 6), applied here to a
 *    WIDER set of ROI source tables (adds benefit-evidence-link/cost-line/
 *    benefit-line, which §53 did not snapshot).
 *
 * Harness precedent (verbatim conventions): `rvn-cross-domain-gold-flow
 * .e2e.test.ts` — real local Postgres via `requireLocalDbUrl()`, raw
 * `pg.Client`, marker-prefixed fixtures, hard DB-state assertions,
 * `afterAll` cleanup.
 *
 * KNOWN OBSTACLE (task brief, do not fix): `initiatives.status` DEFAULT
 * `'step3'` violates the table's own CHECK constraint
 * (`initiatives_status_check`, real values are UPPER_SNAKE like `'DRAFT'`).
 * Every `initiatives` INSERT below sets `status='DRAFT'` explicitly, per
 * the task brief's documented workaround — this file does not touch
 * `20260810_fix_initiatives_status_default.sql` or any other file on the
 * "do not touch" list.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g4--roi-kpi-finance-truth--${tag}`;
const ORG_ID = `${MARKER}--org`;
const OWNER = `${MARKER}--owner`;
const APPROVER = `${MARKER}--approver`;

type CaseCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ActualEntryCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualSnapshotCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type FinanceLinkCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
type FinanceLinkRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js');
type FinanceProjectionRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.js');
type BenefitEvidenceLinkCommandsModule =
  typeof import('../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js');
type EconomicModelRepositoryModule =
  typeof import('../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
type PlatformCronModule = typeof import('../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js');

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
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let createRoiFinanceLink: FinanceLinkCommandsModule['createRoiFinanceLink'];
let listRoiFinanceReconciliations: FinanceLinkRepositoryModule['listRoiFinanceReconciliations'];
let listRoiFinanceProjections: FinanceProjectionRepositoryModule['listRoiFinanceProjections'];
let addBenefitEvidenceLink: BenefitEvidenceLinkCommandsModule['addBenefitEvidenceLink'];
let listBenefitEvidenceLinks: EconomicModelRepositoryModule['listBenefitEvidenceLinks'];
let runOutboxDispatchTick: PlatformCronModule['runOutboxDispatchTick'];

async function insertOrgAndUser(orgId: string, userId: string, email: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, `RN-G4 fixture org ${orgId}`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG4', 'Fixture', now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, email]
    );
  } finally {
    await client.end();
  }
}

async function insertVisibilityPolicy(orgId: string, domain: string, mode: string, createdBy: string): Promise<string> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query<{ policy_id: string }>(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, $2, 1, $3, true, $4)
       RETURNING policy_id`,
      [orgId, domain, mode, createdBy]
    );
    return result.rows[0]!.policy_id;
  } finally {
    await client.end();
  }
}

async function insertFixtureKpi(
  orgId: string,
  ownerUserId: string,
  kpiId: string,
  versionId: string,
  kpiPolicyId: string
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
       VALUES ($1, $2, $3, 'active', $4, $4)`,
      [kpiId, orgId, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
          target_min, approval_status, created_by, effective_from)
       VALUES ($1, $2, $3, 1, 'RN-G4 fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
      [versionId, kpiId, orgId, ownerUserId]
    );
    await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
      versionId,
      kpiId,
    ]);
    // Per-resource visibility row — RN_G1_PLATFORM_DESIGN.md §B.3 step 1:
    // "brak wiersza -> DENY(NO_VISIBILITY_RECORD), fail-closed" — the domain
    // policy alone (rvn_platform_visibility_policies) is not enough, every
    // resource needs its own row here, same convention
    // scorecardPublishNonLeak.realdb.test.ts's `insertKpiVisibility` uses.
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
      [kpiId, orgId, kpiPolicyId, ownerUserId]
    );
  } finally {
    await client.end();
  }
}

async function hashCountTable(caseId: string, table: string): Promise<{ count: number; hash: string }> {
  const client = pgClient();
  await client.connect();
  try {
    const countRes = await client.query(`SELECT count(*)::int AS c FROM "${table}" WHERE case_id = $1`, [caseId]);
    const hashRes = await client.query(
      `SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${table}" t WHERE t.case_id = $1`,
      [caseId]
    );
    return { count: countRes.rows[0].c, hash: hashRes.rows[0].h };
  } finally {
    await client.end();
  }
}

const ROI_SOURCE_TABLES = [
  'rvn_roi_approval_snapshots',
  'rvn_roi_forecast_versions',
  'rvn_roi_actual_snapshots',
  'rvn_roi_benefit_evidence_links',
  'rvn_roi_cost_lines',
  'rvn_roi_benefit_lines',
];

describe('RN-G4 · Point 1+2 — ROI Benefit optional KPI evidence link + Finance projection creates no second source of truth', () => {
  let kpiId: string;
  let kpiVersionId: string;
  let caseId: string;
  let initiativeId: string;
  let linkedBenefitLineId: string;
  let unlinkedBenefitLineId: string;
  let costLineId: string;
  let financeLinkId: string;
  let approvalSnapshotId: string;
  let approvalSequenceNumber: number;
  let caseRowVersion: number;
  let evidenceLinkId: string;
  let kpiPolicyId: string;

  beforeAll(async () => {
    await insertOrgAndUser(ORG_ID, OWNER, `${OWNER}@acceptance.local`);
    await insertVisibilityPolicy(ORG_ID, 'roi', 'OPEN_ORG', OWNER);
    kpiPolicyId = await insertVisibilityPolicy(ORG_ID, 'kpi', 'OPEN_ORG', OWNER);

    const caseCommands: CaseCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    ({ createRoiCase, startModeling, markReadyForReview } = caseCommands);
    const baselineCommands: BaselineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    ({ captureOrUpdateBaseline } = baselineCommands);
    const costLineCommands: CostLineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCostLineCommands.js'
    );
    ({ addCostLine } = costLineCommands);
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    ({ addBenefitLine } = benefitLineCommands);
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    ({ createRoiCalculationRun } = calcRunCommands);
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    ({ submitRoiCaseForApproval, approveRoiCase } = approvalCommands);
    const trackingCommands: TrackingCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiTrackingCommands.js'
    );
    ({ startRoiCaseTracking } = trackingCommands);
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    ({ recordActualEntry } = actualEntryCommands);
    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    ({ publishRoiActualSnapshot } = actualSnapshotCommands);
    const financeLinkCommands: FinanceLinkCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js'
    );
    ({ createRoiFinanceLink } = financeLinkCommands);
    const financeLinkRepository: FinanceLinkRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js'
    );
    ({ listRoiFinanceReconciliations } = financeLinkRepository);
    const financeProjectionRepository: FinanceProjectionRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.js'
    );
    ({ listRoiFinanceProjections } = financeProjectionRepository);
    const evidenceLinkCommands: BenefitEvidenceLinkCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js'
    );
    ({ addBenefitEvidenceLink } = evidenceLinkCommands);
    const economicModelRepository: EconomicModelRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js'
    );
    ({ listBenefitEvidenceLinks } = economicModelRepository);
    const platformCron: PlatformCronModule = await import(
      '../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js'
    );
    ({ runOutboxDispatchTick } = platformCron);
  }, 30_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM rvn_roi_finance_projections WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL,
                original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
                decision_calculation_run_id = NULL
          WHERE organization_id = $1`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = $1
         )`,
        [ORG_ID]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    } finally {
      await client.end();
    }
  }, 60_000);

  it('Step 1 — a Benefit line WITH a KPI evidence link resolves real KPI details through the public read path', async () => {
    kpiId = randomUUID();
    kpiVersionId = randomUUID();
    await insertFixtureKpi(ORG_ID, OWNER, kpiId, kpiVersionId, kpiPolicyId);

    initiativeId = `${MARKER}--init`;
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`, [
        initiativeId,
        ORG_ID,
        'RN-G4 fixture initiative',
      ]);
    } finally {
      await client.end();
    }

    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'RN-G4 point1/2 ROI case',
      ownerUserId: OWNER,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-12-31',
      createdBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--create-${randomUUID()}`,
    });
    caseId = createOutcome.result.case.caseId;
    caseRowVersion = createOutcome.result.case.rowVersion;

    // Finance link created immediately (draft-only legal window, ROI-E006/
    // E007/E008 precedent already documented in EXECUTION_LEDGER.md §52/§53).
    const linkOutcome = await createRoiFinanceLink({
      caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'financial_roi_link',
      financeArtifactId: `${MARKER}-artifact`,
      financeVersionId: 'v1',
      source: 'finance_enterprise_service',
      asOf: '2026-01-01T00:00:00.000Z',
      currency: null,
      linkPurpose: 'cost_reference',
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--finlink-${randomUUID()}`,
    });
    financeLinkId = linkOutcome.result.linkId;
    const pinClient = pgClient();
    await pinClient.connect();
    try {
      await pinClient.query(
        `UPDATE rvn_roi_finance_links SET tracked_metric = 'totalCosts', pinned_finance_value = 1000 WHERE link_id = $1`,
        [financeLinkId]
      );
    } finally {
      await pinClient.end();
    }

    const startOutcome = await startModeling({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: caseRowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--start-${randomUUID()}`,
    });

    await captureOrUpdateBaseline({
      organizationId: ORG_ID,
      caseId,
      expectedVersion: createOutcome.result.baseline.rowVersion,
      currentMeasuredValue: 100,
      baselinePeriodStart: '2026-01-01',
      baselinePeriodEnd: '2026-01-31',
      actorId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--baseline-${randomUUID()}`,
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
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--cost-${randomUUID()}`,
    });
    costLineId = costLineOutcome.result.costLineId;

    // Benefit line #1 — WILL carry an evidence link (linked to the real KPI).
    const linkedBenefit = await addBenefitLine({
      caseId,
      organizationId: ORG_ID,
      category: 'revenue',
      label: 'New revenue (evidenced)',
      isFinancial: true,
      amount: 1500,
      currency: 'USD',
      timingType: 'one_time',
      oneTimePeriodDate: '2026-02-15',
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--benefit-linked-${randomUUID()}`,
    });
    linkedBenefitLineId = linkedBenefit.result.benefitLineId;

    // Benefit line #2 — will NEVER get an evidence link (proves optionality).
    const unlinkedBenefit = await addBenefitLine({
      caseId,
      organizationId: ORG_ID,
      category: 'cost_savings',
      label: 'Cost savings (no evidence link — deliberately)',
      isFinancial: true,
      amount: 500,
      currency: 'USD',
      timingType: 'one_time',
      oneTimePeriodDate: '2026-02-15',
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--benefit-unlinked-${randomUUID()}`,
    });
    unlinkedBenefitLineId = unlinkedBenefit.result.benefitLineId;

    const evidenceOutcome = await addBenefitEvidenceLink({
      benefitLineId: linkedBenefitLineId,
      caseId,
      organizationId: ORG_ID,
      kpiId,
      pinnedKpiDefinitionVersionId: kpiVersionId,
      purpose: 'primary_evidence',
      notes: 'RN-G4 point 1 fixture link',
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--evidence-${randomUUID()}`,
    });
    evidenceLinkId = evidenceOutcome.result.linkId;
    expect(evidenceOutcome.result.kpiId).toBe(kpiId);

    // Public read path, hydrated — real KPI details resolve for the linked benefit.
    const linkedRead = await listBenefitEvidenceLinks({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
      benefitLineId: linkedBenefitLineId,
      hydrateKpiDetails: true,
    });
    expect(linkedRead).toHaveLength(1);
    expect(linkedRead[0].linkId).toBe(evidenceLinkId);
    expect(linkedRead[0].kpiId).toBe(kpiId);
    expect(linkedRead[0].kpiDetails).not.toBeNull();
    expect(linkedRead[0].kpiDetails!.kpiId).toBe(kpiId);

    // Public read path for the UNLINKED benefit — zero links, no error.
    const unlinkedRead = await listBenefitEvidenceLinks({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
      benefitLineId: unlinkedBenefitLineId,
      hydrateKpiDetails: true,
    });
    expect(unlinkedRead).toEqual([]);

    void startOutcome;
  }, 30_000);

  it('Step 2 — the evidence link is OPTIONAL: the case proceeds through its real lifecycle to "approved" with one benefit line carrying zero evidence links', async () => {
    const client = pgClient();
    let versionAfterStart: number;
    await client.connect();
    try {
      const row = await client.query<{ row_version: number }>(`SELECT row_version FROM rvn_roi_cases WHERE case_id = $1`, [
        caseId,
      ]);
      versionAfterStart = row.rows[0]!.row_version;
    } finally {
      await client.end();
    }

    await createRoiCalculationRun({
      organizationId: ORG_ID,
      caseId,
      scenarioId: null,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--run-${randomUUID()}`,
    });

    const readyOutcome = await markReadyForReview({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: versionAfterStart,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--ready-${randomUUID()}`,
    });

    const submitOutcome = await submitRoiCaseForApproval({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: readyOutcome.resultingVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--submit-${randomUUID()}`,
    });

    const approveOutcome = await approveRoiCase({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: submitOutcome.resultingVersion,
      approverId: APPROVER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--approve-${randomUUID()}`,
    });
    expect(approveOutcome.result.case.status).toBe('approved');
    approvalSnapshotId = approveOutcome.result.snapshot.snapshotId;
    approvalSequenceNumber = approveOutcome.result.snapshot.sequenceNumber;
    caseRowVersion = approveOutcome.resultingVersion;

    // Cold reopen — re-read through the public path, no in-memory state
    // assumed: the unlinked benefit line STILL has zero evidence links, and
    // the case is STILL approved. Optionality did not silently get patched
    // over by the approval command.
    const unlinkedReadAfterApproval = await listBenefitEvidenceLinks({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
      benefitLineId: unlinkedBenefitLineId,
      hydrateKpiDetails: true,
    });
    expect(unlinkedReadAfterApproval).toEqual([]);
  }, 30_000);

  it('Step 3 — a finance_projection dispatch tick that projects a value AND opens a reconciliation never mutates any ROI source table (hash+count identical before/after)', async () => {
    const beforeTick = await runOutboxDispatchTick();
    expect(beforeTick.failed).toBe(0);
    expect(beforeTick.deadLettered).toBe(0);

    const projectionsBeforeDivergence = await listRoiFinanceProjections({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
    });
    expect(projectionsBeforeDivergence).toHaveLength(1);
    expect(projectionsBeforeDivergence[0].roiValue).toBe(1000);
    expect(projectionsBeforeDivergence[0].sourceKind).toBe('approval_snapshot');
    expect(projectionsBeforeDivergence[0].sourceId).toBe(approvalSnapshotId);
    expect(projectionsBeforeDivergence[0].sourceSequenceNumber).toBe(approvalSequenceNumber);
    expect(projectionsBeforeDivergence[0].reconciliationStatus).toBeNull();

    // Start tracking, then diverge — same pattern as EXECUTION_LEDGER.md §53
    // Step 6, but this file additionally snapshots benefit-evidence-link/
    // cost-line/benefit-line (§53 only snapshotted the three immutable
    // financial-history tables).
    const trackingOutcome = await startRoiCaseTracking({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: caseRowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--tracking-${randomUUID()}`,
    });
    await runOutboxDispatchTick();

    await recordActualEntry({
      caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 1800, // diverges from pinned 1000
      currency: 'USD',
      source: 'invoice-rn-g4',
      recordedBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--actual-entry-${randomUUID()}`,
    });

    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: trackingOutcome.resultingVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--actual-snapshot-${randomUUID()}`,
    });
    expect(snapshotOutcome.result.totalActualCosts).toBe(1800);

    const before: Record<string, { count: number; hash: string }> = {};
    for (const table of ROI_SOURCE_TABLES) {
      before[table] = await hashCountTable(caseId, table);
    }
    // Sanity: the tables are not trivially empty for every entry — otherwise
    // an "identical before/after" assertion would be vacuous.
    expect(before['rvn_roi_benefit_lines'].count).toBe(2);
    expect(before['rvn_roi_cost_lines'].count).toBe(1);
    expect(before['rvn_roi_benefit_evidence_links'].count).toBe(1);
    expect(before['rvn_roi_approval_snapshots'].count).toBeGreaterThanOrEqual(1);
    expect(before['rvn_roi_actual_snapshots'].count).toBe(1);

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    for (const table of ROI_SOURCE_TABLES) {
      const after = await hashCountTable(caseId, table);
      expect(after, `table ${table} must be hash+count identical before/after the dispatch tick`).toEqual(
        before[table]
      );
    }

    // The tick DID have a real, visible effect — just never on the source
    // tables themselves, only on the derived projection/reconciliation rows.
    const projectionsAfterDivergence = await listRoiFinanceProjections({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
    });
    expect(projectionsAfterDivergence).toHaveLength(1);
    expect(projectionsAfterDivergence[0].roiValue).toBe(1800);
    expect(projectionsAfterDivergence[0].sourceKind).toBe('actual_snapshot');
    expect(projectionsAfterDivergence[0].reconciliationStatus).toBe('open');

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
    });
    const openOnes = reconciliations.filter((r) => r.status === 'open');
    expect(openOnes).toHaveLength(1);
    expect(openOnes[0].roiValue).toBe(1800);
    expect(openOnes[0].financeValue).toBe(1000);
  }, 30_000);

  it('Step 4 — cold reopen: every claim above still holds via fresh public-path reads, nothing depended on in-memory state', async () => {
    const linkedRead = await listBenefitEvidenceLinks({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
      benefitLineId: linkedBenefitLineId,
      hydrateKpiDetails: true,
    });
    expect(linkedRead).toHaveLength(1);
    expect(linkedRead[0].kpiDetails?.kpiId).toBe(kpiId);

    const unlinkedRead = await listBenefitEvidenceLinks({
      userId: OWNER,
      organizationId: ORG_ID,
      caseId,
      benefitLineId: unlinkedBenefitLineId,
      hydrateKpiDetails: true,
    });
    expect(unlinkedRead).toEqual([]);

    const projections = await listRoiFinanceProjections({ userId: OWNER, organizationId: ORG_ID, caseId });
    expect(projections).toHaveLength(1);
    expect(projections[0].roiValue).toBe(1800);
    expect(projections[0].reconciliationStatus).toBe('open');

    // Not every ROI_SOURCE_TABLES entry is populated by THIS scenario (no
    // forecast version was ever published on this case) — assert only the
    // ones this flow actually wrote to, to avoid a vacuous check.
    const nonEmptyTables = [
      'rvn_roi_approval_snapshots',
      'rvn_roi_actual_snapshots',
      'rvn_roi_benefit_evidence_links',
      'rvn_roi_cost_lines',
      'rvn_roi_benefit_lines',
    ];
    for (const table of nonEmptyTables) {
      const state = await hashCountTable(caseId, table);
      expect(state.count, `table ${table} expected non-empty`).toBeGreaterThan(0);
    }
  });
});
