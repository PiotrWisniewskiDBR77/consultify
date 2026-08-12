/**
 * ROI-E004 — `startRoiCaseTracking` (the `'approved' -> 'tracking'` transition).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D1/D2.
 *
 * Hand-written `executeAtomicCommand` (NOT the generic
 * `runRoiCaseLifecycleTransition` helper in roiCaseCommands.ts) because this
 * command has a side effect (creating a MyWork obligation) beyond the plain
 * status write — same "hand-written for commands with side effects"
 * convention `roiCaseApprovalCommands.ts`'s file header documents and
 * `approveRoiCase`/`reopenApprovedRoiCaseForRevision` already follow.
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

import { ROI_EVENT_SOURCE, RoiCaseValidationError } from './roiCaseCommands.js';
import { toRoiCase, type RoiCase, type RoiCaseRow } from './roiTypes.js';

// ROI-E004 §4, Decision D2: obligation type created alongside
// startRoiCaseTracking — mirrors createRoiCase's own obligation. No source
// doc names the exact string; this is a reasonable, explicitly flagged
// choice, not a guess presented as fact.
export const TRACK_ROI_FORECAST_ACTUALS_OBLIGATION_TYPE = 'track_roi_forecast_actuals';

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

export interface StartRoiCaseTrackingInput {
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

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_TRACKING_CAPABILITIES = {
  start: 'results.roi.tracking.start',
} as const;

/**
 * Guard: `status === 'approved'` else `RoiCaseValidationError`
 * (`INVALID_ROI_CASE_STATUS_TRANSITION`, same code startModeling/
 * markReadyForReview use for their own fromStatuses guard). `UPDATE
 * rvn_roi_cases SET status='tracking'`, then a `track_roi_forecast_actuals`
 * obligation assigned to the case's own `owner_user_id` (Decision D2), same
 * transaction. Event `roi.tracking_started`.
 */
export async function startRoiCaseTracking(
  input: StartRoiCaseTrackingInput
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
        capability: ROI_TRACKING_CAPABILITIES.start,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      if (currentRow.status !== 'approved') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only an "approved" case may start tracking`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'tracking' }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'tracking', row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[startRoiCaseTracking] update returned no row for ${caseId}`);
      }

      // Decision D2: same transaction as the status write.
      await createObligation(client, {
        organizationId,
        assigneeUserId: currentRow.owner_user_id,
        referenceType: 'roi_case',
        referenceId: caseId,
        aggregateVersionAtCreation: nextVersion,
        obligationType: TRACK_ROI_FORECAST_ACTUALS_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:roi_case:${caseId}:${TRACK_ROI_FORECAST_ACTUALS_OBLIGATION_TYPE}`,
      });

      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.tracking_started',
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
