/**
 * ROI-E003 — Decision & Approved — command layer.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §4.
 * Schema: server/migrations/20260817_rvn_roi_decision_approval.sql.
 *
 * Hand-written `executeAtomicCommand` calls (not the generic
 * `runRoiCaseLifecycleTransition` helper) for every command writing fields
 * beyond `status` — matches `kpiDefinitionCommands.ts`'s `submitDefinition`/
 * `approveDefinitionVersion`/`rejectDefinitionVersion`, none of which use a
 * generic helper either (design §4 header). `reopenRejectedRoiCase` (the one
 * ROI-E003 command that writes ONLY `status`) lives in `roiCaseCommands.ts`
 * instead, alongside `startModeling`/`markReadyForReview` (design §4.7).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  EVENT_INSERT_SQL,
  executeAtomicCommand,
  resolveConsumerGroups,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';

import { unfreezeRoiBaseline, freezeRoiBaseline } from './roiBaselineCommands.js';
import { ROI_EVENT_SOURCE, RoiCaseNotReadyForReviewError, RoiCaseValidationError } from './roiCaseCommands.js';
import { freezeRoiEconomicModel, unfreezeRoiEconomicModel } from './roiEconomicModelFreeze.js';
import {
  toRoiAssumption,
  toRoiBenefitEvidenceLink,
  toRoiBenefitLine,
  toRoiCalculationPolicy,
  toRoiCalculationRun,
  toRoiCostLine,
  toRoiScenario,
  toRoiScenarioOverride,
  type RoiAssumptionRow,
  type RoiBenefitEvidenceLinkRow,
  type RoiBenefitLineRow,
  type RoiCalculationPolicyRow,
  type RoiCalculationRunRow,
  type RoiCostLineRow,
  type RoiScenarioOverrideRow,
  type RoiScenarioRow,
} from './roiEconomicModelTypes.js';
import { isRoiCaseReadyForReviewEligibleWithEconomicModel } from './roiEconomicModelReadiness.js';
import {
  toRoiApprovalSnapshotSummary,
  type RoiApprovalSnapshotPayload,
  type RoiApprovalSnapshotRow,
  type RoiApprovalSnapshotSummary,
} from './roiApprovalSnapshotTypes.js';
import { toRoiBaseline, toRoiCase, type RoiBaselineRow, type RoiCase, type RoiCaseRow } from './roiTypes.js';

// ==========================================
// ERRORS
// ==========================================

/**
 * Design §4.2/§6: own class (not KPI's `SelfApprovalDeniedError` reused
 * across domains) — Decision D14, direct precedent is the KPI Deviation
 * domain's own `DeviationSelfApprovalDeniedError` (a separate class per
 * aggregate, not cross-domain reuse).
 */
export class RoiSelfApprovalDeniedError extends Error {
  code = 'SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(caseId: string, approverId: string, reasonField: 'submitted_by' | 'created_by') {
    super(`User ${approverId} may not approve ROI case ${caseId}: matches its own ${reasonField}`);
    this.name = 'RoiSelfApprovalDeniedError';
    this.details = { caseId, approverId, reasonField };
  }
}

// ==========================================
// SHARED ROW LOADER
//
// Not reused from roiCaseCommands.ts — that file's own `loadRoiCaseForUpdate`
// is a private, unexported function (module-local convention every command
// file in this package follows: kpiDeviationCommands.ts/kpiScorecardCommands.ts
// each declare their own local loader rather than importing one). Identical
// query.
// ==========================================

async function loadRoiCaseForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiCaseRow | undefined> {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function caseRowVersion(row: RoiCaseRow): number {
  return row.row_version;
}

async function loadRoiBaselineRow(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiBaselineRow | undefined> {
  const result = await client.query<RoiBaselineRow>(
    `SELECT * FROM rvn_roi_baselines WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

// ==========================================
// Manual event insert — same pattern kpiDeviationCommands.ts's
// insertManualDeviationEvent established: replicates just the "insert event
// row (idempotency-guarded) + fan out to outbox" half of
// executeAtomicCommand (atomicWrite.ts steps 5-6), for a caller (approveRoiCase/
// reopenApprovedRoiCaseForRevision) that is already inside its OWN
// executeAtomicCommand transaction and cannot invoke a second atomic-write
// helper (nesting a second BEGIN on an already-open pinned client).
// ==========================================

async function insertManualRoiEvent(client: PoolClient, eventInput: AtomicEventInput): Promise<string | undefined> {
  const eventResult = await client.query<{ event_id: string; resulting_version: number }>(EVENT_INSERT_SQL, [
    eventInput.schemaVersion,
    eventInput.eventType,
    eventInput.aggregateType,
    eventInput.aggregateId,
    eventInput.organizationId,
    eventInput.actorUserId,
    eventInput.actorEffectiveRole,
    eventInput.commandId,
    eventInput.correlationId,
    eventInput.causationId,
    eventInput.occurredAt,
    eventInput.policyVersion,
    eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
    eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
    eventInput.stateHash,
    eventInput.reason,
    JSON.stringify(eventInput.evidenceRefs ?? []),
    eventInput.source,
    eventInput.idempotencyKey,
    eventInput.expectedVersion,
    eventInput.resultingVersion,
    JSON.stringify(eventInput.payload ?? {}),
  ]);

  const inserted = eventResult.rows[0];
  if (!inserted) return undefined;

  const consumerGroups = resolveConsumerGroups(eventInput.eventType);
  if (consumerGroups.length > 0) {
    await client.query(
      `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
      [inserted.event_id, consumerGroups]
    );
  }
  return inserted.event_id;
}

// ==========================================
// submitRoiCaseForApproval (AC-01, AC-02, §4.1)
// ==========================================

export interface SubmitRoiCaseForApprovalInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function submitRoiCaseForApproval(
  input: SubmitRoiCaseForApprovalInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // 1. fromStatuses guard.
      if (currentRow.status !== 'ready_for_review' && currentRow.status !== 'changes_requested') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — cannot submit for approval from there`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status }
        );
      }

      // 2. Decision D1: re-run the SAME readiness guard unchanged — a case
      // can still be edited after reaching 'ready_for_review' (it is not in
      // NON_EDITABLE_STATUSES), silently breaking the eligibility already
      // checked when it first got there. AC-01 names exactly this gap.
      const baselineRow = await loadRoiBaselineRow(client, caseId, organizationId);
      if (!baselineRow) {
        throw new Error(`[submitRoiCaseForApproval] no baseline row found for case ${caseId}`);
      }
      const check = await isRoiCaseReadyForReviewEligibleWithEconomicModel(client, currentRow, baselineRow);
      if (!check.eligible) {
        throw new RoiCaseNotReadyForReviewError(caseId, check.reason ?? 'unspecified');
      }

      // 3. Decision D5: pin the calculation run the guard above validated as
      // fresh — the latest 'completed' run for this case.
      const runResult = await client.query<{ run_id: string }>(
        `SELECT run_id FROM rvn_roi_calculation_runs
          WHERE case_id = $1 AND organization_id = $2 AND status = 'completed'
          ORDER BY created_at DESC LIMIT 1`,
        [caseId, organizationId]
      );
      const runId = runResult.rows[0]?.run_id;
      if (!runId) {
        // Unreachable given the guard above already required a fresh
        // 'completed' run to exist — fail loudly rather than silently pin
        // nothing.
        throw new Error(
          `[submitRoiCaseForApproval] readiness guard passed but no completed calculation run found for case ${caseId}`
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'submitted_for_approval', submitted_by = $1, submitted_at = now(),
                decision_calculation_run_id = $2, row_version = $3, updated_by = $1, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [actorUserId, runId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[submitRoiCaseForApproval] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_submitted_for_approval',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, decisionCalculationRunId: result.decisionCalculationRunId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// approveRoiCase (AC-03, AC-04, AC-06, §4.2)
// ==========================================

export interface ApproveRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  approverId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface ApproveRoiCaseResult {
  case: RoiCase;
  snapshot: RoiApprovalSnapshotSummary;
}

export async function approveRoiCase(input: ApproveRoiCaseInput): Promise<AtomicCommandOutcome<ApproveRoiCaseResult>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    approverId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, ApproveRoiCaseResult>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // 1. Self-approval denial — FIRST, before any write (design §4.2/§6).
      // loadForUpdate's SELECT ... FOR UPDATE has already run (it is
      // executeAtomicCommand step 2, before this applyMutation), so the row
      // is locked, but nothing has been written yet when this check runs.
      if (currentRow.submitted_by === approverId) {
        throw new RoiSelfApprovalDeniedError(caseId, approverId, 'submitted_by');
      }
      if (currentRow.created_by === approverId) {
        throw new RoiSelfApprovalDeniedError(caseId, approverId, 'created_by');
      }

      // 2. Status guard.
      if (currentRow.status !== 'submitted_for_approval') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a case "submitted_for_approval" may be approved`,
          'NOT_SUBMITTED_FOR_APPROVAL',
          { caseId, status: currentRow.status }
        );
      }

      // 3. decision_calculation_run_id must be non-null — should be
      // unreachable given submitRoiCaseForApproval always sets it before
      // reaching 'submitted_for_approval'. Fail loudly, do not silently
      // proceed with a snapshot that pins nothing.
      const decisionRunId = currentRow.decision_calculation_run_id;
      if (!decisionRunId) {
        throw new Error(
          `[approveRoiCase] case ${caseId} is "submitted_for_approval" but has no decision_calculation_run_id — internal invariant violated`
        );
      }

      // 4. Read, on the SAME pinned client, every input the frozen
      // ApprovalSnapshot payload needs. All queries ORDER BY the row's own
      // id column for deterministic array ordering — the same logical row
      // set must always serialize into the same JSON for computeStateHash
      // to be meaningful (same discipline roiCalculationRunCommands.ts's
      // buildEngineInputFromDb documents).
      const baselineRow = await loadRoiBaselineRow(client, caseId, organizationId);
      if (!baselineRow) {
        throw new Error(`[approveRoiCase] no baseline row found for case ${caseId}`);
      }
      const policyResult = await client.query<RoiCalculationPolicyRow>(
        `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1 AND organization_id = $2`,
        [caseId, organizationId]
      );
      const policyRow = policyResult.rows[0];
      if (!policyRow) {
        throw new Error(`[approveRoiCase] no calculation-policy row found for case ${caseId}`);
      }
      const assumptionsResult = await client.query<RoiAssumptionRow>(
        `SELECT * FROM rvn_roi_assumptions
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY assumption_id`,
        [caseId, organizationId]
      );
      const costLinesResult = await client.query<RoiCostLineRow>(
        `SELECT * FROM rvn_roi_cost_lines
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY cost_line_id`,
        [caseId, organizationId]
      );
      const benefitLinesResult = await client.query<RoiBenefitLineRow>(
        `SELECT * FROM rvn_roi_benefit_lines
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY benefit_line_id`,
        [caseId, organizationId]
      );
      // rvn_roi_benefit_evidence_links carries no deleted_at/frozen_at of
      // its own (ROI-E002 §3 DDL) — every row for this case is "active" by
      // construction, no extra filter needed. Link metadata only (pinned
      // kpi_id/version/purpose/dispute_status) — never hydrated KPI content
      // (Decision D11).
      const evidenceLinksResult = await client.query<RoiBenefitEvidenceLinkRow>(
        `SELECT * FROM rvn_roi_benefit_evidence_links
          WHERE case_id = $1 AND organization_id = $2
          ORDER BY link_id`,
        [caseId, organizationId]
      );
      const scenariosResult = await client.query<RoiScenarioRow>(
        `SELECT * FROM rvn_roi_scenarios
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY scenario_id`,
        [caseId, organizationId]
      );
      // rvn_roi_scenario_overrides has no case_id column of its own —
      // joined through its parent scenario, same shape
      // roiEconomicModelRepository.ts's listScenarioOverrides uses.
      const overridesResult = await client.query<RoiScenarioOverrideRow>(
        `SELECT ov.*
           FROM rvn_roi_scenario_overrides ov
           INNER JOIN rvn_roi_scenarios s ON s.scenario_id = ov.scenario_id
          WHERE s.case_id = $1 AND ov.organization_id = $2
          ORDER BY ov.override_id`,
        [caseId, organizationId]
      );
      const runResult = await client.query<RoiCalculationRunRow>(
        `SELECT * FROM rvn_roi_calculation_runs WHERE run_id = $1 AND case_id = $2 AND organization_id = $3`,
        [decisionRunId, caseId, organizationId]
      );
      const decisionRunRow = runResult.rows[0];
      if (!decisionRunRow) {
        throw new Error(
          `[approveRoiCase] pinned decision_calculation_run_id ${decisionRunId} not found for case ${caseId}`
        );
      }

      // 5. Build the frozen payload — `case` reflects the row as locked at
      // the moment of decision (pre-write: still 'submitted_for_approval',
      // approved_by/approved_at not yet set). The snapshot INSERT (step 7)
      // happens BEFORE the case UPDATE (step 10) below, so there is no
      // "already approved" case row to capture even in principle — this is
      // the exact state the decision was made against, which is the
      // correct thing for an immutable approval record to preserve.
      const payload: RoiApprovalSnapshotPayload = {
        case: toRoiCase(currentRow),
        baseline: toRoiBaseline(baselineRow),
        calculationPolicy: toRoiCalculationPolicy(policyRow),
        assumptions: assumptionsResult.rows.map(toRoiAssumption),
        costLines: costLinesResult.rows.map(toRoiCostLine),
        benefitLines: benefitLinesResult.rows.map(toRoiBenefitLine),
        benefitEvidenceLinks: evidenceLinksResult.rows.map(toRoiBenefitEvidenceLink),
        scenarios: scenariosResult.rows.map(toRoiScenario),
        scenarioOverrides: overridesResult.rows.map(toRoiScenarioOverride),
        decisionCalculationRun: toRoiCalculationRun(decisionRunRow),
      };
      const contentHash = computeStateHash(payload as unknown as Record<string, unknown>);

      // 6. Monotonic per-case sequence number — safe without its own lock;
      // the case row's FOR UPDATE (executeAtomicCommand step 2) already
      // serializes concurrent approvals of the same case.
      const sequenceResult = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
           FROM rvn_roi_approval_snapshots WHERE case_id = $1`,
        [caseId]
      );
      const sequenceNumber = Number(sequenceResult.rows[0]?.next_sequence ?? 1);

      // 7. Insert the immutable snapshot row.
      const snapshotInsert = await client.query<RoiApprovalSnapshotRow>(
        `INSERT INTO rvn_roi_approval_snapshots
           (case_id, organization_id, sequence_number, decision_calculation_run_id,
            approved_by, content_hash, snapshot_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [caseId, organizationId, sequenceNumber, decisionRunId, approverId, contentHash, JSON.stringify(payload)]
      );
      const snapshotRow = snapshotInsert.rows[0];
      if (!snapshotRow) {
        throw new Error(`[approveRoiCase] insert into rvn_roi_approval_snapshots returned no row for case ${caseId}`);
      }

      // 8. Freeze the baseline (cross-epic contract, ROI-E001) + its own
      // manual event, same transaction.
      await freezeRoiBaseline(client, { caseId, organizationId, frozenBy: approverId });
      const baselineFrozenAfterState = { caseId, baselineId: baselineRow.baseline_id };
      await insertManualRoiEvent(client, {
        schemaVersion: 1,
        eventType: 'roi.baseline_frozen',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: approverId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState: baselineFrozenAfterState,
        stateHash: computeStateHash(baselineFrozenAfterState),
        reason: null,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey: `roi.baseline_frozen:${idempotencyKey}`,
        expectedVersion: null,
        resultingVersion: nextVersion,
        payload: { caseId, baselineId: baselineRow.baseline_id },
      });

      // 9. Freeze the economic model (cross-epic contract, ROI-E002) + its
      // own manual event, same transaction, immediately after the baseline
      // freeze.
      await freezeRoiEconomicModel(client, { caseId, organizationId, frozenBy: approverId });
      const economicModelFrozenAfterState = { caseId };
      await insertManualRoiEvent(client, {
        schemaVersion: 1,
        eventType: 'roi.economic_model_frozen',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: approverId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState: economicModelFrozenAfterState,
        stateHash: computeStateHash(economicModelFrozenAfterState),
        reason: null,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey: `roi.economic_model_frozen:${idempotencyKey}`,
        expectedVersion: null,
        resultingVersion: nextVersion,
        payload: { caseId },
      });

      beforeState = { case: toRoiCase(currentRow) };

      // 10. Case CAS update — two-pointer mechanism (Decision D10):
      // COALESCE only takes the new snapshot id while
      // original_approved_snapshot_id is still NULL (true exactly once per
      // case's lifetime); latest_approved_snapshot_id always moves.
      const caseUpdate = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'approved', approved_by = $1, approved_at = now(),
                latest_approved_snapshot_id = $2,
                original_approved_snapshot_id = COALESCE(original_approved_snapshot_id, $2),
                row_version = $3, updated_by = $1, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [approverId, snapshotRow.snapshot_id, nextVersion, caseId]
      );
      const updatedCaseRow = caseUpdate.rows[0];
      if (!updatedCaseRow) {
        throw new Error(`[approveRoiCase] case update returned no row for ${caseId}`);
      }

      return {
        case: toRoiCase(updatedCaseRow),
        snapshot: toRoiApprovalSnapshotSummary(snapshotRow),
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      // afterState carries the case DTO + the snapshot SUMMARY (not the
      // full payload) — matches publishReviewSnapshot's own "summary in the
      // event, full payload in its own table" convention.
      const afterState: Record<string, unknown> = { case: result.case, snapshot: result.snapshot };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_approved',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: approverId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, snapshotId: result.snapshot.snapshotId, sequenceNumber: result.snapshot.sequenceNumber },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// rejectRoiCase (AC-05, §4.3)
// ==========================================

export interface RejectRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  rejectedBy: string;
  rejectionReason: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/**
 * No self-approval check — mirrors `rejectDefinitionVersion` (rejecting your
 * own submission isn't the conflict self-approval-denial exists to
 * prevent). No freeze/unfreeze call — nothing is frozen pre-approval.
 */
export async function rejectRoiCase(input: RejectRoiCaseInput): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    rejectedBy,
    rejectionReason,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'submitted_for_approval') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a case "submitted_for_approval" may be rejected`,
          'NOT_SUBMITTED_FOR_APPROVAL',
          { caseId, status: currentRow.status }
        );
      }
      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'rejected', rejected_by = $1, rejected_at = now(), rejection_reason = $2,
                row_version = $3, updated_by = $1, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [rejectedBy, rejectionReason, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[rejectRoiCase] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_rejected',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: rejectedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason: rejectionReason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// requestChangesOnRoiCase (AC-05, D6, §4.4)
// ==========================================

export interface RequestChangesOnRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  changeRequestNotes: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/**
 * Structurally identical to `rejectRoiCase`, writing `changes_requested_by`/
 * `changes_requested_at`/`changes_requested_reason` instead of the
 * `rejected_*` columns (Decision D6 — distinct from rejection, distinct
 * audit columns; `'changes_requested'` stays editable, NOT added to
 * `NON_EDITABLE_STATUSES`).
 */
export async function requestChangesOnRoiCase(
  input: RequestChangesOnRoiCaseInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    changeRequestNotes,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'submitted_for_approval') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — changes may only be requested on a case "submitted_for_approval"`,
          'NOT_SUBMITTED_FOR_APPROVAL',
          { caseId, status: currentRow.status }
        );
      }
      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'changes_requested', changes_requested_by = $1, changes_requested_at = now(),
                changes_requested_reason = $2, row_version = $3, updated_by = $1, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [actorUserId, changeRequestNotes, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[requestChangesOnRoiCase] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_changes_requested',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason: changeRequestNotes,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// reopenApprovedRoiCaseForRevision (AC-06, D9, §4.5)
// ==========================================

export interface ReopenApprovedRoiCaseForRevisionInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  reason: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/**
 * `fromStatuses: ['approved']` only (D9/D18 — never Tracking+, that is a
 * materially bigger, cross-epic operation, explicitly deferred). Unfreezes
 * baseline + economic model via the symmetric functions this epic adds.
 * Does NOT touch `approved_by`/`approved_at`/`original_approved_snapshot_id`/
 * `latest_approved_snapshot_id`/`decision_calculation_run_id` — history
 * preserved; those keep pointing at the prior approval until the next
 * `approveRoiCase` updates `latest_approved_snapshot_id` (Decision D10).
 */
export async function reopenApprovedRoiCaseForRevision(
  input: ReopenApprovedRoiCaseForRevisionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    reason,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'approved') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only an "approved" case may be reopened for revision`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      // Unfreeze baseline, own manual event.
      await unfreezeRoiBaseline(client, { caseId, organizationId });
      const baselineUnfrozenAfterState = { caseId };
      await insertManualRoiEvent(client, {
        schemaVersion: 1,
        eventType: 'roi.baseline_unfrozen',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState: baselineUnfrozenAfterState,
        stateHash: computeStateHash(baselineUnfrozenAfterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey: `roi.baseline_unfrozen:${idempotencyKey}`,
        expectedVersion: null,
        resultingVersion: nextVersion,
        payload: { caseId },
      });

      // Unfreeze economic model, own manual event, immediately after.
      await unfreezeRoiEconomicModel(client, { caseId, organizationId });
      const economicModelUnfrozenAfterState = { caseId };
      await insertManualRoiEvent(client, {
        schemaVersion: 1,
        eventType: 'roi.economic_model_unfrozen',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState: economicModelUnfrozenAfterState,
        stateHash: computeStateHash(economicModelUnfrozenAfterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey: `roi.economic_model_unfrozen:${idempotencyKey}`,
        expectedVersion: null,
        resultingVersion: nextVersion,
        payload: { caseId },
      });

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'modeling', row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[reopenApprovedRoiCaseForRevision] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_reopened_from_approved',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}
