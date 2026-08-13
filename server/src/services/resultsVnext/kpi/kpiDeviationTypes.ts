/**
 * KPI-E003 — Deviation Closed Loop shared row + DTO types.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §A.
 * Schema: server/migrations/20260811_rvn_kpi_deviation_loop.sql,
 * server/migrations/20260811_rvn_platform_obligations.sql.
 *
 * Convention mirrors kpiTypes.ts exactly: `*Row` interfaces are snake_case,
 * matching DB columns 1:1 (the shape a raw `client.query<...Row>()` call
 * returns); DTO interfaces are camelCase — the shape command/repository
 * functions return to their callers.
 */

import { toNullableNumber } from './kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const DEVIATION_SEVERITIES = ['warning', 'critical'] as const;
export type DeviationSeverity = (typeof DEVIATION_SEVERITIES)[number];

// The state machine proper (KPI_E003_DESIGN.md §A/§B table) — `escalated` is
// a NON-EXCLUSIVE boolean overlay tracked as separate columns, NEVER a
// member of this list.
export const DEVIATION_CASE_STATUSES = [
  'open',
  'analysis_required',
  'plan_required',
  'plan_submitted',
  'approved',
  'executing',
  'recovery_observed',
  'verification',
  'closed',
] as const;
export type DeviationCaseStatus = (typeof DEVIATION_CASE_STATUSES)[number];

export const CORRECTIVE_ACTION_STATUSES = [
  'planned',
  'active',
  'blocked',
  'completed',
  'cancelled',
] as const;
export type CorrectiveActionStatus = (typeof CORRECTIVE_ACTION_STATUSES)[number];

export const EFFECTIVENESS_VERIFICATION_STATUSES = [
  'pending',
  'effective',
  'partially_effective',
  'ineffective',
] as const;
export type EffectivenessVerificationStatus = (typeof EFFECTIVENESS_VERIFICATION_STATUSES)[number];

export const OBLIGATION_STATUSES = ['open', 'completed', 'cancelled', 'superseded'] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

// ==========================================
// rvn_kpi_response_policies
// ==========================================

export interface ResponsePolicyRow {
  response_policy_id: string;
  organization_id: string;
  name: string;
  warning_response_hours: number;
  critical_response_hours: number;
  requires_effectiveness_verification_to_close: boolean;
  accepted_verification_statuses: string[];
  is_default: boolean;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ResponsePolicy {
  responsePolicyId: string;
  organizationId: string;
  name: string;
  warningResponseHours: number;
  criticalResponseHours: number;
  requiresEffectivenessVerificationToClose: boolean;
  acceptedVerificationStatuses: string[];
  isDefault: boolean;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toResponsePolicy(row: ResponsePolicyRow): ResponsePolicy {
  return {
    responsePolicyId: row.response_policy_id,
    organizationId: row.organization_id,
    name: row.name,
    warningResponseHours: row.warning_response_hours,
    criticalResponseHours: row.critical_response_hours,
    requiresEffectivenessVerificationToClose: row.requires_effectiveness_verification_to_close,
    acceptedVerificationStatuses: row.accepted_verification_statuses ?? [],
    isDefault: row.is_default,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_deviation_cases
// ==========================================

export interface DeviationCaseRow {
  case_id: string;
  organization_id: string;
  kpi_id: string;
  trigger_measurement_id: string;
  severity: DeviationSeverity;
  status: DeviationCaseStatus;
  escalated: boolean;
  escalated_at: string | null;
  escalated_reason: string | null;
  escalated_by: string | null;
  owner_user_id: string;
  manager_user_id: string | null;
  detected_at: string;
  response_due_at: string | null;
  root_cause_summary: string | null;
  root_cause_category: string | null;
  recurrence_flag: boolean;
  expected_recovery_date: string | null;
  expected_recovery_value: string | null;
  plan_submitted_by: string | null;
  plan_submitted_at: string | null;
  plan_approved_by: string | null;
  plan_approved_at: string | null;
  recovery_observed_by: string | null;
  recovery_observed_at: string | null;
  recovery_observation_measurement_id: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_effectiveness_verification_id: string | null;
  reopened_from_case_id: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DeviationCase {
  caseId: string;
  organizationId: string;
  kpiId: string;
  triggerMeasurementId: string;
  severity: DeviationSeverity;
  status: DeviationCaseStatus;
  escalated: boolean;
  escalatedAt: string | null;
  escalatedReason: string | null;
  escalatedBy: string | null;
  ownerUserId: string;
  managerUserId: string | null;
  detectedAt: string;
  responseDueAt: string | null;
  rootCauseSummary: string | null;
  rootCauseCategory: string | null;
  recurrenceFlag: boolean;
  expectedRecoveryDate: string | null;
  expectedRecoveryValue: number | null;
  planSubmittedBy: string | null;
  planSubmittedAt: string | null;
  planApprovedBy: string | null;
  planApprovedAt: string | null;
  recoveryObservedBy: string | null;
  recoveryObservedAt: string | null;
  recoveryObservationMeasurementId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closeEffectivenessVerificationId: string | null;
  reopenedFromCaseId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toDeviationCase(row: DeviationCaseRow): DeviationCase {
  return {
    caseId: row.case_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    triggerMeasurementId: row.trigger_measurement_id,
    severity: row.severity,
    status: row.status,
    escalated: row.escalated,
    escalatedAt: row.escalated_at,
    escalatedReason: row.escalated_reason,
    escalatedBy: row.escalated_by,
    ownerUserId: row.owner_user_id,
    managerUserId: row.manager_user_id,
    detectedAt: row.detected_at,
    responseDueAt: row.response_due_at,
    rootCauseSummary: row.root_cause_summary,
    rootCauseCategory: row.root_cause_category,
    recurrenceFlag: row.recurrence_flag,
    expectedRecoveryDate: row.expected_recovery_date,
    expectedRecoveryValue: toNullableNumber(row.expected_recovery_value),
    planSubmittedBy: row.plan_submitted_by,
    planSubmittedAt: row.plan_submitted_at,
    planApprovedBy: row.plan_approved_by,
    planApprovedAt: row.plan_approved_at,
    recoveryObservedBy: row.recovery_observed_by,
    recoveryObservedAt: row.recovery_observed_at,
    recoveryObservationMeasurementId: row.recovery_observation_measurement_id,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closeEffectivenessVerificationId: row.close_effectiveness_verification_id,
    reopenedFromCaseId: row.reopened_from_case_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_corrective_actions
// ==========================================

export interface CorrectiveActionRow {
  action_id: string;
  deviation_case_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  owner_user_id: string;
  due_date: string | null;
  status: CorrectiveActionStatus;
  expected_effect: string | null;
  actual_effect: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CorrectiveAction {
  actionId: string;
  deviationCaseId: string;
  organizationId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  dueDate: string | null;
  status: CorrectiveActionStatus;
  expectedEffect: string | null;
  actualEffect: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toCorrectiveAction(row: CorrectiveActionRow): CorrectiveAction {
  return {
    actionId: row.action_id,
    deviationCaseId: row.deviation_case_id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    status: row.status,
    expectedEffect: row.expected_effect,
    actualEffect: row.actual_effect,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_effectiveness_verifications
// ==========================================

export interface EffectivenessVerificationRow {
  verification_id: string;
  deviation_case_id: string;
  organization_id: string;
  verification_window_start: string;
  verification_window_end: string;
  status: EffectivenessVerificationStatus;
  rationale: string | null;
  verified_by: string | null;
  verified_at: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
}

export interface EffectivenessVerification {
  verificationId: string;
  deviationCaseId: string;
  organizationId: string;
  verificationWindowStart: string;
  verificationWindowEnd: string;
  status: EffectivenessVerificationStatus;
  rationale: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  /** Populated by the repository/command layer from the join table
   * (rvn_kpi_effectiveness_verification_measurements) — never a literal
   * array column on the row itself (decision #6). */
  measurementIds: string[];
}

export function toEffectivenessVerification(
  row: EffectivenessVerificationRow,
  measurementIds: string[] = []
): EffectivenessVerification {
  return {
    verificationId: row.verification_id,
    deviationCaseId: row.deviation_case_id,
    organizationId: row.organization_id,
    verificationWindowStart: row.verification_window_start,
    verificationWindowEnd: row.verification_window_end,
    status: row.status,
    rationale: row.rationale,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    measurementIds,
  };
}

// ==========================================
// rvn_platform_obligations (decision #5 — platform-owned, KPI is its first
// caller; row/DTO types kept here since kpiMyWorkIntegration is this
// package's only caller today, mirroring how kpiTypes.ts owns the shared
// shapes for the rest of the KPI domain).
// ==========================================

export interface ObligationRow {
  obligation_id: string;
  organization_id: string;
  assignee_user_id: string;
  reference_type: string;
  reference_id: string;
  aggregate_version_at_creation: number;
  obligation_type: string;
  due_at: string | null;
  status: ObligationStatus;
  policy_version_id: string | null;
  source_event_id: string | null;
  cadence_occurrence_id: string | null;
  deduplication_key: string;
  completed_at: string | null;
  completed_via_command: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
}

export interface Obligation {
  obligationId: string;
  organizationId: string;
  assigneeUserId: string;
  referenceType: string;
  referenceId: string;
  aggregateVersionAtCreation: number;
  obligationType: string;
  dueAt: string | null;
  status: ObligationStatus;
  policyVersionId: string | null;
  sourceEventId: string | null;
  cadenceOccurrenceId: string | null;
  deduplicationKey: string;
  completedAt: string | null;
  completedViaCommand: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toObligation(row: ObligationRow): Obligation {
  return {
    obligationId: row.obligation_id,
    organizationId: row.organization_id,
    assigneeUserId: row.assignee_user_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    aggregateVersionAtCreation: row.aggregate_version_at_creation,
    obligationType: row.obligation_type,
    dueAt: row.due_at,
    status: row.status,
    policyVersionId: row.policy_version_id,
    sourceEventId: row.source_event_id,
    cadenceOccurrenceId: row.cadence_occurrence_id,
    deduplicationKey: row.deduplication_key,
    completedAt: row.completed_at,
    completedViaCommand: row.completed_via_command,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
