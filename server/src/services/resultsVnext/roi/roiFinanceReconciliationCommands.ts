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

export const FINANCE_PROJECTION_RECONCILIATION_ACTOR = 'system:finance_projection_consumer';
export const FINANCE_PROJECTION_RECONCILIATION_SOURCE = 'results.finance_projection_consumer';

const FINANCE_PROJECTION_SOURCE_EVENT_TYPES = new Set([
  'roi.case_approved',
  'roi.forecast_published',
  'roi.actual_snapshot_published',
  'roi.finance_link_created',
]);

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
  authorityKind?: 'human' | 'finance_projection'; sourceEventId?: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** GAP 2 fix (FIN-MVP-RECONCILIATION-001), CORRECTED by CTO-directed binding
 * design (successor to the original 280efb0bd8 fix): idempotency-key replay
 * guard for `updateRoiFinanceReconciliationStatus`, sibling to
 * `reconciliationRequestFingerprint` above (open's own check). NOTE this is
 * NOT the same mechanism as open's: open pre-checks its OWN domain table
 * (`rvn_roi_finance_reconciliations`, which stores `idempotency_key` +
 * `request_fingerprint` written once at INSERT time by open itself). The
 * reconciliation row this command UPDATEs has no per-update-command
 * fingerprint column — adding one is out of bounds for this fix (no new
 * column, no migration). So the check this fingerprint feeds is a NEW,
 * narrowly-scoped direct read of the platform event log
 * (`rvn_platform_events`) done in `precheckUpdateStatusReplay` below, BEFORE
 * `executeAtomicCommand`'s own aggregate CAS — not a mirror of open's
 * domain-table check and not a change to the shared `executeAtomicCommand`
 * primitive in atomicWrite.ts.
 *
 * THE FULL TUPLE, all seven fields — binding design, not a convenience
 * narrowing: `expectedVersion`, `caseId`, `status`, `resolutionNotes`,
 * `actorUserId`, `organizationId`, `idempotencyKey`. A fingerprint missing
 * any one of these would let a materially different request masquerade as a
 * replay of an earlier one, which is exactly the failure this exists to
 * prevent — the original 280efb0bd8 fix's 5-field tuple (missing
 * `expectedVersion` and `idempotencyKey` itself, and keyed on
 * `reconciliationId` rather than `caseId`) is what this successor corrects. */
function updateStatusRequestFingerprint(input: {
  expectedVersion: number;
  caseId: string;
  status: RoiFinanceReconciliationStatus;
  resolutionNotes: string | null;
  actorUserId: string;
  organizationId: string;
  idempotencyKey: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function deterministicGrantReceiptId(organizationId: string, idempotencyKey: string): string {
  const hex = createHash('sha256').update(`rvn-finance-owner-grant:${organizationId}:${idempotencyKey}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

export async function recordFinanceOwnerGrantEvent(input: {
  organizationId: string;
  userId: string;
  action: 'granted' | 'revoked';
  actorUserId: string;
  idempotencyKey: string;
  access: CommandAccessContext;
}): Promise<{ receiptId: string; grantVersion: number; action: 'granted' | 'revoked'; outcome: 'applied' | 'replayed' }> {
  const { acquirePgClient } = await import('../../../database/PostgresDatabase.js');
  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await assertActiveTenantMember(client, input.organizationId, input.actorUserId);
    await assertActiveTenantMember(client, input.organizationId, input.userId);
    if (input.actorUserId === input.userId) {
      throw new RoiFinanceReconciliationValidationError('Finance-owner grants require a distinct tenant governor.', 'FINANCE_OWNER_GRANT_SELF_DENIED');
    }
    if (!input.idempotencyKey.trim()) {
      throw new RoiFinanceReconciliationValidationError('A non-empty idempotency key is required.', 'IDEMPOTENCY_KEY_REQUIRED');
    }
    if (!input.access.capabilities.includes('*')) {
      throw new RoiFinanceReconciliationValidationError('Only tenant governance may append Finance-owner grants.', 'FINANCE_OWNER_GRANT_GOVERNANCE_REQUIRED');
    }
    const receiptId = deterministicGrantReceiptId(input.organizationId, input.idempotencyKey.trim());
    // The receipt key is globally unique. Fence on it before the tenant/user
    // transition lock so two different fingerprints racing on one key yield
    // a stable collision rather than a raw unique-constraint failure.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [receiptId]);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [input.organizationId, input.userId]);
    const replay = await client.query<{
      organization_id: string; user_id: string; action: 'granted' | 'revoked'; acted_by: string;
      grant_version: number; policy_version: string; policy_digest: string;
    }>(`SELECT organization_id,user_id,action,acted_by,grant_version,policy_version,policy_digest
          FROM rvn_finance_reconciliation_grant_events WHERE receipt_id=$1`, [receiptId]);
    if (replay.rowCount) {
      const row = replay.rows[0]!;
      const exact = row.organization_id === input.organizationId && row.user_id === input.userId &&
        row.action === input.action && row.acted_by === input.actorUserId &&
        row.policy_version === FINANCE_RECONCILIATION_POLICY.version && row.policy_digest === FINANCE_RECONCILIATION_POLICY.digest;
      if (!exact) {
        throw new RoiFinanceReconciliationValidationError(
          'Finance-owner grant idempotency key was already used for a different command.',
          'FINANCE_OWNER_GRANT_IDEMPOTENCY_COLLISION'
        );
      }
      await client.query('COMMIT');
      return { receiptId, grantVersion: row.grant_version, action: row.action, outcome: 'replayed' };
    }
    const current = await client.query<{ action: string; grant_version: number }>(
      `SELECT action, grant_version FROM rvn_finance_reconciliation_grant_events
        WHERE organization_id=$1 AND user_id=$2 AND capability=$3
        ORDER BY grant_version DESC LIMIT 1`,
      [input.organizationId, input.userId, ROI_FINANCE_RECONCILIATION_CAPABILITIES.resolve]
    );
    if (current.rows[0]?.action === input.action) {
      throw new RoiFinanceReconciliationValidationError('Grant ledger transition would not change governed state.', 'FINANCE_OWNER_GRANT_INVALID_TRANSITION');
    }
    if (current.rows[0]?.action === 'revoked' && input.action === 'granted') {
      throw new RoiFinanceReconciliationValidationError(
        'Finance-owner revocation is irreversible; create a new governed identity instead.',
        'FINANCE_OWNER_REVOCATION_IRREVERSIBLE'
      );
    }
    const grantVersion = (current.rows[0]?.grant_version ?? 0) + 1;
    await client.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
        (organization_id,user_id,capability,grant_version,action,acted_by,receipt_id,policy_version,policy_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.organizationId, input.userId, ROI_FINANCE_RECONCILIATION_CAPABILITIES.resolve,
        grantVersion, input.action, input.actorUserId, receiptId,
        FINANCE_RECONCILIATION_POLICY.version, FINANCE_RECONCILIATION_POLICY.digest]
    );
    await client.query('COMMIT');
    return { receiptId, grantVersion, action: input.action, outcome: 'applied' };
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

export type OpenRoiFinanceProjectionReconciliationInput = Omit<
  OpenRoiFinanceReconciliationInput,
  'actorUserId' | 'actorEffectiveRole' | 'access' | 'correlationId' | 'causationId'
> & {
  sourceEventId: string;
};

type ReconciliationAuthority =
  | { kind: 'human'; access: CommandAccessContext }
  | { kind: 'finance_projection'; sourceEventId: string };

export async function openRoiFinanceReconciliation(
  input: OpenRoiFinanceReconciliationInput
): Promise<AtomicCommandOutcome<RoiFinanceReconciliation>> {
  return openRoiFinanceReconciliationWithAuthority(input, { kind: 'human', access: input.access });
}

export async function openRoiFinanceReconciliationFromProjection(
  input: OpenRoiFinanceProjectionReconciliationInput
): Promise<AtomicCommandOutcome<RoiFinanceReconciliation>> {
  return openRoiFinanceReconciliationWithAuthority(
    {
      ...input,
      actorUserId: FINANCE_PROJECTION_RECONCILIATION_ACTOR,
      actorEffectiveRole: 'system',
      correlationId: input.sourceEventId,
      causationId: input.sourceEventId,
      access: { capabilities: [], platformRole: null },
    },
    { kind: 'finance_projection', sourceEventId: input.sourceEventId }
  );
}

async function openRoiFinanceReconciliationWithAuthority(
  input: OpenRoiFinanceReconciliationInput,
  authority: ReconciliationAuthority
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
      if (authority.kind === 'human') {
        await assertActiveTenantMember(client, organizationId, actorUserId);
      } else {
        const sourceEvent = await client.query<{ event_type: string }>(
          `SELECT event_type FROM rvn_platform_events
            WHERE event_id=$1 AND organization_id=$2 AND aggregate_id=$3 AND aggregate_type='roi_case'`,
          [authority.sourceEventId, organizationId, caseId]
        );
        if (
          !sourceEvent.rows[0] ||
          !FINANCE_PROJECTION_SOURCE_EVENT_TYPES.has(sourceEvent.rows[0].event_type)
        ) {
          throw new RoiFinanceReconciliationValidationError(
            'A persisted tenant-bound ROI source event is required for system reconciliation.',
            'FINANCE_PROJECTION_SOURCE_EVENT_REQUIRED',
            { sourceEventId: authority.sourceEventId, organizationId, caseId }
          );
        }
      }

      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
      if (authority.kind === 'human') {
        assertCommandCapability({
          access: authority.access,
          actorUserId,
          capability: ROI_FINANCE_RECONCILIATION_CAPABILITIES.open,
          responsibleUserIds: [caseOwnerUserId],
        });
      }

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
      const isCurrencyMismatch = divergenceReason === 'currency_mismatch';
      if (
        !isCurrencyMismatch &&
        !(divergencePercent > FINANCE_RECONCILIATION_POLICY.materialityThresholdPercent)
      ) {
        throw new RoiFinanceReconciliationValidationError(
          'Finance divergence must be strictly greater than 5%.',
          'FINANCE_RECONCILIATION_WITHIN_TOLERANCE',
          { divergencePercent }
        );
      }
      const requestFingerprint = reconciliationRequestFingerprint({
        organizationId, caseId, financeLinkId, actorUserId, roiValue, financeValue,
        reconciliationKind, divergenceReason,
        authorityKind: authority.kind,
        sourceEventId: authority.kind === 'finance_projection' ? authority.sourceEventId : null,
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
        source: authority.kind === 'finance_projection'
          ? FINANCE_PROJECTION_RECONCILIATION_SOURCE
          : ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: {
          caseId,
          reconciliationId: result.reconciliationId,
          reconciliationKind: result.reconciliationKind,
          decisionPolicyVersion: result.decisionPolicyVersion,
          decisionPolicyDigest: result.decisionPolicyDigest,
          authorityKind: authority.kind,
          sourceEventId: authority.kind === 'finance_projection' ? authority.sourceEventId : null,
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

/** Read-only replay/auth preflight. The real command reloads the aggregate
 * with `FOR UPDATE` inside `executeAtomicCommand` before applying CAS. */
async function loadReconciliationForReplay(
  client: PoolClient,
  reconciliationId: string,
  organizationId: string
): Promise<RoiFinanceReconciliationRow | undefined> {
  const result = await client.query<RoiFinanceReconciliationRow>(
    `SELECT * FROM rvn_roi_finance_reconciliations WHERE reconciliation_id = $1 AND organization_id = $2`,
    [reconciliationId, organizationId]
  );
  return result.rows[0];
}

type UpdateStatusRaceHooks = {
  afterPrecheck?: () => Promise<void>;
  onLoadExistingResult?: () => void;
};

let updateStatusRaceHooksForTest: UpdateStatusRaceHooks | undefined;

/** Deterministic concurrency seam for the real-PG race contract. It is
 * deliberately inert outside NODE_ENV=test and never changes production
 * command inputs or persistence semantics. */
export function setUpdateStatusRaceHooksForTest(hooks?: UpdateStatusRaceHooks): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Update-status race hooks are test-only.');
  }
  updateStatusRaceHooksForTest = hooks;
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
 * that decides which event this command fires.
 *
 * GAP 2 fix, CTO-corrected ordering (binding design — order IS the design;
 * SECOND corrective applied here fixes two further defects an independent
 * audit found in the first corrective, 280efb0bd8 → c44303afc7):
 *   1. AUTH/TENANT/RESOURCE VALIDATION FIRST. Nothing else runs before
 *      these — a replay must never be served to a caller who was not
 *      entitled to the original operation.
 *   2. THEN a full-fingerprint (all seven fields — see
 *      `updateStatusRequestFingerprint`'s doc comment) lookup against a
 *      prior committed event for this idempotency key — BEFORE the
 *      terminal-state rejection (DEFECT 1 fix, this corrective: the prior
 *      version ran the terminal check before this lookup, so a
 *      byte-identical retry against a row its own first call had already
 *      resolved was rejected as an error instead of replayed) and BEFORE
 *      `executeAtomicCommand`'s own aggregate CAS (its `loadForUpdate` row
 *      lock) even runs. The original 280efb0bd8 fix ran this check INSIDE
 *      `applyMutation`, i.e. AFTER the CAS lock had already been taken —
 *      so a duplicate call still contended on the aggregate row lock. This
 *      corrects that: `precheckUpdateStatusReplay` below runs on its own,
 *      separate, read-only client and uses a SELECT without FOR UPDATE,
 *      strictly before `executeAtomicCommand` is even called, so a genuine
 *      duplicate call performs ZERO writes and takes no aggregate row lock.
 *   3. A fingerprint MISMATCH on the same idempotency key throws
 *      `IDEMPOTENCY_FINGERPRINT_CONFLICT`, from that same pre-check, also
 *      before any lock.
 *   4. No prior event for this key → NOW the terminal-state rejection runs
 *      (moved here by the DEFECT 1 fix — see step 2's note); still no
 *      prior event → the pre-check returns `'proceed'` and this function
 *      falls through to `executeAtomicCommand` below exactly as before.
 *      That call's own `ON CONFLICT (organization_id, idempotency_key) DO
 *      NOTHING` + `loadExistingResult` race fallback — for a genuinely
 *      concurrent race (two callers on TWO DIFFERENT aggregate rows, so no
 *      CAS lock serializes them, both clearing this pre-check before
 *      either has committed) — now ALSO compares the winner's persisted
 *      fingerprint against the loser's own request (DEFECT 2 fix, this
 *      corrective: see `loadExistingResult` below) instead of blindly
 *      handing back the winner's result. */
async function precheckUpdateStatusReplay(
  input: UpdateRoiFinanceReconciliationStatusInput
): Promise<
  | { type: 'replay'; outcome: AtomicCommandOutcome<RoiFinanceReconciliation> }
  | { type: 'proceed' }
> {
  const {
    reconciliationId,
    caseId,
    organizationId,
    expectedVersion,
    status,
    resolutionNotes,
    actorUserId,
    idempotencyKey,
    access,
  } = input;

  const { acquirePgClient } = await import('../../../database/PostgresDatabase.js');
  const client = await acquirePgClient();
  try {
    // 1) AUTH/TENANT/RESOURCE VALIDATION FIRST — identical checks to
    // `applyMutation` below, run here on a plain (non-CAS) read so an
    // unauthorized or invalid caller is rejected before any fingerprint
    // lookup or replay is even considered.
    const currentRow = await loadReconciliationForReplay(client, reconciliationId, organizationId);
    if (!currentRow || currentRow.case_id !== caseId) {
      throw new RoiFinanceReconciliationNotFoundError(reconciliationId, organizationId);
    }

    await assertActiveTenantMember(client, organizationId, actorUserId);

    const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
    const isTerminalTransition = ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES.includes(status);
    // CTO corrective, DEFECT 1 fix: the terminal-state rejection
    // (`FINANCE_RECONCILIATION_ALREADY_TERMINAL`) used to sit HERE, before
    // the fingerprint lookup below — so an exact, byte-identical retry of a
    // call that had ALREADY driven this row into a terminal status was
    // rejected as an error instead of replayed. Idempotency is precisely
    // the promise that a repeat is harmless; a terminal state must not turn
    // a harmless repeat into a failure. Auth/tenant/resource validation
    // (already correct) stays here, ahead of the lookup; the terminal check
    // itself moves to AFTER the lookup — see the 'no prior event' branch
    // below. Only a genuinely NEW request (no prior event for this key) is
    // still rejected against an already-terminal row; an exact replay skips
    // it entirely.
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

    // 2) THEN the full-fingerprint replay lookup — BEFORE the terminal-state
    // rejection (Defect 1 fix, order IS the design) and BEFORE the aggregate
    // CAS (unchanged from the prior corrective).
    const mergedNotes = resolutionNotes !== undefined ? resolutionNotes : currentRow.resolution_notes;
    const candidateFingerprint = updateStatusRequestFingerprint({
      expectedVersion,
      caseId,
      status,
      resolutionNotes: mergedNotes,
      actorUserId,
      organizationId,
      idempotencyKey,
    });

    const priorEvent = await client.query<{
      event_id: string;
      resulting_version: number;
      payload: { requestFingerprint?: string } | null;
      after_state: { reconciliation?: RoiFinanceReconciliation } | null;
    }>(
      `SELECT event_id, resulting_version, payload, after_state
         FROM rvn_platform_events WHERE organization_id = $1 AND idempotency_key = $2`,
      [organizationId, idempotencyKey]
    );
    const existing = priorEvent.rows[0];
    if (existing) {
      if (existing.payload?.requestFingerprint !== candidateFingerprint) {
        throw new AtomicWriteConflictError(
          'Idempotency key was already used for a different canonical request.',
          'IDEMPOTENCY_FINGERPRINT_CONFLICT'
        );
      }
      // EXACT match on all seven fields — flat replay, zero writes, no
      // lock. Reached even when currentRow.status is now terminal: this
      // branch returns BEFORE the terminal-state check below ever runs
      // (Defect 1's direct fix).
      const replayResult = existing.after_state?.reconciliation;
      if (!replayResult) {
        throw new Error(
          `[updateRoiFinanceReconciliationStatus] replay event ${existing.event_id} has no reconciliation result`
        );
      }
      return {
        type: 'replay',
        outcome: {
          outcome: 'duplicate',
          eventId: existing.event_id,
          resultingVersion: existing.resulting_version,
          result: replayResult,
        },
      };
    }

    // 3) No prior event for this key — a genuinely NEW request, never seen
    // before under this idempotency key. ONLY now is the terminal-state
    // rejection evaluated (Defect 1 fix: moved from before the lookup to
    // here). A fresh transition attempt against an already-terminal row is
    // still rejected exactly as before; only a genuine replay of an
    // already-committed call bypasses it.
    if (ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES.includes(currentRow.status)) {
      throw new RoiFinanceReconciliationValidationError('A terminal reconciliation cannot transition again.', 'FINANCE_RECONCILIATION_ALREADY_TERMINAL');
    }

    return { type: 'proceed' };
  } finally {
    client.release();
  }
}

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

  // Binding design, order IS the design (see precheckUpdateStatusReplay's
  // own doc comment above): auth/tenant/resource validation, THEN a
  // full-fingerprint replay check, BOTH strictly before
  // executeAtomicCommand's own aggregate CAS below. A flat exact replay, or
  // an IDEMPOTENCY_FINGERPRINT_CONFLICT rejection, is returned here with
  // ZERO writes and no row lock — neither outcome ever reaches the
  // aggregate.
  const precheck = await precheckUpdateStatusReplay(input);
  if (precheck.type === 'replay') {
    return precheck.outcome;
  }

  // Test-only barrier used to make two different aggregates clear the
  // replay precheck before either reaches the event-key race. Production has
  // no hook, so this is a zero-cost no-op there.
  await updateStatusRaceHooksForTest?.afterPrecheck?.();

  let beforeState: Record<string, unknown> | null = null;
  let isTerminalTransition = false;
  // Captured inside applyMutation below (DEFECT 2 fix) so `loadExistingResult`
  // — reached only on the ON CONFLICT DO NOTHING race-fallback path — can
  // recompute exactly the fingerprint THIS call's own request would have
  // produced, without needing to reload/re-merge notes from a currentRow it
  // no longer has access to.
  let capturedMergedResolutionNotes: string | null = null;

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
      // NOTE (order disagreement, reviewed and judged safe — not a defect):
      // this terminal check still runs BEFORE the grant/capability check
      // here, while `precheckUpdateStatusReplay` above now runs its own
      // copy of this same check AFTER them (Defect 1 fix). Both orderings
      // are individually safe — this block re-enforces every check under a
      // real CAS row lock regardless of order, so nothing unauthorized ever
      // gets applied — but the two sites disagree with each other, which
      // affects only WHICH error surfaces in a narrow, genuinely-fresh-
      // request race (e.g. an unauthorized actor hitting an already-
      // terminal row). Left as-is; flagged here so the next reader isn't
      // surprised by the mismatch.
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
      capturedMergedResolutionNotes = mergedNotes;

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
      // The SAME seven-field formula precheckUpdateStatusReplay uses to
      // decide replay vs. conflict — stored in payload here so a FUTURE
      // call reusing this idempotency_key can be matched against it.
      const requestFingerprint = updateStatusRequestFingerprint({
        expectedVersion,
        caseId,
        status,
        resolutionNotes: result.resolutionNotes,
        actorUserId,
        organizationId,
        idempotencyKey,
      });
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
          // Fed by the SAME seven-field formula precheckUpdateStatusReplay
          // reads back on a FUTURE call reusing this idempotency_key.
          requestFingerprint,
        },
      } satisfies AtomicEventInput;
    },
    // Race fallback — reached only when THIS call's own INSERT INTO
    // rvn_platform_events lost the (organization_id, idempotency_key)
    // unique race to a concurrent caller. Genuinely possible here because
    // no CAS lock serializes two DIFFERENT aggregate rows (two DIFFERENT
    // reconciliations) against each other — only same-row calls contend on
    // `loadForUpdate`'s row lock. Originally (280efb0bd8) this handed back
    // whichever result the WINNER committed, unconditionally — so a
    // different reconciliation's caller could get a plausible-looking
    // 'duplicate' result for a request that never actually ran, with
    // nothing in the logs ever revealing it.
    //
    // DEFECT 2 fix (this corrective): before returning the winner's result,
    // COMPARE the winner's persisted seven-field fingerprint
    // (payload.requestFingerprint, written by buildEvent above) against the
    // fingerprint THIS call's own request would have produced — using
    // `capturedMergedResolutionNotes`, set inside `applyMutation` above
    // (this call's applyMutation DID run, and DID compute its own
    // mergedNotes, before losing the race at the event-insert step; that
    // write is already rolled back by the time this callback runs, but the
    // captured value survives in closure). An exact match means this really
    // was the ordinary concurrent-retry case `updateStatusRequestFingerprint`
    // already covers — return the winner's result. Any mismatch means two
    // materially different requests collided on one idempotency_key — raise
    // `IDEMPOTENCY_FINGERPRINT_CONFLICT`, the same code the pre-check above
    // raises for the sequential-retry case, rather than fabricate a result.
    // `ExistingEventRow` (atomicWrite.ts) does not carry `payload` — a
    // deliberate, separate read below, not a change to that shared type.
    loadExistingResult: async (client, existingEvent) => {
      updateStatusRaceHooksForTest?.onLoadExistingResult?.();
      const candidateFingerprint = updateStatusRequestFingerprint({
        expectedVersion,
        caseId,
        status,
        resolutionNotes: capturedMergedResolutionNotes,
        actorUserId,
        organizationId,
        idempotencyKey,
      });
      const payloadResult = await client.query<{
        payload: { requestFingerprint?: string } | null;
      }>(`SELECT payload FROM rvn_platform_events WHERE event_id = $1`, [existingEvent.event_id]);
      const persistedFingerprint = payloadResult.rows[0]?.payload?.requestFingerprint;
      if (persistedFingerprint !== candidateFingerprint) {
        throw new AtomicWriteConflictError(
          'Idempotency key was already used for a different canonical request.',
          'IDEMPOTENCY_FINGERPRINT_CONFLICT'
        );
      }

      // EXACT match — mirrors openRoiFinanceReconciliation's own
      // loadExistingResult above: the winner's after_state is
      // `{ reconciliation: {...} }`, not the flat RoiFinanceReconciliation
      // shape every caller of this command expects, so unwrap it here.
      const afterState = existingEvent.after_state as {
        reconciliation?: RoiFinanceReconciliation;
      } | null;
      if (!afterState?.reconciliation) {
        throw new Error(
          `[updateRoiFinanceReconciliationStatus] replay event ${existingEvent.event_id} has no reconciliation result`
        );
      }
      return afterState.reconciliation;
    },
  });
}
