/**
 * OKR-E006 — Support request / comment / recognition row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §8.
 * Schema: server/migrations/20260826_rvn_okr_support.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrCheckInTypes.ts`/
 * `okrKeyResultTypes.ts`/`okrObjectiveTypes.ts`/`okrSetTypes.ts`.
 */

export const OKR_SUPPORT_REQUEST_KIND_VALUES = ['comment', 'recognition', 'support_request'] as const;
export type OkrSupportRequestKind = (typeof OKR_SUPPORT_REQUEST_KIND_VALUES)[number];

export const OKR_SUPPORT_REQUEST_STATUS_VALUES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
export type OkrSupportRequestStatus = (typeof OKR_SUPPORT_REQUEST_STATUS_VALUES)[number];

export const OKR_RECOGNITION_VISIBILITY_VALUES = ['team', 'organization'] as const;
export type OkrRecognitionVisibility = (typeof OKR_RECOGNITION_VISIBILITY_VALUES)[number];

// ==========================================
// okr_vnext_support_requests
// ==========================================

export interface OkrSupportRequestRow {
  request_id: string;
  organization_id: string;
  set_id: string;
  objective_id: string;
  key_result_id: string | null;
  kind: OkrSupportRequestKind;
  body: string;
  origin_checkin_id: string | null;
  status: OkrSupportRequestStatus | null;
  assigned_to_user_id: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  dismissed_reason: string | null;
  decision_link_id: string | null;
  recognition_visibility: OkrRecognitionVisibility | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OkrSupportRequest {
  requestId: string;
  organizationId: string;
  setId: string;
  objectiveId: string;
  keyResultId: string | null;
  kind: OkrSupportRequestKind;
  body: string;
  originCheckInId: string | null;
  status: OkrSupportRequestStatus | null;
  assignedToUserId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  dismissedReason: string | null;
  decisionLinkId: string | null;
  recognitionVisibility: OkrRecognitionVisibility | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toOkrSupportRequest(row: OkrSupportRequestRow): OkrSupportRequest {
  return {
    requestId: row.request_id,
    organizationId: row.organization_id,
    setId: row.set_id,
    objectiveId: row.objective_id,
    keyResultId: row.key_result_id,
    kind: row.kind,
    body: row.body,
    originCheckInId: row.origin_checkin_id,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    dismissedReason: row.dismissed_reason,
    decisionLinkId: row.decision_link_id,
    recognitionVisibility: row.recognition_visibility,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// okr_vnext_decision_links
// ==========================================

export interface OkrDecisionLinkRow {
  link_id: string;
  organization_id: string;
  set_id: string;
  support_request_id: string;
  objective_id: string;
  key_result_id: string | null;
  decision_id: string;
  requested_decision: string;
  impact_of_delay: string;
  desired_date: string | null;
  resolution_acknowledged: boolean;
  resolution_acknowledged_by: string | null;
  resolution_acknowledged_at: string | null;
  requested_by: string;
  requested_at: string;
  row_version: number;
}

export interface OkrDecisionLink {
  linkId: string;
  organizationId: string;
  setId: string;
  supportRequestId: string;
  objectiveId: string;
  keyResultId: string | null;
  decisionId: string;
  requestedDecision: string;
  impactOfDelay: string;
  desiredDate: string | null;
  resolutionAcknowledged: boolean;
  resolutionAcknowledgedBy: string | null;
  resolutionAcknowledgedAt: string | null;
  requestedBy: string;
  requestedAt: string;
  rowVersion: number;
}

export function toOkrDecisionLink(row: OkrDecisionLinkRow): OkrDecisionLink {
  return {
    linkId: row.link_id,
    organizationId: row.organization_id,
    setId: row.set_id,
    supportRequestId: row.support_request_id,
    objectiveId: row.objective_id,
    keyResultId: row.key_result_id,
    decisionId: row.decision_id,
    requestedDecision: row.requested_decision,
    impactOfDelay: row.impact_of_delay,
    desiredDate: row.desired_date,
    resolutionAcknowledged: row.resolution_acknowledged,
    resolutionAcknowledgedBy: row.resolution_acknowledged_by,
    resolutionAcknowledgedAt: row.resolution_acknowledged_at,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    rowVersion: row.row_version,
  };
}

/** Live-JOIN hydration shape (design §10.5) — read-side only, never
 * persisted on the OKR side. `decisions` is the same physical database's
 * platform table (server/migrations/20260311_origin_tracking.sql +
 * 932_decision_workflow_canonical.sql, the latter NOT guaranteed live on
 * every environment — see okrDecisionCommands.ts's own header for which
 * columns this design depends on and why none of them require 932). */
export interface OkrDecisionLinkWithLiveStatus extends OkrDecisionLink {
  decisionStatus: string | null;
  decisionRationale: string | null;
  decisionDecidedAt: string | null;
}
