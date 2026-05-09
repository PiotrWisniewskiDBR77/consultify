/**
 * Presentation Studio Layout Capacity Admin API client (Sprint S20).
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - DRD/UI_UX_SOURCE_OF_TRUTH.md
 *   - DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md
 *
 * Sprint S20 closes the user-facing carry-overs from S17 (R-S17-3),
 * S18 (R-S18-4), and S19 (R-S19-3) by giving the SuperAdmin admin
 * surface a usable client. This module talks to the five backend
 * endpoints introduced in S17 + S19:
 *
 *   - GET    /api/presentation-studio/admin/layout-capacity                   (S17)
 *   - POST   /api/presentation-studio/admin/layout-capacity/propose           (S17)
 *   - POST   /api/presentation-studio/admin/layout-capacity/execute           (S17)
 *   - POST   /api/presentation-studio/admin/layout-capacity/reset/propose     (S19)
 *   - POST   /api/presentation-studio/admin/layout-capacity/reset/execute     (S19)
 *
 * RBAC + tenant safety:
 *   - All endpoints are gated by the SUPERADMIN-only
 *     `presentation_admin_layout_capacity` capability on the server.
 *     A non-SuperAdmin GET returns 403 PERMISSION_DENIED — the panel
 *     consumes this as the "hide yourself silently" signal so the
 *     admin surface never appears for users without the capability.
 *   - The registry is process-global; the admin row records the
 *     SuperAdmin's organizationId for audit-trail consistency, but
 *     the change itself affects every tenant served by this Node
 *     process. The S17 contract and the gate report document this.
 *
 * Error envelope:
 *   - Validation failures from /propose surface as code
 *     `INVALID_OVERRIDES_PAYLOAD` with a typed `errors[]` list.
 *   - Ticket failures from /execute surface as code
 *     `INVALID_APPROVAL_TICKET` with a typed `reason` (`not_found |
 *     expired | consumed | tenant_mismatch | user_mismatch |
 *     payload_mismatch`).
 *   - Missing-ticket on /execute surfaces as `PRECONDITION_REQUIRED`.
 *   - All errors are surfaced as `LayoutCapacityAdminApiError` so the
 *     panel can render honest banners without parsing raw HTTP shapes.
 */

import { fetchWithRetry, getHeaders } from './baseClient';

const STUDIO_BASE = '/api/presentation-studio';

// ---------------------------------------------------------------------------
// Wire types — mirror the server's
// `presentationStudioLayoutCapacityRegistryService` snapshot shape
// + `presentationStudioLayoutCapacityAdminService` audit responses.
// ---------------------------------------------------------------------------

export type LayoutCapacityDensityKey = 'visual' | 'balanced' | 'document';

export interface LayoutSlotCapacity {
  titleMaxChars: number;
  keyMessageMaxChars: number;
  blocksMax: number;
}

export type LayoutSlotCapacityOverride = Partial<LayoutSlotCapacity>;

export type LayoutFamilyOverrides = Partial<
  Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>
>;

/**
 * Snapshot of the live registry (or the canonical defaults). The
 * admin GET returns BOTH so the SuperAdmin can render a current vs
 * defaults diff without joining against a separate endpoint.
 */
export interface LayoutCapacityRegistrySnapshot {
  densityBudgets: Record<LayoutCapacityDensityKey, LayoutSlotCapacity>;
  templateFamilyOverrides: Record<string, LayoutFamilyOverrides>;
  familyAliasByDeckType: Record<string, string>;
}

/**
 * Honest degraded-load condition raised by the persistence layer
 * (Sprint S18). `null` means the steady-state "no problem"; a
 * populated value means the panel must render a `loadWarning` banner.
 */
export interface LayoutCapacityRegistryLoadWarning {
  reason: 'corrupt' | 'unsupported_schema' | 'io_error' | 'rejected_by_validator';
  sourcePath: string;
  details?: string;
  raisedAt: string;
}

export interface LayoutCapacityAdminGetResponse {
  current: LayoutCapacityRegistrySnapshot;
  defaults: LayoutCapacityRegistrySnapshot;
  scope: 'process_global' | string;
  loadWarning: LayoutCapacityRegistryLoadWarning | null;
}

export interface LayoutCapacityOverridesPayload {
  densityBudgets?: Partial<Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>>;
  templateFamilyOverrides?: Record<string, LayoutFamilyOverrides>;
  familyAliasByDeckType?: Record<string, string>;
}

export interface LayoutCapacityAdminApprovalTicket {
  ticketId: string;
  organizationId: string;
  userId: string;
  payloadFingerprint: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface LayoutCapacityAdminProposeOverridesResponse {
  ticket: LayoutCapacityAdminApprovalTicket;
  payloadFingerprint: string;
  overrides: LayoutCapacityOverridesPayload;
}

export interface LayoutCapacityAdminExecuteOverridesResponse {
  ticketId: string;
  registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
  auditEvent: 'presentation_studio_layout_capacity_overrides_applied';
}

export interface LayoutCapacityAdminProposeResetResponse {
  ticket: LayoutCapacityAdminApprovalTicket;
  payloadFingerprint: string;
}

export interface LayoutCapacityAdminExecuteResetResponse {
  ticketId: string;
  registrySnapshotBefore: LayoutCapacityRegistrySnapshot;
  registrySnapshotAfter: LayoutCapacityRegistrySnapshot;
  auditEvent: 'presentation_studio_layout_capacity_overrides_reset';
}

export type LayoutCapacityAdminTicketRejectionReason =
  | 'not_found'
  | 'expired'
  | 'consumed'
  | 'tenant_mismatch'
  | 'user_mismatch'
  | 'payload_mismatch';

export interface LayoutCapacityAdminValidationError {
  path: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Typed error class — parallel to PresentationStudioApiError but
// scoped to the admin surface. Keeps the two flows decoupled (the
// generate flow's `preview` field has nothing to do with admin).
// ---------------------------------------------------------------------------

export type LayoutCapacityAdminApiErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_ORG_CONTEXT'
  | 'NO_USER_CONTEXT'
  | 'PRECONDITION_REQUIRED'
  | 'INVALID_OVERRIDES_PAYLOAD'
  | 'INVALID_APPROVAL_TICKET'
  | string;

export class LayoutCapacityAdminApiError extends Error {
  status: number;
  code: LayoutCapacityAdminApiErrorCode;
  reason?: string;
  errors?: LayoutCapacityAdminValidationError[];

  constructor(init: {
    status: number;
    code: LayoutCapacityAdminApiErrorCode;
    message: string;
    reason?: string;
    errors?: LayoutCapacityAdminValidationError[];
  }) {
    super(init.message);
    this.name = 'LayoutCapacityAdminApiError';
    this.status = init.status;
    this.code = init.code;
    if (init.reason !== undefined) this.reason = init.reason;
    if (init.errors !== undefined) this.errors = init.errors;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AdminEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  reason?: string;
  errors?: LayoutCapacityAdminValidationError[];
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${STUDIO_BASE}${path}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  let json: AdminEnvelope<T> | null = null;
  try {
    json = (await res.json()) as AdminEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.success === false || !json.data) {
    throw new LayoutCapacityAdminApiError({
      status: res.status,
      code: json?.code || `HTTP_${res.status}`,
      message:
        json?.error ||
        json?.reason ||
        `Layout-capacity admin GET ${path} failed with status ${res.status}`,
      reason: json?.reason,
      errors: json?.errors,
    });
  }
  return json.data;
}

async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${STUDIO_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: AdminEnvelope<T> | null = null;
  try {
    json = (await res.json()) as AdminEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.success === false || !json.data) {
    throw new LayoutCapacityAdminApiError({
      status: res.status,
      code: json?.code || `HTTP_${res.status}`,
      message:
        json?.error ||
        json?.reason ||
        `Layout-capacity admin POST ${path} failed with status ${res.status}`,
      reason: json?.reason,
      errors: json?.errors,
    });
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const PresentationStudioLayoutCapacityAdminApi = {
  /**
   * Read the current registry snapshot, the canonical defaults, and
   * any active `loadWarning` raised by the persistence layer (S18).
   *
   * The panel uses the 403 response to decide whether to render at
   * all — a non-SuperAdmin SHOULD see no admin surface, not a
   * "permission denied" banner. The throw lets the panel catch the
   * 403 silently and short-circuit its render.
   */
  get: () => adminGet<LayoutCapacityAdminGetResponse>('/admin/layout-capacity'),

  /**
   * Phase A of the override flow. Server runs the registry's strict
   * validator without mutating state and mints a single-use approval
   * ticket bound to (orgId, userId, fingerprint over overrides+reason).
   * On validation failure throws with code `INVALID_OVERRIDES_PAYLOAD`
   * and a populated `errors[]` list.
   */
  proposeOverrides: (input: {
    overrides: LayoutCapacityOverridesPayload;
    reason?: string | null;
  }) =>
    adminPost<LayoutCapacityAdminProposeOverridesResponse>('/admin/layout-capacity/propose', {
      overrides: input.overrides,
      reason: input.reason ?? null,
    }),

  /**
   * Phase B of the override flow. Atomically redeems an approval
   * ticket and applies the overrides through the registry. Emits the
   * canonical `presentation_studio_layout_capacity_overrides_applied`
   * audit event on success.
   *
   * Throws `LayoutCapacityAdminApiError` with code
   * `INVALID_APPROVAL_TICKET` (typed `reason`) on ticket failures,
   * `INVALID_OVERRIDES_PAYLOAD` on post-redeem revalidation rejection,
   * or `PRECONDITION_REQUIRED` when the ticket id is missing.
   */
  executeOverrides: (input: {
    approvalTicket: string;
    overrides: LayoutCapacityOverridesPayload;
    reason?: string | null;
  }) =>
    adminPost<LayoutCapacityAdminExecuteOverridesResponse>('/admin/layout-capacity/execute', {
      approvalTicket: input.approvalTicket,
      overrides: input.overrides,
      reason: input.reason ?? null,
    }),

  /**
   * Phase A of the reset-to-defaults flow (Sprint S19, R-S17-4).
   * Mints a single-use approval ticket bound to a stable
   * `reset_to_defaults` action marker + the reason text. No payload
   * to validate — always succeeds for an authorized SuperAdmin.
   */
  proposeReset: (input: { reason?: string | null }) =>
    adminPost<LayoutCapacityAdminProposeResetResponse>('/admin/layout-capacity/reset/propose', {
      reason: input.reason ?? null,
    }),

  /**
   * Phase B of the reset-to-defaults flow. Atomically redeems the
   * reset ticket and calls `resetToDefaults()` on the registry.
   * Emits `presentation_studio_layout_capacity_overrides_reset` with
   * both pre-reset and post-reset snapshots for auditability.
   *
   * The reset is unconditional once the ticket is consumed — no
   * validator can reject a default state.
   */
  executeReset: (input: { approvalTicket: string; reason?: string | null }) =>
    adminPost<LayoutCapacityAdminExecuteResetResponse>('/admin/layout-capacity/reset/execute', {
      approvalTicket: input.approvalTicket,
      reason: input.reason ?? null,
    }),
};

export type PresentationStudioLayoutCapacityAdminApiType =
  typeof PresentationStudioLayoutCapacityAdminApi;
