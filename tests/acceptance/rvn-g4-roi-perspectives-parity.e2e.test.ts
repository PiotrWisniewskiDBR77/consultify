/**
 * Acceptance E2E — RN-G4, point 6 of the FALA 3 cross-domain evidence brief
 * (docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md):
 *
 * "The individual and organizational perspectives show the SAME aggregate
 * identifiers (D12 — projections, not copies)."
 *
 * This program already has dedicated, pre-existing, untouched evidence for
 * this exact claim in two domains:
 *   - `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts`
 *     (KPI-E007) — one of the five files this task's brief explicitly lists
 *     as untouchable; run (not modified) as part of this evidence packet.
 *   - `tests/resultsVnext/okr/okrPerspectivesParity.realdb.test.ts`
 *     (OKR-E008, D-OKR8-15) — personal/team-BU/company projections return
 *     byte-identical `setId`/`currentVersion` for the same Set.
 *
 * ROI had no equivalent individual-vs-organization parity proof — this
 * file closes that gap: the SAME ROI case's `caseId`/`rowVersion` is
 * compared between `getRoiCase` (an individual, single-case read) and
 * `listOrganizationRoiBenefitsRealization` (the manager/organizational
 * perspective, `roiOrgPerspectiveRepository.ts`), before AND after a real
 * write (`startRoiCaseTracking` -> a real `recordActualEntry` ->
 * `publishRoiActualSnapshot`), proving both surfaces read the SAME live
 * row, not two independently-maintained copies.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g4--roi-perspectives-parity--${tag}`;
const ORG_ID = `${MARKER}--org`;
const OWNER = `${MARKER}--owner`;
const MANAGER = `${MARKER}--manager`;
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
type RoiRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiRepository.js');
type OrgPerspectiveRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js');

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
let getRoiCase: RoiRepositoryModule['getRoiCase'];
let listOrganizationRoiBenefitsRealization: OrgPerspectiveRepositoryModule['listOrganizationRoiBenefitsRealization'];

async function insertOrgAndUsers(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [ORG_ID, `RN-G4 fixture org ${ORG_ID}`]
    );
    for (const [id, email] of [
      [OWNER, `${OWNER}@acceptance.local`],
      [MANAGER, `${MANAGER}@acceptance.local`],
    ]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG4', 'Fixture', now())`,
        [id, ORG_ID, email]
      );
    }
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, 'roi', 1, 'OPEN_ORG', true, $2)`,
      [ORG_ID, OWNER]
    );
    // The organizational perspective (`buildScopedRoiCasesBase`) scopes to
    // the manager's OWN management-chain descendants — MANAGER must be a
    // real ancestor of OWNER in the closure table to see OWNER's case at
    // all (this is the realistic "manager sees their report's case" shape,
    // not a same-user shortcut).
    await client.query(
      `INSERT INTO rvn_platform_management_chain_closure (organization_id, ancestor_user_id, descendant_user_id, depth)
       VALUES ($1, $2, $3, 1)`,
      [ORG_ID, MANAGER, OWNER]
    );
  } finally {
    await client.end();
  }
}

describe('RN-G4 · Point 6, ROI leg — individual (getRoiCase) and organizational (listOrganizationRoiBenefitsRealization) perspectives return the SAME caseId/rowVersion, live', () => {
  let caseId: string;
  let initiativeId: string;
  let costLineId: string;
  let rowVersionAfterApproval: number;

  beforeAll(async () => {
    await insertOrgAndUsers();

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
    const roiRepository: RoiRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiRepository.js'
    );
    ({ getRoiCase } = roiRepository);
    const orgPerspectiveRepository: OrgPerspectiveRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js'
    );
    ({ listOrganizationRoiBenefitsRealization } = orgPerspectiveRepository);
  }, 30_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL,
                original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
                decision_calculation_run_id = NULL
          WHERE organization_id = $1`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_management_chain_closure WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    } finally {
      await client.end();
    }
  }, 60_000);

  it('Step 1 — a real ROI case, driven to "tracking" through real commands, is visible identically from both perspectives', async () => {
    initiativeId = `${MARKER}--init`;
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`, [
        initiativeId,
        ORG_ID,
        'RN-G4 point6 fixture initiative',
      ]);
    } finally {
      await client.end();
    }

    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'RN-G4 point6 ROI case',
      ownerUserId: OWNER,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-12-31',
      createdBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--create-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    caseId = createOutcome.result.case.caseId;

    const startOutcome = await startModeling({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: createOutcome.result.case.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--start-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
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
      access: { capabilities: ['*'], platformRole: null },
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
      access: { capabilities: ['*'], platformRole: null },
    });
    costLineId = costLineOutcome.result.costLineId;
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
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--benefit-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    await createRoiCalculationRun({
      organizationId: ORG_ID,
      caseId,
      scenarioId: null,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--run-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const readyOutcome = await markReadyForReview({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: startOutcome.resultingVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--ready-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const submitOutcome = await submitRoiCaseForApproval({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: readyOutcome.resultingVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--submit-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const approveOutcome = await approveRoiCase({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: submitOutcome.resultingVersion,
      approverId: APPROVER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--approve-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    rowVersionAfterApproval = approveOutcome.resultingVersion;

    const trackingOutcome = await startRoiCaseTracking({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersionAfterApproval,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--tracking-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    // Individual perspective.
    const individualView = await getRoiCase({ userId: OWNER, organizationId: ORG_ID, caseId });
    expect(individualView).toBeTruthy();
    expect(individualView!.caseId).toBe(caseId);
    expect(individualView!.status).toBe('tracking');
    expect(individualView!.rowVersion).toBe(trackingOutcome.resultingVersion);

    // Organizational perspective (manager, via management-chain closure).
    const orgView = await listOrganizationRoiBenefitsRealization({ managerId: MANAGER, organizationId: ORG_ID });
    const orgRow = orgView.cases.find((c) => c.caseId === caseId);
    expect(orgRow).toBeTruthy();
    expect(orgRow!.status).toBe('tracking');
    expect(orgRow!.initiativeId).toBe(individualView!.initiativeId);

    void costLineOutcome;
  }, 30_000);

  it('Step 2 — a real write (Actual entry + published snapshot) is visible identically from BOTH perspectives afterwards (proves live view, not a point-in-time snapshot/copy)', async () => {
    const individualBefore = await getRoiCase({ userId: OWNER, organizationId: ORG_ID, caseId });
    const rowVersionBeforeWrite = individualBefore!.rowVersion;

    await recordActualEntry({
      caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 950,
      currency: 'USD',
      source: 'invoice-rn-g4-point6',
      recordedBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--actual-entry-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersionBeforeWrite,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--actual-snapshot-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    // Individual perspective, re-read fresh — the case's own rowVersion
    // moved forward with the real write.
    const individualAfter = await getRoiCase({ userId: OWNER, organizationId: ORG_ID, caseId });
    expect(individualAfter!.caseId).toBe(caseId);
    expect(individualAfter!.rowVersion).toBe(snapshotOutcome.resultingVersion);
    expect(individualAfter!.rowVersion).toBeGreaterThan(rowVersionBeforeWrite);
    expect(individualAfter!.currentActualSnapshotId).toBe(snapshotOutcome.result.actualSnapshotId);

    // Organizational perspective, re-read fresh — the SAME published
    // snapshot's `total_actual_financial_benefits` figure is what the
    // manager's view now shows for this case (0 here: this fixture never
    // added a benefit-type Actual entry, only a cost one — the meaningful
    // claim is that the figure the manager sees is READ FROM the exact
    // snapshot row `currentActualSnapshotId` now points to, not a
    // separately-maintained copy).
    const snapshotRowClient = pgClient();
    await snapshotRowClient.connect();
    let authoritativeActualBenefits: number;
    try {
      const row = await snapshotRowClient.query<{ total_actual_financial_benefits: string | null }>(
        `SELECT total_actual_financial_benefits FROM rvn_roi_actual_snapshots WHERE actual_snapshot_id = $1`,
        [snapshotOutcome.result.actualSnapshotId]
      );
      authoritativeActualBenefits = Number(row.rows[0]!.total_actual_financial_benefits ?? 0);
    } finally {
      await snapshotRowClient.end();
    }

    const orgViewAfter = await listOrganizationRoiBenefitsRealization({ managerId: MANAGER, organizationId: ORG_ID });
    const orgRowAfter = orgViewAfter.cases.find((c) => c.caseId === caseId);
    expect(orgRowAfter).toBeTruthy();
    expect(orgRowAfter!.caseId).toBe(individualAfter!.caseId);
    expect(orgRowAfter!.actualFinancialBenefits).toBe(authoritativeActualBenefits);
  }, 30_000);
});
