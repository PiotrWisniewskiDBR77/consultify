/**
 * Presentation Studio Layout Capacity Admin Service (Sprint S17).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S13-3.
 *
 * Closes R-S13-3: SuperAdmin-only admin surface for the layout-capacity
 * registry built in S13. Before S17 the registry exposed `applyOverrides`
 * directly to in-process callers (tests + future surfaces) but had no
 * authenticated, audited entry point — every override was effectively
 * a code-only change.
 *
 * S17 wraps the registry in the canonical `proposal -> approval ->
 * execution -> audit` invariant the Studio uses for every other
 * mutating endpoint:
 *
 *   1. SuperAdmin calls `proposeLayoutCapacityOverrides` with a
 *      payload + reason. The service runs the registry's strict
 *      validator BUT does NOT mutate state. On success it mints a
 *      single-use approval ticket bound to the SuperAdmin's
 *      organization, user id, and a payload fingerprint that includes
 *      the overrides AND the reason text. On validation failure it
 *      returns a structured 412 with the error list.
 *   2. SuperAdmin calls `executeLayoutCapacityOverrides` with the
 *      ticket id + the SAME payload. The service redeems the ticket
 *      atomically, applies the overrides through the registry, and
 *      records an audit log entry tagged
 *      `presentation_studio_layout_capacity_overrides_applied` with
 *      the payload diff, reason, and ticket id.
 *
 * Tenant safety note:
 *   - The registry is currently PROCESS-GLOBAL (R-S13-1 still open).
 *     A SuperAdmin override applied via this service therefore
 *     affects every tenant served by this Node process. The SuperAdmin
 *     RBAC capability `presentation_admin_layout_capacity` is the
 *     deliberate gate. The audit row records the SuperAdmin's org for
 *     traceability but the change itself is NOT scoped to that org.
 *
 * The service is pure and side-effect-free outside the (mockable)
 * audit writer. All clock and ticket interactions go through the same
 * approval-ticket service the S6 generate flow uses, so ticket
 * semantics (TTL, single-use, tenant-bind, user-bind, payload-bind)
 * are identical.
 */

import {
  type ApprovalTicketRejectionReason,
  computePayloadFingerprint,
  consumeApprovalTicket,
  mintApprovalTicket,
  type PresentationStudioApprovalTicket,
} from './presentationStudioApprovalTicketService.js';
import {
  applyOverrides,
  getCurrentRegistrySnapshot,
  type LayoutCapacityApplyResult,
  type LayoutCapacityOverridesPayload,
  type LayoutCapacityRegistrySnapshot,
  resetToDefaults,
} from './presentationStudioLayoutCapacityRegistryService.js';

// ---------------------------------------------------------------------------
// Audit dependency
// ---------------------------------------------------------------------------

/**
 * Audit payload shape mirrors the S6 generate audit so the audit_logs
 * table consumer (DB schema) sees the same column shape regardless of
 * which mutating Studio endpoint emitted it.
 */
export interface PresentationStudioLayoutCapacityAuditPayload {
  userId: string;
  organizationId: string;
  actionType: 'presentation_studio_layout_capacity_overrides_applied';
  resourceType: 'presentation_studio_layout_capacity_registry';
  /** The ticket id used to authorize this execution. Stable, request-scoped. */
  resourceId: string;
  details: {
    ticketId: string;
    payloadFingerprint: string;
    reason: string | null;
    /**
     * The override payload as the SuperAdmin sent it (post-validation,
     * pre-merge). Recorded verbatim so the audit row is self-contained
     * and can be replayed.
     */
    overrides: LayoutCapacityOverridesPayload;
    /**
     * Snapshot of the registry AFTER the overrides were applied. Lets
     * an auditor reconstruct the exact state without re-running
     * `applyOverrides` against the pre-S17 baseline.
     */
    registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
  };
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type PresentationStudioLayoutCapacityAuditFn = (
  payload: PresentationStudioLayoutCapacityAuditPayload
) => Promise<void>;

interface AdminDependencies {
  recordAudit: PresentationStudioLayoutCapacityAuditFn;
}

let _adminDeps: AdminDependencies | null = null;

async function defaultRecordAudit(
  payload: PresentationStudioLayoutCapacityAuditPayload
): Promise<void> {
  const { run: dbRun } = await import('../utils/DbPromise.js');
  await dbRun(
    `INSERT INTO audit_logs (id, timestamp, user_id, action_type, resource_type, resource_id, organization_id, details, ip_address, user_agent, created_at)
     VALUES (gen_random_uuid()::TEXT, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      payload.userId,
      payload.actionType,
      payload.resourceType,
      payload.resourceId,
      payload.organizationId,
      JSON.stringify(payload.details ?? {}),
      payload.ipAddress || null,
      payload.userAgent || null,
    ]
  );
}

function getAdminDeps(): AdminDependencies {
  return _adminDeps ?? { recordAudit: defaultRecordAudit };
}

/**
 * Test-only helper: swap out the audit writer for the duration of a
 * test. Production code MUST NOT call this. Pass `null` to reset to
 * the real defaults.
 */
export function _setLayoutCapacityAdminDependenciesForTests(deps: AdminDependencies | null): void {
  _adminDeps = deps;
}

// ---------------------------------------------------------------------------
// Propose
// ---------------------------------------------------------------------------

export interface ProposeLayoutCapacityOverridesInput {
  organizationId: string;
  userId: string;
  overrides: LayoutCapacityOverridesPayload;
  /**
   * Free-form text the SuperAdmin records for the audit row. Optional
   * but strongly encouraged (the audit downstream consumer renders it
   * as the human-readable change-control note).
   */
  reason?: string | null;
  ttlMs?: number;
  now?: Date;
}

export type ProposeLayoutCapacityOverridesResult =
  | {
      ok: true;
      ticket: PresentationStudioApprovalTicket;
      payloadFingerprint: string;
      /** Echo of the validated payload so the client knows what it committed to. */
      overrides: LayoutCapacityOverridesPayload;
    }
  | {
      ok: false;
      code: 'INVALID_OVERRIDES_PAYLOAD';
      reason: 'validation_failed';
      errors: LayoutCapacityApplyResult['errors'];
    };

/**
 * Validate an overrides payload via the registry's strict validator
 * WITHOUT mutating state, then mint a single-use approval ticket bound
 * to the proposed payload.
 *
 * Validation is performed against a transient "dry-run" snapshot — we
 * call `applyOverrides`, observe the validation outcome, and reset the
 * registry IF validation succeeded (the registry is process-global so
 * we cannot leave the proposal partially applied). This keeps the
 * service side-effect-free at the registry level. The reset is a
 * no-op when validation fails because `applyOverrides` already
 * short-circuits without mutating state on error.
 *
 * NOTE on the dry-run mechanism: we cannot just "validate without
 * applying" because the registry's strict validator is internal to
 * `applyOverrides`. Rather than duplicating the validator, we apply
 * and roll back. The roll-back uses the snapshot taken BEFORE the
 * apply call. This is safe inside a single Node process because the
 * registry is in-memory + synchronous; concurrent callers see only the
 * pre-apply or post-apply state, never an intermediate.
 *
 * The execution path (`executeLayoutCapacityOverrides`) re-applies the
 * SAME payload after redeeming the ticket, so the dry-run roll-back
 * does not lose information.
 */
export function proposeLayoutCapacityOverrides(
  input: ProposeLayoutCapacityOverridesInput
): ProposeLayoutCapacityOverridesResult {
  const before = getCurrentRegistrySnapshot();
  const apply = applyOverrides(input.overrides);
  if (!apply.ok) {
    return {
      ok: false,
      code: 'INVALID_OVERRIDES_PAYLOAD',
      reason: 'validation_failed',
      errors: apply.errors,
    };
  }
  // Roll back to the pre-apply snapshot. We bypass `resetToDefaults`
  // because that ignores any prior in-process overrides. Instead we
  // selectively re-apply the BEFORE snapshot via a synthetic
  // overrides payload that exhaustively replays it. We round-trip
  // through `applyOverrides` to keep the only state-mutation path
  // funneled through the registry's validator.
  rollbackRegistryTo(before);

  const fingerprint = computePayloadFingerprint({
    overrides: input.overrides,
    reason: input.reason ?? null,
  });
  const ticket = mintApprovalTicket({
    organizationId: input.organizationId,
    userId: input.userId,
    payloadFingerprint: fingerprint,
    ttlMs: input.ttlMs,
    now: input.now,
  });
  return {
    ok: true,
    ticket,
    payloadFingerprint: fingerprint,
    overrides: input.overrides,
  };
}

/**
 * Replay a snapshot back into the registry. The registry exposes
 * `applyOverrides` (additive merge) and `resetToDefaults` (drops all
 * overrides), but no "set state" method — so to roll back from a
 * dry-run we synthesize an overrides payload from the snapshot and
 * apply it after a defaults reset.
 *
 * The `densityBudgets` slot is replayed as full caps (every field
 * present), so the merge result equals the snapshot exactly.
 *
 * This helper is internal — callers MUST go through
 * `proposeLayoutCapacityOverrides` so the dry-run + roll-back pair
 * stays atomic with respect to a single proposal call.
 */
function rollbackRegistryTo(snapshot: LayoutCapacityRegistrySnapshot): void {
  // The BEFORE snapshot may already include earlier admin overrides
  // beyond the canonical defaults. To make the replay exact, we first
  // reset to defaults (drops every prior override) and then re-apply
  // the snapshot fields exhaustively.
  const replay: LayoutCapacityOverridesPayload = {
    densityBudgets: {
      visual: { ...snapshot.densityBudgets.visual },
      balanced: { ...snapshot.densityBudgets.balanced },
      document: { ...snapshot.densityBudgets.document },
    },
    templateFamilyOverrides: snapshot.templateFamilyOverrides,
    familyAliasByDeckType: snapshot.familyAliasByDeckType,
  };
  resetToDefaults();
  applyOverrides(replay);
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export interface ExecuteLayoutCapacityOverridesInput {
  organizationId: string;
  userId: string;
  ticketId: string;
  overrides: LayoutCapacityOverridesPayload;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export type ExecuteLayoutCapacityOverridesResult =
  | {
      ok: true;
      result: {
        ticketId: string;
        registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
        auditEvent: 'presentation_studio_layout_capacity_overrides_applied';
      };
    }
  | {
      ok: false;
      code: 'INVALID_APPROVAL_TICKET';
      reason: ApprovalTicketRejectionReason;
    }
  | {
      ok: false;
      code: 'INVALID_OVERRIDES_PAYLOAD';
      reason: 'validation_failed';
      errors: LayoutCapacityApplyResult['errors'];
    };

/**
 * Atomically redeem an approval ticket and apply the overrides
 * payload. Records an audit log entry on success. On any ticket
 * failure (not_found, expired, consumed, tenant_mismatch,
 * user_mismatch, payload_mismatch) NO override is applied and NO
 * audit event is emitted.
 *
 * The payload is re-validated even though it was validated at
 * proposal time — defense in depth in case the registry's defaults
 * shifted between propose and execute (e.g. a parallel SuperAdmin
 * landed an override that conflicts with this one's family alias).
 */
export async function executeLayoutCapacityOverrides(
  input: ExecuteLayoutCapacityOverridesInput
): Promise<ExecuteLayoutCapacityOverridesResult> {
  const expectedFingerprint = computePayloadFingerprint({
    overrides: input.overrides,
    reason: input.reason ?? null,
  });
  const consume = consumeApprovalTicket({
    ticketId: input.ticketId,
    organizationId: input.organizationId,
    userId: input.userId,
    expectedFingerprint,
    now: input.now,
  });
  if (!consume.ok) {
    return {
      ok: false,
      code: 'INVALID_APPROVAL_TICKET',
      reason: consume.reason,
    };
  }

  const apply = applyOverrides(input.overrides);
  if (!apply.ok) {
    // Defense-in-depth: ticket was redeemed (single-use), so we cannot
    // un-redeem. We surface the validation error to the caller so they
    // know the ticket is gone AND no override landed.
    return {
      ok: false,
      code: 'INVALID_OVERRIDES_PAYLOAD',
      reason: 'validation_failed',
      errors: apply.errors,
    };
  }

  const snapshotAfter = getCurrentRegistrySnapshot();
  const deps = getAdminDeps();
  await deps.recordAudit({
    userId: input.userId,
    organizationId: input.organizationId,
    actionType: 'presentation_studio_layout_capacity_overrides_applied',
    resourceType: 'presentation_studio_layout_capacity_registry',
    resourceId: consume.ticket.ticketId,
    details: {
      ticketId: consume.ticket.ticketId,
      payloadFingerprint: expectedFingerprint,
      reason: input.reason ?? null,
      overrides: input.overrides,
      registrySnapshotAfter: snapshotAfter,
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    ok: true,
    result: {
      ticketId: consume.ticket.ticketId,
      registrySnapshotAfter: snapshotAfter,
      auditEvent: 'presentation_studio_layout_capacity_overrides_applied',
    },
  };
}
