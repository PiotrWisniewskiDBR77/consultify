/**
 * ROI-E007 — Finance-reconciliation command layer (AC-03: a reconciliation
 * record instead of silent sync).
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4, Decision D1.
 *
 * `openRoiFinanceReconciliation` — `executeAtomicCreate`, validates
 * `financeLinkId` belongs to the case, `status='open'` always on creation.
 * No `NON_EDITABLE_STATUSES` case guard (same as `roiVarianceCommands.ts`'s
 * `recordVariance`/`updateVarianceStatus` — a reconciliation is a durable
 * fact about a discovered divergence, legitimately raised at any point in
 * the case's lifecycle, most plausibly DURING tracking/benefits-realization
 * when Finance's own numbers start moving independently of ROI's).
 *
 * `updateRoiFinanceReconciliationStatus` (Decision D1) — `executeAtomicCommand`,
 * CAS on the reconciliation's OWN `row_version`, direct template copy of
 * `roiVarianceCommands.ts`'s `updateVarianceStatus` ("CAS on the child, not
 * the parent case"). Event fan-out DIFFERS by target status (design §4): a
 * transition INTO 'resolved'/'accepted_divergence' (terminal) fires
 * `roi.finance_reconciliation_resolved` (fans to `finance_projection` too);
 * every other transition (i.e. into 'investigating') fires the lighter
 * `roi.finance_reconciliation_status_updated` (`mywork_projection` only).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiFinanceReconciliation,
  ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES,
  type RoiFinanceReconciliation,
  type RoiFinanceReconciliationRow,
  type RoiFinanceReconciliationStatus,
} from './roiFinanceSeamTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiFinanceLinkNotFoundError extends Error {
  code = 'FINANCE_LINK_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(linkId: string, caseId: string) {
    super(`Finance link ${linkId} not found on case ${caseId}`);
    this.name = 'RoiFinanceLinkNotFoundError';
    this.details = { linkId, caseId };
  }
}

export class RoiFinanceReconciliationNotFoundError extends Error {
  code = 'FINANCE_RECONCILIATION_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(reconciliationId: string, organizationId: string) {
    super(`Finance reconciliation ${reconciliationId} not found in organization ${organizationId}`);
    this.name = 'RoiFinanceReconciliationNotFoundError';
    this.details = { reconciliationId, organizationId };
  }
}

export class RoiFinanceReconciliationValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_FINANCE_RECONCILIATION_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiFinanceReconciliationValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// openRoiFinanceReconciliation
// ==========================================

export interface OpenRoiFinanceReconciliationInput {
  caseId: string;
  organizationId: string;
  financeLinkId: string;
  roiValue: number;
  financeValue: number;
  divergenceReason?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function openRoiFinanceReconciliation(
  input: OpenRoiFinanceReconciliationInput
): Promise<AtomicCommandOutcome<RoiFinanceReconciliation>> {
  const {
    caseId,
    organizationId,
    financeLinkId,
    roiValue,
    financeValue,
    divergenceReason = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<RoiFinanceReconciliation>({
    organizationId,
    applyMutation: async (client) => {
      const linkResult = await client.query<{ link_id: string }>(
        `SELECT link_id FROM rvn_roi_finance_links WHERE link_id = $1 AND case_id = $2 AND organization_id = $3`,
        [financeLinkId, caseId, organizationId]
      );
      if (!linkResult.rows[0]) {
        throw new RoiFinanceLinkNotFoundError(financeLinkId, caseId);
      }

      const insertResult = await client.query<RoiFinanceReconciliationRow>(
        `INSERT INTO rvn_roi_finance_reconciliations (
           case_id, organization_id, finance_link_id, roi_value, finance_value,
           divergence_reason, status, opened_by
         ) VALUES ($1,$2,$3,$4,$5,$6,'open',$7)
         RETURNING *`,
        [caseId, organizationId, financeLinkId, roiValue, financeValue, divergenceReason, actorUserId]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[openRoiFinanceReconciliation] insert returned no row');
      return toRoiFinanceReconciliation(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { reconciliation: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.finance_reconciliation_opened',
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
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, reconciliationId: result.reconciliationId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateRoiFinanceReconciliationStatus (Decision D1)
// ==========================================

async function loadReconciliationForUpdate(
  client: PoolClient,
  reconciliationId: string,
  organizationId: string
): Promise<RoiFinanceReconciliationRow | undefined> {
  const result = await client.query<RoiFinanceReconciliationRow>(
    `SELECT * FROM rvn_roi_finance_reconciliations WHERE reconciliation_id = $1 AND organization_id = $2 FOR UPDATE`,
    [reconciliationId, organizationId]
  );
  return result.rows[0];
}
const reconciliationRowVersion = (row: RoiFinanceReconciliationRow) => row.row_version;

export interface UpdateRoiFinanceReconciliationStatusInput {
  reconciliationId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  status: RoiFinanceReconciliationStatus;
  resolutionNotes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** CAS on the reconciliation's OWN `row_version` — direct copy of
 * `updateVarianceStatus`'s "CAS on the child, not the parent case" shape.
 * Writable: `status`/`resolutionNotes`; `resolvedBy`/`resolvedAt` are set
 * by THIS command (not caller-supplied) exactly when the target status is
 * one of `ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES`
 * ('resolved'/'accepted_divergence') — the same terminal/non-terminal split
 * that decides which event this command fires. */
export async function updateRoiFinanceReconciliationStatus(
  input: UpdateRoiFinanceReconciliationStatusInput
): Promise<AtomicCommandOutcome<RoiFinanceReconciliation>> {
  const {
    reconciliationId,
    caseId,
    organizationId,
    expectedVersion,
    status,
    resolutionNotes,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;
  let isTerminalTransition = false;

  return executeAtomicCommand<RoiFinanceReconciliationRow, RoiFinanceReconciliation>({
    organizationId,
    aggregateId: reconciliationId,
    expectedVersion,
    loadForUpdate: loadReconciliationForUpdate,
    getCurrentVersion: reconciliationRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.case_id !== caseId) {
        throw new RoiFinanceReconciliationNotFoundError(reconciliationId, organizationId);
      }
      beforeState = { reconciliation: toRoiFinanceReconciliation(currentRow) };

      isTerminalTransition = ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES.includes(status);
      const mergedNotes = resolutionNotes !== undefined ? resolutionNotes : currentRow.resolution_notes;

      const updateResult = await client.query<RoiFinanceReconciliationRow>(
        `UPDATE rvn_roi_finance_reconciliations
            SET status = $1, resolution_notes = $2,
                resolved_by = CASE WHEN $3 THEN $4 ELSE resolved_by END,
                resolved_at = CASE WHEN $3 THEN now() ELSE resolved_at END,
                row_version = $5
          WHERE reconciliation_id = $6
          RETURNING *`,
        [status, mergedNotes, isTerminalTransition, actorUserId, nextVersion, reconciliationId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[updateRoiFinanceReconciliationStatus] update returned no row for ${reconciliationId}`);
      }
      return toRoiFinanceReconciliation(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { reconciliation: result };
      // Decision D1's event fan-out split: terminal transitions
      // (resolved/accepted_divergence) fire the heavier, Finance-facing
      // event; every other transition (e.g. into 'investigating') fires the
      // lighter mywork-only event.
      const eventType = isTerminalTransition
        ? 'roi.finance_reconciliation_resolved'
        : 'roi.finance_reconciliation_status_updated';
      return {
        schemaVersion: 1,
        eventType,
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
        payload: { caseId, reconciliationId },
      } satisfies AtomicEventInput;
    },
  });
}
