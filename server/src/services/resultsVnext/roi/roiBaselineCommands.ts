/**
 * ROI-E001 — Baseline command layer.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §4.4-§4.5.
 * Schema: server/migrations/20260815_rvn_roi_core.sql.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE, RoiCaseValidationError } from './roiCaseCommands.js';
import {
  toRoiBaseline,
  type RoiBaseline,
  type RoiBaselineConfidence,
  type RoiBaselineProjectionMethod,
  type RoiBaselineRow,
  type RoiCaseStatus,
} from './roiTypes.js';

const POLICY_VERSION_NOT_TRACKED = '';

// RN-G5: freezeRoiBaseline/unfreezeRoiBaseline are NOT gated — internal
// cross-epic contracts called only from roiCaseApprovalCommands.ts's
// approveRoiCase/reopenApprovedRoiCaseForRevision (both already gated),
// on the caller's own pinned client. Grepped: no route or other command
// file calls either function directly.
export const ROI_BASELINE_CAPABILITIES = {
  captureOrUpdate: 'results.roi.baseline.capture_or_update',
} as const;

// ==========================================
// ERRORS
// ==========================================

/** Thrown by `captureOrUpdateBaseline` when the baseline has already been
 * frozen (design §4.4) — matches the typed-409 convention every other
 * lifecycle-guard error in this program uses. Also the error a caller
 * would see if they tried to mutate a frozen baseline through any path
 * other than `freezeRoiBaseline` itself. */
export class RoiBaselineFrozenError extends Error {
  code = 'BASELINE_FROZEN';
  details: Record<string, unknown>;
  constructor(caseId: string, baselineId: string) {
    super(`ROI baseline ${baselineId} for case ${caseId} is frozen — cannot be edited`);
    this.name = 'RoiBaselineFrozenError';
    this.details = { caseId, baselineId };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadRoiBaselineForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiBaselineRow | undefined> {
  const result = await client.query<RoiBaselineRow>(
    `SELECT * FROM rvn_roi_baselines WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function baselineRowVersion(row: RoiBaselineRow): number {
  return row.row_version;
}

// ==========================================
// captureOrUpdateBaseline
// ==========================================

export interface CaptureOrUpdateBaselineInput {
  organizationId: string;
  caseId: string;
  expectedVersion: number;
  baselinePeriodStart?: string | null;
  baselinePeriodEnd?: string | null;
  currentMeasuredValue?: number | null;
  currentMeasuredUnit?: string | null;
  currentMeasuredAsOf?: string | null;
  bauProjectionMethod?: RoiBaselineProjectionMethod;
  bauGrowthRatePct?: number | null;
  bauReferenceValue?: number | null;
  interventionComparisonNotes?: string | null;
  source?: string | null;
  confidence?: RoiBaselineConfidence | null;
  ownerUserId?: string | null;
  actorId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/**
 * Design §4.4: the baseline row always exists from case creation — this is
 * ALWAYS an update on `rvn_roi_baselines.row_version`, never a create/upsert
 * branch. Guard: `frozen_at !== null` -> `RoiBaselineFrozenError` (typed,
 * 409). No self-approval check — capturing/editing your own baseline
 * pre-freeze is a normal author action, matching KPI's `editDraft`.
 *
 * `aggregateId` for `executeAtomicCommand` is the CASE id, not the baseline
 * id — `rvn_roi_baselines` is keyed 1:1 by `case_id` (UNIQUE), so loading
 * "the baseline for this case" needs the case id, exactly like
 * `loadRoiBaselineForUpdate` above.
 */
export async function captureOrUpdateBaseline(
  input: CaptureOrUpdateBaselineInput
): Promise<AtomicCommandOutcome<RoiBaseline>> {
  const {
    organizationId,
    caseId,
    expectedVersion,
    actorId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiBaselineRow, RoiBaseline>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiBaselineForUpdate,
    getCurrentVersion: baselineRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // ROI-E003 Decision D4: the baseline table was never wired to the
      // shared NON_EDITABLE_STATUSES constant by E001/E002 — a plain
      // status read closes that gap (e.g. a case in 'submitted_for_approval'
      // must not have its baseline edited even though `frozen_at` is still
      // NULL at that point — freezing only happens on actual approval).
      // RN-G5 reuses this SAME query for the case's owner_user_id — the
      // authoritative "who owns this case" field, checked alongside the
      // baseline row's own (nullable) owner_user_id.
      const caseRowResult = await client.query<{ status: RoiCaseStatus; owner_user_id: string }>(
        `SELECT status, owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
        [caseId, organizationId]
      );
      const caseStatus = caseRowResult.rows[0]?.status;
      const caseOwnerUserId = caseRowResult.rows[0]?.owner_user_id ?? null;

      assertCommandCapability({
        access,
        actorUserId: actorId,
        capability: ROI_BASELINE_CAPABILITIES.captureOrUpdate,
        responsibleUserIds: [caseOwnerUserId, currentRow.owner_user_id],
      });

      if (currentRow.frozen_at !== null) {
        throw new RoiBaselineFrozenError(caseId, currentRow.baseline_id);
      }

      if (caseStatus && NON_EDITABLE_STATUSES.includes(caseStatus)) {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${caseStatus}" — baseline may not be edited from this status`,
          'NOT_EDITABLE',
          { caseId, status: caseStatus }
        );
      }

      beforeState = { baseline: toRoiBaseline(currentRow) };

      const merged = {
        baseline_period_start:
          edits.baselinePeriodStart !== undefined ? edits.baselinePeriodStart : currentRow.baseline_period_start,
        baseline_period_end:
          edits.baselinePeriodEnd !== undefined ? edits.baselinePeriodEnd : currentRow.baseline_period_end,
        current_measured_value:
          edits.currentMeasuredValue !== undefined ? edits.currentMeasuredValue : currentRow.current_measured_value,
        current_measured_unit:
          edits.currentMeasuredUnit !== undefined ? edits.currentMeasuredUnit : currentRow.current_measured_unit,
        current_measured_as_of:
          edits.currentMeasuredAsOf !== undefined ? edits.currentMeasuredAsOf : currentRow.current_measured_as_of,
        bau_projection_method: edits.bauProjectionMethod ?? currentRow.bau_projection_method,
        bau_growth_rate_pct:
          edits.bauGrowthRatePct !== undefined ? edits.bauGrowthRatePct : currentRow.bau_growth_rate_pct,
        bau_reference_value:
          edits.bauReferenceValue !== undefined ? edits.bauReferenceValue : currentRow.bau_reference_value,
        intervention_comparison_notes:
          edits.interventionComparisonNotes !== undefined
            ? edits.interventionComparisonNotes
            : currentRow.intervention_comparison_notes,
        source: edits.source !== undefined ? edits.source : currentRow.source,
        confidence: edits.confidence !== undefined ? edits.confidence : currentRow.confidence,
        owner_user_id: edits.ownerUserId !== undefined ? edits.ownerUserId : currentRow.owner_user_id,
      };

      const updateResult = await client.query<RoiBaselineRow>(
        `UPDATE rvn_roi_baselines
            SET baseline_period_start = $1, baseline_period_end = $2, current_measured_value = $3,
                current_measured_unit = $4, current_measured_as_of = $5, bau_projection_method = $6,
                bau_growth_rate_pct = $7, bau_reference_value = $8, intervention_comparison_notes = $9,
                source = $10, confidence = $11, owner_user_id = $12,
                row_version = $13, updated_at = now()
          WHERE case_id = $14
          RETURNING *`,
        [
          merged.baseline_period_start,
          merged.baseline_period_end,
          merged.current_measured_value,
          merged.current_measured_unit,
          merged.current_measured_as_of,
          merged.bau_projection_method,
          merged.bau_growth_rate_pct,
          merged.bau_reference_value,
          merged.intervention_comparison_notes,
          merged.source,
          merged.confidence,
          merged.owner_user_id,
          nextVersion,
          caseId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[captureOrUpdateBaseline] update returned no row for case ${caseId}`);
      }
      return toRoiBaseline(updatedRow);
    },
    buildEvent: ({ currentRow, result, nextVersion }) => {
      const afterState = { baseline: result };
      // First real capture (currentRow had no measured value yet) vs a
      // subsequent edit — distinct event types so a consumer can tell
      // "baseline established" from "baseline revised" without diffing
      // before/after itself. Both still go through the SAME command/guard.
      const eventType =
        currentRow.current_measured_value === null && result.currentMeasuredValue !== null
          ? 'roi.baseline_captured'
          : 'roi.baseline_updated';
      return {
        schemaVersion: 1,
        eventType,
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: actorId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, baselineId: result.baselineId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// freezeRoiBaseline (Decision D5 — cross-epic contract owned by E001)
// ==========================================

/**
 * Called by ROI-E003's future `approveRoiCase`, on the SAME pinned client,
 * inside the SAME transaction as the case-approval CAS — the pattern
 * `recordMeasurement -> openOrEscalateDeviationCase` established
 * (KPI_E003_DESIGN.md decision #3). This function does NOT open its own
 * transaction and does NOT check case status itself — the caller (ROI-E003)
 * is responsible for calling this only when the case transition it is
 * CASing actually reaches `'approved'`.
 *
 * ROI-E003's design doc must reference this function by name rather than
 * restate the contract (Decision D5). Rationale for a LOCAL `frozen_at`
 * column instead of a cross-table trigger read on `rvn_roi_cases.status`: a
 * baseline UPDATE and a case-approval UPDATE take `SELECT...FOR UPDATE`
 * locks on two different rows, so "check case status inside the baseline
 * trigger" cannot be made atomic with the approval CAS itself —
 * "E003's approval transaction calls `freezeRoiBaseline` on the same client
 * before COMMIT" makes freeze-and-approve atomic by construction instead.
 */
export async function freezeRoiBaseline(
  client: PoolClient,
  params: { caseId: string; organizationId: string; frozenBy: string }
): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_baselines
     SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
     WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL`,
    [params.caseId, params.organizationId, params.frozenBy]
  );
}

// ==========================================
// unfreezeRoiBaseline (ROI-E003 §4.6 — symmetric counterpart to
// freezeRoiBaseline, cross-epic contract owned by E001, first called by
// ROI-E003's reopenApprovedRoiCaseForRevision)
// ==========================================

/**
 * Called by ROI-E003's `reopenApprovedRoiCaseForRevision`, on the SAME
 * pinned client, inside the SAME transaction as the case's approved ->
 * modeling CAS — same "no own transaction, no own status check, caller's
 * responsibility" contract shape as `freezeRoiBaseline` above. Idempotent:
 * a baseline that is not currently frozen is left untouched (`WHERE
 * frozen_at IS NOT NULL`).
 */
export async function unfreezeRoiBaseline(
  client: PoolClient,
  params: { caseId: string; organizationId: string }
): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_baselines
     SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
     WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [params.caseId, params.organizationId]
  );
}
