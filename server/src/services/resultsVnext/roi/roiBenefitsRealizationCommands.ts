/**
 * ROI-E005 — Benefits Realization command layer.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions D1-D9.
 *
 * `startRoiCaseBenefitsRealization` — `'tracking' -> 'benefits_realization'`,
 * hand-written `executeAtomicCommand` structurally copied from
 * `roiTrackingCommands.ts`'s `startRoiCaseTracking` (same "hand-written
 * because this command has a side effect beyond the plain status write"
 * convention). Decision D2 (AC-01): the guard below checks ONLY this Case's
 * own `status` column — it never reads `initiatives.status`, never joins the
 * `initiatives` table, and never calls anything in
 * `services/initiative/initiativeClosureService.ts`. That is the literal
 * mechanism making the transition "independent of Initiative closure" —
 * confirmed by reading `initiativeClosureService.ts` (design §0/D5: zero
 * references to any `rvn_*` table or to ROI/obligations anywhere in that
 * file), not merely asserted.
 *
 * `cancelRoiCase` — `ROI_TRACKING_ACTIVE_STATUSES -> 'cancelled'` (Decision
 * D6/D7: deliberately narrow — only a case that has already started tracking
 * may be cancelled via this command; earlier-stage abandonment is a
 * different, unbuilt feature, filed as backlog). `reason` is a MANDATORY
 * `string` (Decision D8 — same non-optional pattern
 * `reopenApprovedRoiCaseForRevision` already uses for its own mandatory
 * field). AC-04's structural proof: this function's `applyMutation` touches
 * ONLY `rvn_roi_cases` — no `rvn_roi_actual_entries`, no
 * `rvn_roi_actual_snapshots`, no `rvn_roi_forecast_versions`, no
 * `rvn_roi_variances` — anywhere in this file. Decision D9: no obligation
 * writes either (nothing anywhere in this domain auto-manages obligation
 * status on any transition, per D5's own finding; left as backlog, not
 * built here).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';
import { createObligation } from '../platform/obligations.js';

import { ROI_EVENT_SOURCE, ROI_TRACKING_ACTIVE_STATUSES, RoiCaseValidationError } from './roiCaseCommands.js';

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_BENEFITS_REALIZATION_CAPABILITIES = {
  start: 'results.roi.benefits_realization.start',
  cancelCase: 'results.roi.case.cancel',
} as const;
import { toRoiCase, type RoiCase, type RoiCaseRow } from './roiTypes.js';

// Design §2: obligation type created alongside startRoiCaseBenefitsRealization
// (Decision D4) — mirrors ROI-E004's own TRACK_ROI_FORECAST_ACTUALS_OBLIGATION_TYPE
// naming convention. No source doc names the exact string; a reasonable,
// explicitly flagged choice, not a guess presented as fact.
export const CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE = 'confirm_benefits_realization';

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

// ==========================================
// startRoiCaseBenefitsRealization
// ==========================================

export interface StartRoiCaseBenefitsRealizationInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/**
 * Guard: `status === 'tracking'` else `RoiCaseValidationError`
 * (`INVALID_ROI_CASE_STATUS_TRANSITION`, same code every other lifecycle
 * guard in this domain uses). Decision D3: no readiness guard beyond the
 * status check — Benefits Realization is typically when Actuals START
 * accruing, so requiring prior Actual data would block the normal case.
 * `UPDATE rvn_roi_cases SET status='benefits_realization'`, then a
 * `confirm_benefits_realization` obligation assigned to the case's own
 * `owner_user_id` (Decision D4), same transaction. The pre-existing
 * `track_roi_forecast_actuals` obligation (created by `startRoiCaseTracking`)
 * is deliberately left untouched — it covers the same ongoing duty across
 * all of `ROI_TRACKING_ACTIVE_STATUSES`, which already includes
 * `'benefits_realization'`. Event `roi.benefits_realization_started`.
 */
export async function startRoiCaseBenefitsRealization(
  input: StartRoiCaseBenefitsRealizationInput
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_BENEFITS_REALIZATION_CAPABILITIES.start,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      // Decision D2 (AC-01): status-only guard — this NEVER reads or joins
      // `initiatives.status`. Do not "improve" this by adding an Initiative
      // -status check; that would silently reintroduce the coupling AC-01
      // explicitly overrides (see file header / design §0 D2/D5).
      if (currentRow.status !== 'tracking') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a "tracking" case may start benefits realization`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'benefits_realization' }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'benefits_realization', row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[startRoiCaseBenefitsRealization] update returned no row for ${caseId}`);
      }

      // Decision D4: same transaction as the status write.
      await createObligation(client, {
        organizationId,
        assigneeUserId: currentRow.owner_user_id,
        referenceType: 'roi_case',
        referenceId: caseId,
        aggregateVersionAtCreation: nextVersion,
        obligationType: CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:roi_case:${caseId}:${CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE}`,
      });

      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefits_realization_started',
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

// ==========================================
// cancelRoiCase
// ==========================================

export interface CancelRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  /** Mandatory (Decision D8) — same non-optional-string pattern
   * `reopenApprovedRoiCaseForRevision`'s own mandatory field uses. Recorded
   * on the event log's `reason` column; no dedicated audit column (Decision
   * D8 — plain status transitions in this domain get no dedicated columns). */
  reason: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  access: CommandAccessContext;
}

/**
 * Guard: `ROI_TRACKING_ACTIVE_STATUSES.includes(status)` else
 * `RoiCaseValidationError` (`INVALID_ROI_CASE_STATUS_TRANSITION`). Decision
 * D7: deliberately narrow `fromStatuses` — cancelling a case with no Actual
 * data (still `draft`/`modeling`/`approved`) has no AC-04 concern; a general
 * "abandon at any stage" command is a different, unnamed feature (filed as
 * backlog, not built here). `UPDATE rvn_roi_cases SET status='cancelled'`.
 *
 * AC-04's STRUCTURAL proof lives here, not just in a test assertion: this
 * `applyMutation` writes to `rvn_roi_cases` ONLY — it contains no reference,
 * read or write, to `rvn_roi_actual_entries`, `rvn_roi_actual_snapshots`,
 * `rvn_roi_forecast_versions`, or `rvn_roi_variances` anywhere in this file.
 * Decision D9: no obligation writes either — left untouched, same as every
 * other transition in this domain (filed as backlog).
 */
export async function cancelRoiCase(input: CancelRoiCaseInput): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    reason,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_BENEFITS_REALIZATION_CAPABILITIES.cancelCase,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      if (!ROI_TRACKING_ACTIVE_STATUSES.includes(currentRow.status)) {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a case that has started tracking may be cancelled`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'cancelled' }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'cancelled', row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[cancelRoiCase] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_cancelled',
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
