/**
 * OKR-E002 — Set command layer.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.1-§4.7.
 * Schema: server/migrations/20260823_rvn_okr_set.sql.
 *
 * Sets are ABAC resources (unlike OKR-E001's Program/Cycle, which are plain
 * RBAC, Decision P2) — this file is the FIRST real writer of
 * `resource_type='okr_set'` rows in `rvn_platform_resource_visibility`/
 * `rvn_platform_resource_acl`. `createOkrSet` fails closed on no active
 * `domain='okr'` visibility policy, same two-step lookup
 * `createKpiDraft`/`createRoiCase` use (`getActiveVisibilityPolicy` then a
 * second query for `visibility_mode`/`default_scope_type` by `policy_id`).
 *
 * `createOkrSet`'s duplicate prevention (D3) copies the SAVEPOINT pattern
 * `createRoiCase` established literally: a cheap pre-check SELECT for the
 * non-racing path, then a SAVEPOINT-wrapped candidate INSERT for the racing
 * case, catching Postgres `23505` on
 * `ux_okr_vnext_sets_one_per_scope_cycle_owner` and `ROLLBACK TO SAVEPOINT`
 * before the retry SELECT — a naive catch-then-retry without the SAVEPOINT
 * fails with Postgres `25P02` (transaction aborted, commands ignored until
 * end of transaction block), a bug already hit once in this program.
 *
 * `narrowOkrSetVisibility` (D19) is its own command, deliberately permitted
 * in more statuses than content editing (`updateOkrSetDraft` stays
 * draft-only) because narrowing can only reduce exposure, never widen it —
 * `VISIBILITY_NARROWNESS_RANK`/`isVisibilityModeNarrowerOrEqual` are built
 * locally here (D12: no platform-level narrowing-only enforcement exists
 * anywhere in this repo, grep-confirmed — `allow_narrowing_only` is set
 * `true` by every writer but has zero enforcement code).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { createObligation } from '../platform/obligations.js';
import { getActiveVisibilityPolicy } from '../platform/visibilityResolver.js';

import {
  buildObjectivesSnapshotFragment,
  hasSufficientKeyResultCoverage,
  resolveOkrCyclePinnedPolicySnapshot,
} from './okrObjectiveCommands.js';
import { OKR_EVENT_SOURCE, OKR_VISIBILITY_DOMAIN } from './okrProgramCommands.js';
import type {
  OkrSetApprovalSnapshotPayload,
  OkrSetApprovedSnapshotRow,
} from './okrSetApprovedSnapshotTypes.js';
import {
  toOkrSetApprovedSnapshotSummary,
  type OkrSetApprovedSnapshotSummary,
} from './okrSetApprovedSnapshotTypes.js';
import {
  toOkrSet,
  type OkrSet,
  type OkrSetRow,
  type OkrSetScopeType,
  type OkrSetStatus,
} from './okrSetTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

export const OKR_SET_RESOURCE_TYPE = 'okr_set';

/** D14 obligation types, plan §13's obligation catalog named literally. */
export const DRAFT_OKR_SET_OBLIGATION_TYPE = 'draft_okr_set';
export const REVIEW_OKR_SET_OBLIGATION_TYPE = 'review_okr_set';

// ==========================================
// ERRORS
// ==========================================

/** Fail-closed error for `createOkrSet`/`narrowOkrSetVisibility` when no
 * active `domain='okr'` visibility policy exists for the organization —
 * never fabricate a default (mirrors `RoiCaseNoActiveVisibilityPolicyError`/
 * `KpiNoActiveVisibilityPolicyError`). */
export class OkrSetNoActiveVisibilityPolicyError extends Error {
  code = 'NO_ACTIVE_VISIBILITY_POLICY';
  details: Record<string, unknown>;
  constructor(organizationId: string, domain: string) {
    super(
      `No active visibility policy for organization ${organizationId}, domain "${domain}" — cannot create or narrow an OKR Set without one`
    );
    this.name = 'OkrSetNoActiveVisibilityPolicyError';
    this.details = { organizationId, domain };
  }
}

/** Generic invalid-state-transition / bad-input guard, mirrors
 * `OkrCycleValidationError`'s role in the Cycle command layer. */
export class OkrSetValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrSetValidationError';
    this.code = code;
    this.details = details;
  }
}

/** D10/D11: own class, not KPI/ROI's reused across domains — established
 * per-aggregate pattern (`SelfApprovalDeniedError` -> `RoiSelfApprovalDeniedError`
 * -> this one), never cross-domain reuse. Checks `submitted_by`/`created_by`
 * only — `owner_user_id`/`reviewer_user_id` not independently checked
 * (ROI-E003 D13 precedent: an owner may legitimately not be the submitter). */
export class OkrSetSelfApprovalDeniedError extends Error {
  code = 'SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(setId: string, approverId: string, reasonField: 'submitted_by' | 'created_by') {
    super(`User ${approverId} may not approve OKR Set ${setId}: matches its own ${reasonField}`);
    this.name = 'OkrSetSelfApprovalDeniedError';
    this.details = { setId, approverId, reasonField };
  }
}

/** D12: local narrowing-only enforcement — thrown before any write when a
 * caller-supplied `visibilityMode` is wider than the Program's active
 * `domain='okr'` policy ceiling. */
export class OkrSetVisibilityWideningDeniedError extends Error {
  code = 'VISIBILITY_WIDENING_DENIED';
  details: Record<string, unknown>;
  constructor(setId: string, candidateMode: string, ceilingMode: string) {
    super(
      `OKR Set ${setId}: visibility mode "${candidateMode}" is wider than the organization's "${ceilingMode}" ceiling — narrowing only`
    );
    this.name = 'OkrSetVisibilityWideningDeniedError';
    this.details = { setId, candidateMode, ceilingMode };
  }
}

/** Thrown by `submitOkrSetForApproval`'s eligibility-guard failure — carries
 * the `reason` string `isOkrSetReadyForSubmissionEligible` returns. Mapped
 * to 409, mirrors `RoiCaseNotReadyForReviewError`. */
export class OkrSetNotReadyForSubmissionError extends Error {
  code = 'NOT_READY_FOR_SUBMISSION';
  details: Record<string, unknown>;
  /**
   * OKR-E003 (design §11): `extraDetails` is an optional, backward-compatible
   * third param — `hasSufficientKeyResultCoverage`'s richer per-Objective
   * failure detail rides here without breaking this constructor's existing
   * two-arg call sites (E002's own `isOkrSetReadyForSubmissionEligible`
   * failure path above still calls it with just `(setId, reason)`).
   */
  constructor(setId: string, reason: string, extraDetails?: Record<string, unknown>) {
    super(`OKR Set ${setId} is not ready for submission: ${reason}`);
    this.name = 'OkrSetNotReadyForSubmissionError';
    this.details = { setId, reason, ...(extraDetails ?? {}) };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadOkrSetForUpdate(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<OkrSetRow | undefined> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  return result.rows[0];
}

async function loadOkrSetRow(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<OkrSetRow | undefined> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2`,
    [setId, organizationId]
  );
  return result.rows[0];
}

function setRowVersion(row: OkrSetRow): number {
  return row.row_version;
}

// ==========================================
// createOkrSet (OKR-F-004-AC-01/AC-02, design §4.1)
// ==========================================

export interface CreateOkrSetInput {
  organizationId: string;
  programId: string;
  cycleId: string;
  scopeType: OkrSetScopeType;
  scopeId: string;
  ownerUserId: string;
  reviewerUserId?: string | null;
  title: string;
  /** OKR-E007 (D17): non-null only when this Set is being created by
   * `carryForwardOkrSet` — the lineage pointer to the closed source Set.
   * Optional, backward-compatible addition (IO-6) — every existing E002
   * caller omits it and gets byte-for-byte identical behavior (NULL). */
  carriedFromSetId?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateOkrSetResult {
  set: OkrSet;
  /** `false` = a pre-existing, non-cancelled Set for this exact
   * (org, program, cycle, scope, owner) tuple was found and returned
   * instead of creating a new one (D3's uniqueness guarantee). */
  created: boolean;
}

async function loadOkrSetResult(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<CreateOkrSetResult> {
  const row = await loadOkrSetRow(client, setId, organizationId);
  if (!row) {
    throw new Error(`[createOkrSet] winning set ${setId} could not be re-read after SAVEPOINT rollback`);
  }
  return { set: toOkrSet(row), created: false };
}

/**
 * Design §4.1: fail-closed on no active `domain='okr'` visibility policy,
 * one INSERT into `okr_vnext_sets`, one `rvn_platform_resource_visibility`
 * row, ACL grants (`access_level='contribute'`) for `createdBy` and, if
 * different, `ownerUserId`, and a `draft_okr_set` obligation (D14) — all
 * inside the same `applyMutation` transaction.
 *
 * AC-01 concurrency (D3): a plain pre-check SELECT first (cheap, non-racing
 * path), then a SAVEPOINT-wrapped candidate INSERT for the racing case —
 * copied verbatim in shape from `createRoiCase`/
 * `kpiDeviationCommands.openOrEscalateDeviationCase`.
 */
export async function createOkrSet(
  input: CreateOkrSetInput
): Promise<AtomicCommandOutcome<CreateOkrSetResult>> {
  const {
    organizationId,
    programId,
    cycleId,
    scopeType,
    scopeId,
    ownerUserId,
    reviewerUserId = null,
    title,
    carriedFromSetId = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  // Design §4.1: "including company, where the caller passes
  // organizationId explicitly rather than the server silently defaulting
  // it, so the contract is visible at the call site" — validated for EVERY
  // scopeType, not just 'company'.
  if (!scopeId || !scopeId.trim()) {
    throw new OkrSetValidationError('scopeId is required (and must be explicit for scope_type=\'company\')', 'SCOPE_ID_REQUIRED', {
      scopeType,
    });
  }

  // Captured inside applyMutation, read by buildEvent — same closure
  // convention as kpiDefinitionCommands.ts's file header explains.
  let visibilityPolicyVersion: string | undefined;

  return executeAtomicCreate<CreateOkrSetResult>({
    organizationId,
    applyMutation: async (client) => {
      // Fail closed if no active visibility policy exists for this
      // org/domain — never fabricate a default (design §4.1).
      const policy = await getActiveVisibilityPolicy(client, {
        organizationId,
        domain: OKR_VISIBILITY_DOMAIN,
      });
      if (!policy) {
        throw new OkrSetNoActiveVisibilityPolicyError(organizationId, OKR_VISIBILITY_DOMAIN);
      }
      visibilityPolicyVersion = policy.policyVersion;

      const policyDetailsResult = await client.query<{ visibility_mode: string }>(
        `SELECT visibility_mode FROM rvn_platform_visibility_policies WHERE policy_id = $1`,
        [policy.policyId]
      );
      const policyDetails = policyDetailsResult.rows[0];
      if (!policyDetails) {
        throw new Error(
          `[createOkrSet] active policy ${policy.policyId} could not be re-read mid-transaction`
        );
      }

      // D3 cheap pre-check (non-racing path): a plain SELECT before ever
      // attempting the INSERT.
      const existingResult = await client.query<{ set_id: string }>(
        `SELECT set_id FROM okr_vnext_sets
          WHERE organization_id = $1 AND program_id = $2 AND cycle_id = $3
            AND scope_type = $4 AND scope_id = $5 AND owner_user_id = $6
            AND status <> 'cancelled'`,
        [organizationId, programId, cycleId, scopeType, scopeId, ownerUserId]
      );
      const existing = existingResult.rows[0];
      if (existing) {
        return loadOkrSetResult(client, existing.set_id, organizationId);
      }

      // -- Racing case: SAVEPOINT around the candidate INSERT so a caught
      // 23505 (unique violation on ux_okr_vnext_sets_one_per_scope_cycle_owner)
      // can ROLLBACK TO SAVEPOINT before the retry SELECT. Without the
      // SAVEPOINT, Postgres aborts the WHOLE transaction on the unique
      // violation and the retry SELECT itself fails with 25P02 (transaction
      // aborted) — verbatim precedent: createRoiCase's own "DEVIATION FROM
      // DESIGN" comment.
      await client.query('SAVEPOINT okr_set_create');
      let setRow: OkrSetRow;
      try {
        const insertResult = await client.query<OkrSetRow>(
          `INSERT INTO okr_vnext_sets
             (organization_id, program_id, cycle_id, scope_type, scope_id,
              owner_user_id, reviewer_user_id, title, carried_from_set_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [organizationId, programId, cycleId, scopeType, scopeId, ownerUserId, reviewerUserId, title, carriedFromSetId, createdBy]
        );
        const inserted = insertResult.rows[0];
        if (!inserted) {
          throw new Error('[createOkrSet] insert into okr_vnext_sets returned no row');
        }
        setRow = inserted;
        await client.query('RELEASE SAVEPOINT okr_set_create');
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT okr_set_create');
          const retryResult = await client.query<{ set_id: string }>(
            `SELECT set_id FROM okr_vnext_sets
              WHERE organization_id = $1 AND program_id = $2 AND cycle_id = $3
                AND scope_type = $4 AND scope_id = $5 AND owner_user_id = $6
                AND status <> 'cancelled'`,
            [organizationId, programId, cycleId, scopeType, scopeId, ownerUserId]
          );
          const winner = retryResult.rows[0];
          if (!winner) {
            throw new Error(
              `[createOkrSet] 23505 on ux_okr_vnext_sets_one_per_scope_cycle_owner but no winning row found for (${programId}, ${cycleId}, ${scopeType}, ${scopeId}, ${ownerUserId})`
            );
          }
          return loadOkrSetResult(client, winner.set_id, organizationId);
        }
        throw err;
      }

      // Design §4.1: write scope_type/scope_id on the visibility row ONLY
      // for scope_type='team' (D13's platform gap — resolveScopeVisibility/
      // buildVisibilityScopedCte's SCOPE branch only resolves scope_type=
      // 'team'; writing an unresolvable scope_type for company/business_unit/
      // individual would be dead data), NULL otherwise.
      const visibilityScopeType = scopeType === 'team' ? 'team' : null;
      const visibilityScopeId = scopeType === 'team' ? scopeId : null;

      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, scope_type, scope_id, owner_user_id, sensitivity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          OKR_SET_RESOURCE_TYPE,
          setRow.set_id,
          organizationId,
          policyDetails.visibility_mode,
          policy.policyId,
          visibilityScopeType,
          visibilityScopeId,
          ownerUserId,
          null,
        ]
      );

      // ACL grants (ROI-E001 D3's shape): creator gets a 'contribute' row;
      // if ownerUserId differs from createdBy, ownerUserId gets a second
      // one. No automatic grant to anyone else.
      await client.query(
        `INSERT INTO rvn_platform_resource_acl
           (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
         VALUES ($1, $2, 'user', $3, 'contribute', $3)`,
        [OKR_SET_RESOURCE_TYPE, setRow.set_id, createdBy]
      );
      if (ownerUserId !== createdBy) {
        await client.query(
          `INSERT INTO rvn_platform_resource_acl
             (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
           VALUES ($1, $2, 'user', $3, 'contribute', $4)`,
          [OKR_SET_RESOURCE_TYPE, setRow.set_id, ownerUserId, createdBy]
        );
      }

      // D14: draft_okr_set obligation, same transaction.
      await createObligation(client, {
        organizationId,
        assigneeUserId: ownerUserId,
        referenceType: OKR_SET_RESOURCE_TYPE,
        referenceId: setRow.set_id,
        aggregateVersionAtCreation: 1,
        obligationType: DRAFT_OKR_SET_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:${OKR_SET_RESOURCE_TYPE}:${setRow.set_id}:${DRAFT_OKR_SET_OBLIGATION_TYPE}`,
      });

      return { set: toOkrSet(setRow), created: true };
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { set: result.set };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.created',
        aggregateType: 'okr_set',
        aggregateId: result.set.setId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: visibilityPolicyVersion ?? '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.set.rowVersion,
        payload: { setId: result.set.setId, created: result.created },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateOkrSetDraft (design §4.2)
// ==========================================

/** Guard: `status IN ('draft','changes_requested')` only — not `'active'`
 * (D6; active content edits go through `recordOkrSetMaterialChange`).
 * Visibility is NOT changed here — that moved to `narrowOkrSetVisibility`
 * (D19). */
const OKR_SET_DRAFT_EDITABLE_STATUSES: readonly OkrSetStatus[] = ['draft', 'changes_requested'];

export interface UpdateOkrSetDraftInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  title?: string;
  ownerUserId?: string;
  reviewerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function updateOkrSetDraft(
  input: UpdateOkrSetDraftInput
): Promise<AtomicCommandOutcome<OkrSet>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    title,
    ownerUserId,
    reviewerUserId,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSetRow, OkrSet>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!OKR_SET_DRAFT_EDITABLE_STATUSES.includes(currentRow.status)) {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — draft fields may not be edited from this status`,
          'NOT_EDITABLE',
          { setId, status: currentRow.status }
        );
      }

      beforeState = { set: toOkrSet(currentRow) };

      const merged = {
        title: title ?? currentRow.title,
        ownerUserId: ownerUserId ?? currentRow.owner_user_id,
        reviewerUserId: reviewerUserId !== undefined ? reviewerUserId : currentRow.reviewer_user_id,
      };

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET title = $1, owner_user_id = $2, reviewer_user_id = $3,
                row_version = $4, updated_by = $5, updated_at = now()
          WHERE set_id = $6
          RETURNING *`,
        [merged.title, merged.ownerUserId, merged.reviewerUserId, nextVersion, actorUserId, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[updateOkrSetDraft] update returned no row for ${setId}`);
      }
      return toOkrSet(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { set: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.draft_edited',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// narrowOkrSetVisibility (D19, design §4.3)
// ==========================================

/** Rank order, narrowest last. `isVisibilityModeNarrowerOrEqual` returns
 * true when `candidateMode`'s rank is >= `ceilingMode`'s rank — i.e. the
 * candidate is at least as narrow as the Program's active `domain='okr'`
 * policy ceiling. D12: no platform-level enforcement of
 * `allow_narrowing_only` exists anywhere in this repo (grep-confirmed) —
 * built locally here, first real caller. */
export const VISIBILITY_NARROWNESS_RANK: Record<string, number> = {
  OPEN_ORG: 0,
  SCOPE: 1,
  MANAGEMENT_CHAIN: 2,
  RESTRICTED_ACL: 3,
  PRIVATE: 4,
};

/** True if `candidateMode` is at least as narrow as `ceilingMode` (the
 * Program's active `domain='okr'` policy mode). An unrecognized
 * `candidateMode` ranks `-1` (always fails, fail-closed); an unrecognized
 * `ceilingMode` ranks `Infinity` (nothing can be narrow enough, also
 * fail-closed) — this function must never treat an unknown mode string as
 * automatically acceptable. */
export function isVisibilityModeNarrowerOrEqual(candidateMode: string, ceilingMode: string): boolean {
  return (VISIBILITY_NARROWNESS_RANK[candidateMode] ?? -1) >= (VISIBILITY_NARROWNESS_RANK[ceilingMode] ?? Infinity);
}

/** D19: deliberately wider than `OKR_SET_DRAFT_EDITABLE_STATUSES` — a
 * live Set's owner may still narrow its own visibility; narrowing is
 * by-construction safe (it can only reduce exposure). */
const OKR_SET_NARROWABLE_STATUSES: readonly OkrSetStatus[] = [
  'draft',
  'changes_requested',
  'submitted',
  'approved',
  'active',
];

export interface NarrowOkrSetVisibilityInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  visibilityMode: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface NarrowOkrSetVisibilityResult {
  set: OkrSet;
  visibilityMode: string;
}

/**
 * Design §4.3: separate, narrow command changing only the visibility mode.
 * Violation of the narrowing-only rule throws
 * `OkrSetVisibilityWideningDeniedError` BEFORE any write. On success:
 * `UPDATE rvn_platform_resource_visibility` on the same pinned client — the
 * Set's own DOMAIN columns are untouched (D1: no `visibility_mode` column
 * exists on `okr_vnext_sets`). This implementation also advances
 * `okr_vnext_sets.row_version` (housekeeping columns only, no content
 * change) so the CAS/`resultingVersion` contract every other command in
 * this file honors stays consistent for subsequent callers — a deliberate,
 * narrow deviation from the design snippet's literal "no UPDATE at all",
 * stated here rather than silently decided.
 */
export async function narrowOkrSetVisibility(
  input: NarrowOkrSetVisibilityInput
): Promise<AtomicCommandOutcome<NarrowOkrSetVisibilityResult>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    visibilityMode,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSetRow, NarrowOkrSetVisibilityResult>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!OKR_SET_NARROWABLE_STATUSES.includes(currentRow.status)) {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — visibility may not be narrowed from this status`,
          'NOT_NARROWABLE',
          { setId, status: currentRow.status }
        );
      }

      const policy = await getActiveVisibilityPolicy(client, {
        organizationId,
        domain: OKR_VISIBILITY_DOMAIN,
      });
      if (!policy) {
        throw new OkrSetNoActiveVisibilityPolicyError(organizationId, OKR_VISIBILITY_DOMAIN);
      }
      const policyDetailsResult = await client.query<{ visibility_mode: string }>(
        `SELECT visibility_mode FROM rvn_platform_visibility_policies WHERE policy_id = $1`,
        [policy.policyId]
      );
      const ceilingMode = policyDetailsResult.rows[0]?.visibility_mode;
      if (!ceilingMode) {
        throw new Error(
          `[narrowOkrSetVisibility] active policy ${policy.policyId} could not be re-read mid-transaction`
        );
      }

      if (!isVisibilityModeNarrowerOrEqual(visibilityMode, ceilingMode)) {
        throw new OkrSetVisibilityWideningDeniedError(setId, visibilityMode, ceilingMode);
      }

      beforeState = { set: toOkrSet(currentRow) };

      await client.query(
        `UPDATE rvn_platform_resource_visibility
            SET visibility_mode = $1
          WHERE resource_type = $2 AND resource_id = $3::text`,
        [visibilityMode, OKR_SET_RESOURCE_TYPE, setId]
      );

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET row_version = $1, updated_by = $2, updated_at = now()
          WHERE set_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[narrowOkrSetVisibility] update returned no row for ${setId}`);
      }

      return { set: toOkrSet(updatedRow), visibilityMode };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { set: result.set, visibilityMode: result.visibilityMode };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.visibility_narrowed',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId, visibilityMode: result.visibilityMode },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// isOkrSetReadyForSubmissionEligible (D7) + submitOkrSetForApproval (design §4.4)
// ==========================================

/** E002's own check: a reviewer must be assigned. OKR-E003 is expected to
 * layer its ≥2-KR-per-Objective check on top, e.g.:
 *   isOkrSetReadyForSubmissionEligible(s) && hasSufficientKeyResultCoverage(s)
 * — do not replace this function's body when E003 lands; wrap it. */
export function isOkrSetReadyForSubmissionEligible(setRow: OkrSetRow): { eligible: boolean; reason?: string } {
  if (!setRow.reviewer_user_id) {
    return { eligible: false, reason: 'reviewer_not_assigned' };
  }
  return { eligible: true };
}

const OKR_SET_SUBMIT_FROM_STATUSES: readonly OkrSetStatus[] = ['draft', 'changes_requested'];

export interface SubmitOkrSetForApprovalInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function submitOkrSetForApproval(
  input: SubmitOkrSetForApprovalInput
): Promise<AtomicCommandOutcome<OkrSet>> {
  const {
    setId,
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

  return executeAtomicCommand<OkrSetRow, OkrSet>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!OKR_SET_SUBMIT_FROM_STATUSES.includes(currentRow.status)) {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — cannot submit for approval from there`,
          'INVALID_TRANSITION',
          { setId, currentStatus: currentRow.status }
        );
      }

      // E002's own check (untouched body, wrapped not replaced) — a
      // reviewer must be assigned.
      const check = isOkrSetReadyForSubmissionEligible(currentRow);
      if (!check.eligible) {
        throw new OkrSetNotReadyForSubmissionError(setId, check.reason ?? 'unspecified');
      }

      // OKR-E003 (design §11, D-E3-5, §-IO item 3): layered ON TOP of the
      // check above — every non-cancelled Objective on the Set must have
      // at least the Cycle's pinned kr_min_required non-cancelled KRs.
      // Enforced PER-OBJECTIVE, no company/BU/team special-casing
      // (§-IO item 6). `isOkrSetReadyForSubmissionEligible`'s own body
      // above is provably untouched — this is the ONLY new call, not a
      // replacement.
      const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, setId, organizationId);
      const krCoverage = await hasSufficientKeyResultCoverage(client, setId, organizationId, snapshot.krMinRequired);
      if (!krCoverage.eligible) {
        throw new OkrSetNotReadyForSubmissionError(setId, krCoverage.reason ?? 'unspecified', krCoverage.details);
      }

      beforeState = { set: toOkrSet(currentRow) };

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET status = 'submitted', submitted_by = $1, submitted_at = now(),
                row_version = $2, updated_by = $1, updated_at = now()
          WHERE set_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[submitOkrSetForApproval] update returned no row for ${setId}`);
      }

      // D14: review_okr_set obligation, assigned to reviewer_user_id
      // (non-null — guaranteed by the eligibility guard above).
      await createObligation(client, {
        organizationId,
        assigneeUserId: updatedRow.reviewer_user_id as string,
        referenceType: OKR_SET_RESOURCE_TYPE,
        referenceId: setId,
        aggregateVersionAtCreation: nextVersion,
        obligationType: REVIEW_OKR_SET_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:${OKR_SET_RESOURCE_TYPE}:${setId}:${REVIEW_OKR_SET_OBLIGATION_TYPE}`,
      });

      return toOkrSet(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { set: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.submitted',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// buildOkrSetApprovalSnapshotPayload (D8) + approveOkrSet (design §4.5)
// ==========================================

/** D8, widened by OKR-E003 (design §12): Set fields + the real,
 * point-in-time `objectives` array (was an empty placeholder through E002,
 * since Objectives/KRs didn't exist until this epic).
 * `buildObjectivesSnapshotFragment` (okrObjectiveCommands.ts) only READS
 * okr_vnext_objectives/okr_vnext_key_results on the SAME pinned client —
 * the immutability contract this function's caller (`approveOkrSet`)
 * already established (INSERT-only `okr_vnext_approved_snapshots`,
 * `REVOKE UPDATE/DELETE`) is untouched. */
export async function buildOkrSetApprovalSnapshotPayload(
  client: PoolClient,
  setRow: OkrSetRow
): Promise<OkrSetApprovalSnapshotPayload> {
  const objectives = await buildObjectivesSnapshotFragment(client, setRow.set_id, setRow.organization_id);
  return { set: toOkrSet(setRow), objectives };
}

export interface ApproveOkrSetInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  approverId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface ApproveOkrSetResult {
  set: OkrSet;
  snapshot: OkrSetApprovedSnapshotSummary;
}

export async function approveOkrSet(
  input: ApproveOkrSetInput
): Promise<AtomicCommandOutcome<ApproveOkrSetResult>> {
  const {
    setId,
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

  return executeAtomicCommand<OkrSetRow, ApproveOkrSetResult>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // 1. Self-approval denial — FIRST, before any write (D10/D11).
      if (currentRow.submitted_by === approverId) {
        throw new OkrSetSelfApprovalDeniedError(setId, approverId, 'submitted_by');
      }
      if (currentRow.created_by === approverId) {
        throw new OkrSetSelfApprovalDeniedError(setId, approverId, 'created_by');
      }

      // 2. Status guard.
      if (currentRow.status !== 'submitted') {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — only a Set "submitted" may be approved`,
          'NOT_SUBMITTED',
          { setId, status: currentRow.status }
        );
      }

      // 3. Build + hash the frozen payload (D8).
      const payload = await buildOkrSetApprovalSnapshotPayload(client, currentRow);
      const contentHash = computeStateHash(payload as unknown as Record<string, unknown>);

      // 4. Monotonic per-set sequence number — safe without its own lock;
      // the Set row's FOR UPDATE (executeAtomicCommand step 2) already
      // serializes concurrent approvals of the same Set.
      const sequenceResult = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
           FROM okr_vnext_approved_snapshots WHERE set_id = $1`,
        [setId]
      );
      const sequenceNumber = Number(sequenceResult.rows[0]?.next_sequence ?? 1);

      // 5. Insert the immutable snapshot row.
      const snapshotInsert = await client.query<OkrSetApprovedSnapshotRow>(
        `INSERT INTO okr_vnext_approved_snapshots
           (set_id, organization_id, sequence_number, approved_by, content_hash, snapshot_payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [setId, organizationId, sequenceNumber, approverId, contentHash, JSON.stringify(payload)]
      );
      const snapshotRow = snapshotInsert.rows[0];
      if (!snapshotRow) {
        throw new Error(`[approveOkrSet] insert into okr_vnext_approved_snapshots returned no row for ${setId}`);
      }

      beforeState = { set: toOkrSet(currentRow) };

      // 6. Set CAS update.
      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET status = 'approved', approved_by = $1, approved_at = now(),
                approved_version = $2, latest_approved_snapshot_id = $3,
                row_version = $4, updated_by = $1, updated_at = now()
          WHERE set_id = $5
          RETURNING *`,
        [approverId, sequenceNumber, snapshotRow.snapshot_id, nextVersion, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[approveOkrSet] update returned no row for ${setId}`);
      }

      return { set: toOkrSet(updatedRow), snapshot: toOkrSetApprovedSnapshotSummary(snapshotRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { set: result.set, snapshot: result.snapshot };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.approved',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId, snapshotId: result.snapshot.snapshotId, sequenceNumber: result.snapshot.sequenceNumber },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// requestChangesOnOkrSet (design §4.6)
// ==========================================

export interface RequestChangesOnOkrSetInput {
  setId: string;
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
 * No self-approval check — mirrors `rejectRoiCase`/`requestChangesOnRoiCase`
 * (declining someone else's submission isn't the conflict self-approval
 * denial exists to prevent).
 */
export async function requestChangesOnOkrSet(
  input: RequestChangesOnOkrSetInput
): Promise<AtomicCommandOutcome<OkrSet>> {
  const {
    setId,
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

  return executeAtomicCommand<OkrSetRow, OkrSet>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'submitted') {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — changes may only be requested on a Set "submitted"`,
          'NOT_SUBMITTED',
          { setId, status: currentRow.status }
        );
      }
      beforeState = { set: toOkrSet(currentRow) };

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET status = 'changes_requested', changes_requested_by = $1, changes_requested_at = now(),
                changes_requested_reason = $2, row_version = $3, updated_by = $1, updated_at = now()
          WHERE set_id = $4
          RETURNING *`,
        [actorUserId, changeRequestNotes, nextVersion, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[requestChangesOnOkrSet] update returned no row for ${setId}`);
      }
      return toOkrSet(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { set: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.changes_requested',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// runOkrSetLifecycleTransition — generic guarded transition (design §4.7)
// ==========================================

export interface OkrSetLifecycleTransitionSpec {
  eventType: string;
  fromStatuses: readonly OkrSetStatus[];
  toStatus: OkrSetStatus;
}

export interface RunOkrSetLifecycleTransitionInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string | null;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Mirrors OKR-E001's `runOkrCycleLifecycleTransition` exactly — every Set
 * status transition that changes ONLY `status` (activate/cancel) goes
 * through this one generic function, called with a literal `spec` per
 * endpoint.
 */
export async function runOkrSetLifecycleTransition(
  spec: OkrSetLifecycleTransitionSpec,
  input: RunOkrSetLifecycleTransitionInput
): Promise<AtomicCommandOutcome<OkrSet>> {
  const {
    setId,
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

  return executeAtomicCommand<OkrSetRow, OkrSet>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!spec.fromStatuses.includes(currentRow.status)) {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — cannot transition to "${spec.toStatus}" from there`,
          'INVALID_TRANSITION',
          { setId, currentStatus: currentRow.status, toStatus: spec.toStatus }
        );
      }

      beforeState = { set: toOkrSet(currentRow) };

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET status = $1, row_version = $2, updated_by = $3, updated_at = now()
          WHERE set_id = $4
          RETURNING *`,
        [spec.toStatus, nextVersion, actorUserId, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[${spec.eventType}] update returned no row for ${setId}`);
      }
      return toOkrSet(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { set: result };
      return {
        schemaVersion: 1,
        eventType: spec.eventType,
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Named transition specs (design §4.7) — routes import these literals.
// ==========================================

/** D9: repurposes the pre-existing `okr_set.published` placeholder event
 * key (RN-G1 scaffolding, `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS`)
 * as THIS transition's event — approved -> active is the "went live" moment,
 * structurally analogous to `okr_program.published`'s own semantics
 * (OKR-E001 §6.3: "the moment status flips to active"). Not `approveOkrSet`'s
 * event, which gets its own `okr_set.approved` key — approval-decision and
 * went-live are distinct moments even though adjacent. */
export const OKR_SET_ACTIVATE_SPEC: OkrSetLifecycleTransitionSpec = {
  eventType: 'okr_set.published',
  fromStatuses: ['approved'],
  toStatus: 'active',
};

/** D15: a design addition beyond the epic ledger's own AC table, stated
 * explicitly (not silent) — same class of addition OKR-E001 §6.5 made for
 * `okr_cycle.cancel`. A Set with no cancel path from any of its live states
 * would be a foreseeable gap the plan's own lifecycle diagram shows a
 * branch for. */
export const OKR_SET_CANCEL_SPEC: OkrSetLifecycleTransitionSpec = {
  eventType: 'okr_set.cancelled',
  fromStatuses: ['draft', 'submitted', 'changes_requested', 'approved', 'active'],
  toStatus: 'cancelled',
};

/** OKR-E007 (design §4.4, OKR-F-021/022). Called explicitly (Set Owner/
 * Program Admin) AND by the Cycle scheduler's `cascadeOkrSetsToReview`
 * (okrCycleScheduler.ts) when the parent Cycle transitions to `review` —
 * never implicitly inferred from the Cycle's own state alone (a Set
 * transition is always its own explicit command, matching every other
 * Cycle/Set coupling in this program). */
export const OKR_SET_OPEN_REVIEW_SPEC: OkrSetLifecycleTransitionSpec = {
  eventType: 'okr_set.review_opened',
  fromStatuses: ['active'],
  toStatus: 'review',
};

// ==========================================
// closeOkrSet (OKR-E007, OKR-F-021/022, D9-D11)
// ==========================================

export interface CloseOkrSetInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

interface CloseGateReflectionRow {
  objective_id: string;
  status: string;
  final_score: string | null;
  scoring_model_unsupported: boolean;
  what_worked: string | null;
  what_did_not_work: string | null;
  why: string | null;
  learning: string | null;
  next_cycle_change: string | null;
  disposition: string | null;
}

/**
 * Design §4.5, exact step ordering: (1) guard `status==='review'`; (2) load
 * the Cycle's PINNED policy snapshot (D11 — never the Program's live
 * current row); (3) `manager_review_required` gate; (4)
 * `self_review_required` gate; (5) `reflection_required_for_close` gate
 * (lists every offending Objective, not just the first); (6) finalize every
 * `status='draft'` reflection row for this Set in the SAME transaction;
 * (7) close the Set. **No self-close denial** (D10 — deliberate divergence
 * from ROI-E006's `RoiPirSelfCloseDeniedError`: OKR already has
 * `manager_review_required` feeding a real maker-checker gate
 * (`OkrManagerReviewSelfApprovalDeniedError`) directly into step 3 above —
 * when that policy is on, self-closing is already structurally blocked;
 * when it is off, the Program has explicitly opted out of that protection
 * and a parallel un-opt-outable check would silently override it).
 *
 * Imports from `okrReviewCommands.ts`/`okrReflectionCommands.ts` below
 * create a circular module reference back to THIS file (both of those
 * files import `OkrSetValidationError`/`OKR_SET_RESOURCE_TYPE` from here) —
 * safe under native ESM (this repo's `"type":"module"`, confirmed
 * `package.json`): every reference is used only inside function bodies,
 * never at module-evaluation time, so by the time any of these commands
 * actually runs the whole module graph has already finished loading.
 */
export async function closeOkrSet(input: CloseOkrSetInput): Promise<AtomicCommandOutcome<{ set: OkrSet }>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  // Deferred imports (not top-level) purely to keep the circular-import
  // note above visibly true at the exact call sites that rely on it — a
  // normal top-level import would work identically under ESM's live-
  // binding semantics, this is a readability choice, not a requirement.
  const { OkrSetManagerReviewRequiredError, OkrSetSelfReviewRequiredError } = await import('./okrReviewCommands.js');
  const { OkrSetReflectionRequiredError } = await import('./okrReflectionCommands.js');

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSetRow, { set: OkrSet }>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Step 1.
      if (currentRow.status !== 'review') {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — only a Set "review" may be closed`,
          'NOT_IN_REVIEW',
          { setId, status: currentRow.status }
        );
      }

      // Step 2 (D11) — pinned policy, never the Program's live row.
      const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, setId, organizationId);

      // Step 3.
      if (snapshot.managerReviewRequired) {
        const managerReview = await client.query<{ status: string }>(
          `SELECT status FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'manager'`,
          [setId, organizationId]
        );
        const row = managerReview.rows[0];
        if (!row || row.status !== 'approved') {
          throw new OkrSetManagerReviewRequiredError(setId);
        }
      }

      // Step 4.
      if (snapshot.selfReviewRequired) {
        const selfReview = await client.query<{ status: string }>(
          `SELECT status FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'self'`,
          [setId, organizationId]
        );
        const row = selfReview.rows[0];
        if (!row || row.status !== 'submitted') {
          throw new OkrSetSelfReviewRequiredError(setId);
        }
      }

      // Step 5.
      if (snapshot.reflectionRequiredForClose) {
        const objectivesResult = await client.query<{ objective_id: string }>(
          `SELECT objective_id FROM okr_vnext_objectives WHERE set_id = $1 AND organization_id = $2 AND status <> 'cancelled'`,
          [setId, organizationId]
        );
        const reflectionsResult = await client.query<CloseGateReflectionRow>(
          `SELECT objective_id, status, final_score, scoring_model_unsupported, what_worked, what_did_not_work,
                  why, learning, next_cycle_change, disposition
             FROM okr_vnext_reflections WHERE set_id = $1 AND organization_id = $2`,
          [setId, organizationId]
        );
        const reflectionByObjective = new Map(reflectionsResult.rows.map((r) => [r.objective_id, r]));
        const missingObjectiveIds: string[] = [];
        for (const objectiveRow of objectivesResult.rows) {
          const reflection = reflectionByObjective.get(objectiveRow.objective_id);
          const scoreComplete = !!reflection && (reflection.final_score !== null || reflection.scoring_model_unsupported);
          const narrativeComplete =
            !!reflection &&
            reflection.what_worked !== null &&
            reflection.what_did_not_work !== null &&
            reflection.why !== null &&
            reflection.learning !== null &&
            reflection.next_cycle_change !== null &&
            reflection.disposition !== null;
          if (!scoreComplete || !narrativeComplete) {
            missingObjectiveIds.push(objectiveRow.objective_id);
          }
        }
        if (missingObjectiveIds.length > 0) {
          throw new OkrSetReflectionRequiredError(setId, missingObjectiveIds);
        }
      }

      beforeState = { set: toOkrSet(currentRow) };

      // Step 6 — finalize every draft reflection for this Set, even if
      // `reflection_required_for_close=false` and some rows are incomplete
      // (an incomplete-but-existing reflection still finalizes; its NULL
      // fields simply stay NULL forever, matching D4's "frozen from
      // whatever state it was in at close").
      await client.query(
        `UPDATE okr_vnext_reflections
            SET status = 'finalized', finalized_by = $1, finalized_at = now(), row_version = row_version + 1
          WHERE set_id = $2 AND status = 'draft'`,
        [actorUserId, setId]
      );

      // Step 7.
      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET status = 'closed', row_version = $1, updated_by = $2, updated_at = now()
          WHERE set_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[closeOkrSet] update returned no row for ${setId}`);
      }

      return { set: toOkrSet(updatedRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { set: result.set };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.closed',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId },
      } satisfies AtomicEventInput;
    },
  });
}
