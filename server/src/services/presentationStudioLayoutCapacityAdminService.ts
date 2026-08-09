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
 *   - Since S23 the registry supports organization-scoped runtime
 *     overrides. The SuperAdmin/admin routes pass their authenticated
 *     `organizationId` into this service, so override/reset actions
 *     affect only that tenant's live registry view. Global/default
 *     helper calls remain available for tests and canonical defaults.
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
 *
 * Sprint S19 — extended to a discriminated union covering both
 *   - `presentation_studio_layout_capacity_overrides_applied` (S17 action)
 *   - `presentation_studio_layout_capacity_overrides_reset`   (S19 action)
 *
 * The shared columns (`userId`, `organizationId`, `resourceType`,
 * `resourceId`, `ipAddress`, `userAgent`) match exactly so the audit
 * writer is a single function regardless of which mutation fired.
 */
export type PresentationStudioLayoutCapacityActionType =
  | 'presentation_studio_layout_capacity_overrides_applied'
  | 'presentation_studio_layout_capacity_overrides_reset';

export interface PresentationStudioLayoutCapacityAuditPayloadBase {
  userId: string;
  organizationId: string;
  resourceType: 'presentation_studio_layout_capacity_registry';
  /** The ticket id used to authorize this execution. Stable, request-scoped. */
  resourceId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PresentationStudioLayoutCapacityOverridesAppliedAuditPayload extends PresentationStudioLayoutCapacityAuditPayloadBase {
  actionType: 'presentation_studio_layout_capacity_overrides_applied';
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
}

export interface PresentationStudioLayoutCapacityOverridesResetAuditPayload extends PresentationStudioLayoutCapacityAuditPayloadBase {
  actionType: 'presentation_studio_layout_capacity_overrides_reset';
  details: {
    ticketId: string;
    payloadFingerprint: string;
    reason: string | null;
    /**
     * Snapshot of the registry BEFORE the reset fired. This is the
     * full state that was wiped — recorded verbatim so an auditor
     * (or a recovery flow) can replay the exact configuration that
     * was in effect at reset time.
     */
    registrySnapshotBefore: LayoutCapacityRegistrySnapshot;
    /**
     * Snapshot of the registry AFTER the reset (== canonical
     * defaults). Captured for completeness and to make the diff
     * obvious in audit-log readers without joining against the
     * defaults table.
     */
    registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
  };
}

export type PresentationStudioLayoutCapacityAuditPayload =
  | PresentationStudioLayoutCapacityOverridesAppliedAuditPayload
  | PresentationStudioLayoutCapacityOverridesResetAuditPayload;

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
  const before = getCurrentRegistrySnapshot(input.organizationId);
  const apply = applyOverrides(input.overrides, input.organizationId);
  if (apply.ok === false) {
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
  rollbackRegistryTo(before, input.organizationId);

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
function rollbackRegistryTo(
  snapshot: LayoutCapacityRegistrySnapshot,
  organizationId?: string | null
): void {
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
  resetToDefaults(organizationId);
  applyOverrides(replay, organizationId);
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
  if (consume.ok === false) {
    return {
      ok: false,
      code: 'INVALID_APPROVAL_TICKET',
      reason: consume.reason,
    };
  }

  const apply = applyOverrides(input.overrides, input.organizationId);
  if (apply.ok === false) {
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

  const snapshotAfter = getCurrentRegistrySnapshot(input.organizationId);
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

// ---------------------------------------------------------------------------
// Sprint S19 — Reset-to-defaults admin action (closes R-S17-4)
//
// Drops every prior runtime override and reverts the registry to the
// canonical defaults baked into the deployed code-baseline. Mirrors
// the S17 propose -> execute -> audit flow, but with NO payload — the
// only operator input is a free-form `reason` string captured for the
// audit row.
//
// Why a fresh ticket fingerprint instead of reusing the S17 service?
//   - Reset is a strictly different action_type with a different
//     audit-row shape (`registrySnapshotBefore` vs the S17
//     `registrySnapshotAfter` semantics). Mixing them would confuse
//     downstream audit-log readers.
//   - The fingerprint binds to `{ action: 'reset_to_defaults', reason }`
//     so a SuperAdmin who proposes a reset with one reason and tries
//     to execute with a different reason hits `payload_mismatch` —
//     the same defense-in-depth guarantee S17 provides for overrides.
//
// Persistence interaction:
//   - `resetToDefaults()` fires the registry's `onReset` hook, which
//     clears the on-disk persistence file (Sprint S18). The reset is
//     therefore durable across restarts even though no payload was
//     written.
// ---------------------------------------------------------------------------

/**
 * Stable marker baked into the reset ticket's fingerprint payload.
 * Decouples the fingerprint from any payload shape so a future shape
 * tweak does not silently alter past tickets.
 */
const RESET_FINGERPRINT_ACTION = 'reset_to_defaults' as const;

function computeResetFingerprint(reason: string | null): string {
  return computePayloadFingerprint({
    action: RESET_FINGERPRINT_ACTION,
    reason: reason ?? null,
  });
}

export interface ProposeLayoutCapacityResetInput {
  organizationId: string;
  userId: string;
  /**
   * Free-form text the SuperAdmin records for the audit row. Optional
   * but strongly encouraged (the audit downstream consumer renders it
   * as the human-readable change-control note). The reason is
   * fingerprinted into the ticket — execute MUST present the same
   * reason or the ticket is rejected with `payload_mismatch`.
   */
  reason?: string | null;
  ttlMs?: number;
  now?: Date;
}

export interface ProposeLayoutCapacityResetResult {
  ok: true;
  ticket: PresentationStudioApprovalTicket;
  payloadFingerprint: string;
}

/**
 * Mint a single-use approval ticket for a reset-to-defaults action.
 *
 * Unlike `proposeLayoutCapacityOverrides`, there is no payload to
 * dry-run validate — a reset has no input data and no validator can
 * reject it. The function therefore never returns a validation
 * failure; it always returns `ok: true`. We keep the discriminated
 * union shape so the route handler signature stays parallel to the
 * overrides flow.
 */
export function proposeLayoutCapacityReset(
  input: ProposeLayoutCapacityResetInput
): ProposeLayoutCapacityResetResult {
  const fingerprint = computeResetFingerprint(input.reason ?? null);
  const ticket = mintApprovalTicket({
    organizationId: input.organizationId,
    userId: input.userId,
    payloadFingerprint: fingerprint,
    ttlMs: input.ttlMs,
    now: input.now,
  });
  return { ok: true, ticket, payloadFingerprint: fingerprint };
}

export interface ExecuteLayoutCapacityResetInput {
  organizationId: string;
  userId: string;
  ticketId: string;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export type ExecuteLayoutCapacityResetResult =
  | {
      ok: true;
      result: {
        ticketId: string;
        registrySnapshotBefore: LayoutCapacityRegistrySnapshot;
        registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
        auditEvent: 'presentation_studio_layout_capacity_overrides_reset';
      };
    }
  | {
      ok: false;
      code: 'INVALID_APPROVAL_TICKET';
      reason: ApprovalTicketRejectionReason;
    };

/**
 * Atomically redeem a reset approval ticket and call
 * `resetToDefaults()` on the registry. Records an audit log entry on
 * success with both pre- and post-reset snapshots so the wiped
 * configuration is traceable and replay-able.
 *
 * On any ticket failure NO reset is performed and NO audit event is
 * emitted. Once the ticket is consumed the reset is unconditional —
 * there is no validator that could reject it (the registry is
 * already in a valid post-reset state by definition).
 */
export async function executeLayoutCapacityReset(
  input: ExecuteLayoutCapacityResetInput
): Promise<ExecuteLayoutCapacityResetResult> {
  const expectedFingerprint = computeResetFingerprint(input.reason ?? null);
  const consume = consumeApprovalTicket({
    ticketId: input.ticketId,
    organizationId: input.organizationId,
    userId: input.userId,
    expectedFingerprint,
    now: input.now,
  });
  if (consume.ok === false) {
    return {
      ok: false,
      code: 'INVALID_APPROVAL_TICKET',
      reason: consume.reason,
    };
  }

  // Snapshot BEFORE the reset so we can record what was lost. The
  // registry is process-global + synchronous so this read is atomic
  // with respect to the subsequent `resetToDefaults`.
  const snapshotBefore = getCurrentRegistrySnapshot(input.organizationId);
  resetToDefaults(input.organizationId);
  const snapshotAfter = getCurrentRegistrySnapshot(input.organizationId);

  const deps = getAdminDeps();
  await deps.recordAudit({
    userId: input.userId,
    organizationId: input.organizationId,
    actionType: 'presentation_studio_layout_capacity_overrides_reset',
    resourceType: 'presentation_studio_layout_capacity_registry',
    resourceId: consume.ticket.ticketId,
    details: {
      ticketId: consume.ticket.ticketId,
      payloadFingerprint: expectedFingerprint,
      reason: input.reason ?? null,
      registrySnapshotBefore: snapshotBefore,
      registrySnapshotAfter: snapshotAfter,
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    ok: true,
    result: {
      ticketId: consume.ticket.ticketId,
      registrySnapshotBefore: snapshotBefore,
      registrySnapshotAfter: snapshotAfter,
      auditEvent: 'presentation_studio_layout_capacity_overrides_reset',
    },
  };
}
