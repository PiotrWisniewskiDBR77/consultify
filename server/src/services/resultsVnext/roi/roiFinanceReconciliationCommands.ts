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
import { createHash, randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { AtomicWriteConflictError, executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

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

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_FINANCE_RECONCILIATION_CAPABILITIES = {
  open: 'results.roi.finance_reconciliation.open',
  updateStatus: 'results.roi.finance_reconciliation.update_status',
  resolve: 'results.roi.finance_reconciliation.resolve',
} as const;

export const FINANCE_RECONCILIATION_POLICY = {
  version: 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
  digest: 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
  materialityThresholdPercent: 5,
} as const;

async function loadRoiCaseOwnerUserId(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<string | null> {
  const result = await client.query<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

async function assertActiveTenantMember(client: PoolClient, organizationId: string, userId: string): Promise<void> {
  const membership = await client.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 AND upper(status) = 'ACTIVE'`,
    [organizationId, userId]
  );
  if (!membership.rowCount) {
    throw new RoiFinanceReconciliationValidationError(
      'An active tenant membership is required.',
      'ACTIVE_TENANT_MEMBERSHIP_REQUIRED',
      { organizationId, userId }
    );
  }
}

async function hasActiveExplicitFinanceOwnerGrant(client: PoolClient, organizationId: string, userId: string): Promise<boolean> {
  const result = await client.query<{ action: string }>(
    `SELECT action FROM rvn_finance_reconciliation_grant_events
      WHERE organization_id=$1 AND user_id=$2 AND capability=$3
      ORDER BY grant_version DESC LIMIT 1`,
    [organizationId, userId, ROI_FINANCE_RECONCILIATION_CAPABILITIES.resolve]
  );
  return result.rows[0]?.action === 'granted';
}

function reconciliationRequestFingerprint(input: {
  organizationId: string; caseId: string; financeLinkId: string; actorUserId: string;
  roiValue: number; financeValue: number; reconciliationKind: string; divergenceReason: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function recordFinanceOwnerGrantEvent(input: {
  organizationId: string;
  userId: string;
  action: 'granted' | 'revoked';
  actorUserId: string;
  access: CommandAccessContext;
}): Promise<{ receiptId: string; grantVersion: number; action: 'granted' | 'revoked' }> {
  const { acquirePgClient } = await import('../../../database/PostgresDatabase.js');
  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await assertActiveTenantMember(client, input.organizationId, input.actorUserId);
    await assertActiveTenantMember(client, input.organizationId, input.userId);
    if (!input.access.capabilities.includes('*')) {
      throw new RoiFinanceReconciliationValidationError('Only tenant governance may append Finance-owner grants.', 'FINANCE_OWNER_GRANT_GOVERNANCE_REQUIRED');
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [input.organizationId, input.userId]);
    const current = await client.query<{ action: string; grant_version: number }>(
      `SELECT action, grant_version FROM rvn_finance_reconciliation_grant_events
        WHERE organization_id=$1 AND user_id=$2 AND capability=$3
        ORDER BY grant_version DESC LIMIT 1`,
      [input.organizationId, input.userId, ROI_FINANCE_RECONCILIATION_CAPABILITIES.resolve]
    );
    if (current.rows[0]?.action === input.action) {
      throw new RoiFinanceReconciliationValidationError('Grant ledger transition would not change governed state.', 'FINANCE_OWNER_GRANT_INVALID_TRANSITION');
    }
    const grantVersion = (current.rows[0]?.grant_version ?? 0) + 1;
    const receiptId = randomUUID();
    await client.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
        (organization_id,user_id,capability,grant_version,action,acted_by,receipt_id,policy_version,policy_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.organizationId, input.userId, ROI_FINANCE_RECONCILIATION_CAPABILITIES.resolve,
        grantVersion, input.action, input.actorUserId, receiptId,
        FINANCE_RECONCILIATION_POLICY.version, FINANCE_RECONCILIATION_POLICY.digest]
    );
    await client.query('COMMIT');
    return { receiptId, grantVersion, action: input.action };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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
  reconciliationKind?: 'proposal' | 'dispute';
  divergenceReason?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
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
    reconciliationKind = 'dispute',
    divergenceReason = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RoiFinanceReconciliation>({
    organizationId,
    applyMutation: async (client) => {
      // The table permits only one open reconciliation per Finance link. A
      // retried create must therefore serialize on its tenant/idempotency key
      // before the domain INSERT; otherwise the domain unique index can fire
      // before executeAtomicCreate reaches its event-level replay guard.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        organizationId,
        idempotencyKey,
      ]);
      await assertActiveTenantMember(client, organizationId, actorUserId);

      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_FINANCE_RECONCILIATION_CAPABILITIES.open,
        responsibleUserIds: [caseOwnerUserId],
      });

      const linkResult = await client.query<{ link_id: string }>(
        `SELECT link_id FROM rvn_roi_finance_links WHERE link_id = $1 AND case_id = $2 AND organization_id = $3`,
        [financeLinkId, caseId, organizationId]
      );
      if (!linkResult.rows[0]) {
        throw new RoiFinanceLinkNotFoundError(financeLinkId, caseId);
      }

      const base = Math.abs(roiValue);
      const divergencePercent = base === 0
        ? (financeValue === 0 ? 0 : Number.POSITIVE_INFINITY)
        : (Math.abs(financeValue - roiValue) / base) * 100;
      if (!(divergencePercent > FINANCE_RECONCILIATION_POLICY.materialityThresholdPercent)) {
        throw new RoiFinanceReconciliationValidationError(
          'Finance divergence must be strictly greater than 5%.',
          'FINANCE_RECONCILIATION_WITHIN_TOLERANCE',
          { divergencePercent }
        );
      }
      const requestFingerprint = reconciliationRequestFingerprint({
        organizationId, caseId, financeLinkId, actorUserId, roiValue, financeValue,
        reconciliationKind, divergenceReason,
      });
      const replay = await client.query<RoiFinanceReconciliationRow>(
        `SELECT * FROM rvn_roi_finance_reconciliations
          WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [organizationId, idempotencyKey]
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_fingerprint !== requestFingerprint || replay.rows[0].request_actor_id !== actorUserId) {
          throw new AtomicWriteConflictError('Idempotency key was already used for a different canonical request.', 'IDEMPOTENCY_FINGERPRINT_CONFLICT');
        }
        return toRoiFinanceReconciliation(replay.rows[0]);
      }

      const insertResult = await client.query<RoiFinanceReconciliationRow>(
         `INSERT INTO rvn_roi_finance_reconciliations (
           case_id, organization_id, finance_link_id, roi_value, finance_value,
           reconciliation_kind, materiality_threshold_pct,
           decision_policy_version, decision_policy_digest,
           divergence_reason, status, opened_by, request_fingerprint, request_actor_id, idempotency_key
         ) VALUES ($1,$2,$3,$4,$5,$6,5,$7,$8,$9,'open',$10,$11,$10,$12)
         RETURNING *`,
        [caseId, organizationId, financeLinkId, roiValue, financeValue,
          reconciliationKind, FINANCE_RECONCILIATION_POLICY.version, FINANCE_RECONCILIATION_POLICY.digest,
          divergenceReason, actorUserId, requestFingerprint, idempotencyKey]
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
        policyVersion: `${FINANCE_RECONCILIATION_POLICY.version}@${FINANCE_RECONCILIATION_POLICY.digest}`,
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: {
          caseId,
          reconciliationId: result.reconciliationId,
          reconciliationKind: result.reconciliationKind,
          decisionPolicyVersion: result.decisionPolicyVersion,
          decisionPolicyDigest: result.decisionPolicyDigest,
        },
      } satisfies AtomicEventInput;
    },
    loadExistingResult: async (_client, existingEvent) => {
      const afterState = existingEvent.after_state as { reconciliation?: RoiFinanceReconciliation } | null;
      if (!afterState?.reconciliation) {
        throw new Error(
          `[openRoiFinanceReconciliation] replay event ${existingEvent.event_id} has no reconciliation result`
        );
      }
      return afterState.reconciliation;
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
  access: CommandAccessContext;
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
    access,
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

      await assertActiveTenantMember(client, organizationId, actorUserId);

      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
      beforeState = { reconciliation: toRoiFinanceReconciliation(currentRow) };

      isTerminalTransition = ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES.includes(status);
      if (ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES.includes(currentRow.status)) {
        throw new RoiFinanceReconciliationValidationError('A terminal reconciliation cannot transition again.', 'FINANCE_RECONCILIATION_ALREADY_TERMINAL');
      }
      if (isTerminalTransition) {
        if (!(await hasActiveExplicitFinanceOwnerGrant(client, organizationId, actorUserId))) {
          throw new RoiFinanceReconciliationValidationError('An explicit active Finance-owner grant is required.', 'FINANCE_OWNER_GRANT_REQUIRED');
        }
      } else {
        assertCommandCapability({ access, actorUserId, capability: ROI_FINANCE_RECONCILIATION_CAPABILITIES.updateStatus, responsibleUserIds: [caseOwnerUserId] });
      }
      if (isTerminalTransition && currentRow.opened_by === actorUserId) {
        throw new RoiFinanceReconciliationValidationError(
          'The actor who opened a Finance reconciliation may not resolve or accept it.',
          'FINANCE_RECONCILIATION_SELF_RESOLUTION_DENIED'
        );
      }
      const mergedNotes = resolutionNotes !== undefined ? resolutionNotes : currentRow.resolution_notes;
      const terminalDecisionId = isTerminalTransition ? randomUUID() : currentRow.terminal_decision_id;
      if (isTerminalTransition) {
        await client.query(
          `INSERT INTO rvn_finance_reconciliation_decisions (
             decision_id, reconciliation_id, organization_id, decision_version,
             decision_status, resolution_notes, decided_by,
             decision_policy_version, decision_policy_digest
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [terminalDecisionId, reconciliationId, organizationId, nextVersion,
            status, mergedNotes, actorUserId,
            FINANCE_RECONCILIATION_POLICY.version, FINANCE_RECONCILIATION_POLICY.digest]
        );
      }

      const updateResult = await client.query<RoiFinanceReconciliationRow>(
        `UPDATE rvn_roi_finance_reconciliations
            SET status = $1, resolution_notes = $2,
                resolved_by = CASE WHEN $3 THEN $4 ELSE resolved_by END,
                resolved_at = CASE WHEN $3 THEN now() ELSE resolved_at END,
                terminal_decision_id = CASE WHEN $3 THEN $5 ELSE terminal_decision_id END,
                terminal_decision_version = CASE WHEN $3 THEN $6 ELSE terminal_decision_version END,
                terminal_decision_status = CASE WHEN $3 THEN $1 ELSE terminal_decision_status END,
                row_version = $6
          WHERE reconciliation_id = $7
          RETURNING *`,
        [status, mergedNotes, isTerminalTransition, actorUserId, terminalDecisionId, nextVersion, reconciliationId]
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
        policyVersion: `${result.decisionPolicyVersion}@${result.decisionPolicyDigest}`,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: {
          caseId,
          reconciliationId,
          decisionPolicyVersion: result.decisionPolicyVersion,
          decisionPolicyDigest: result.decisionPolicyDigest,
          terminalDecisionId: result.terminalDecisionId,
          terminalDecisionVersion: result.terminalDecisionVersion,
        },
      } satisfies AtomicEventInput;
    },
  });
}
