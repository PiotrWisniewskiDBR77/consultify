/**
 * KPI-E001/E002 — shared row + DTO types.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md.
 * Schema: server/migrations/20260810_rvn_kpi_core.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1 — the
 * shape a raw `client.query<...Row>()` call returns. DTO interfaces are
 * camelCase — the shape command/repository functions return to their
 * callers. This mirrors `eventEnvelope.ts`'s convention (camelCase TS field,
 * snake_case DB column noted in a trailing comment) and
 * `managementChainMaintenance.ts`'s `*Row` internal types.
 */

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

// 'pending_approval' sits between 'draft' and 'active' (source plan §4.1 —
// see EXECUTION_LEDGER.md §16 and the migration's own comment on this
// column for the full rationale of when each command sets it).
export const KPI_STATUSES = [
  'draft',
  'pending_approval',
  'active',
  'suspended',
  'archived',
] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

export const KPI_APPROVAL_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type KpiApprovalStatus = (typeof KPI_APPROVAL_STATUSES)[number];

// 'binary' (source plan §3.1's `direction: ... | binary | ...`, see
// EXECUTION_LEDGER.md §16) is the sixth geometry — zero-event compliance,
// evaluated via `binarySuccessValue` rather than the numeric bound columns
// the other five geometries use (targetGeometryEvaluator.ts's evalBinary()).
export const KPI_TARGET_GEOMETRIES = [
  'threshold_min',
  'threshold_max',
  'range',
  'exact',
  'binary',
  'custom',
] as const;
export type KpiTargetGeometry = (typeof KPI_TARGET_GEOMETRIES)[number];

export const KPI_PERFORMANCE_STATUSES = ['on_target', 'warning', 'critical', 'neutral'] as const;
export type KpiPerformanceStatus = (typeof KPI_PERFORMANCE_STATUSES)[number];

export const KPI_DATA_QUALITY_STATUSES = [
  'unverified',
  'verified',
  'disputed',
  'estimated',
] as const;
export type KpiDataQualityStatus = (typeof KPI_DATA_QUALITY_STATUSES)[number];

// ==========================================
// rvn_kpi_definitions
// ==========================================

export interface KpiDefinitionRow {
  kpi_id: string;
  organization_id: string;
  kpi_code: string;
  status: KpiStatus;
  current_definition_version_id: string | null;
  primary_process_id: string | null;
  response_policy_id: string | null;
  owner_user_id: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiDefinition {
  kpiId: string;
  organizationId: string;
  kpiCode: string;
  status: KpiStatus;
  currentDefinitionVersionId: string | null;
  primaryProcessId: string | null;
  responsePolicyId: string | null;
  ownerUserId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toKpiDefinition(row: KpiDefinitionRow): KpiDefinition {
  return {
    kpiId: row.kpi_id,
    organizationId: row.organization_id,
    kpiCode: row.kpi_code,
    status: row.status,
    currentDefinitionVersionId: row.current_definition_version_id,
    primaryProcessId: row.primary_process_id,
    responsePolicyId: row.response_policy_id,
    ownerUserId: row.owner_user_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_definition_versions
// ==========================================

export interface KpiDefinitionVersionRow {
  definition_version_id: string;
  kpi_id: string;
  organization_id: string;
  version_number: number;
  name: string;
  description: string | null;
  unit: string | null;
  target_geometry: KpiTargetGeometry;
  target_value: string | null;
  target_min: string | null;
  target_max: string | null;
  warning_low: string | null;
  warning_high: string | null;
  critical_low: string | null;
  critical_high: string | null;
  /** Only set when `target_geometry = 'binary'` — see the migration's
   * column comment. NUMERIC(0|1) in the DB, comes back as a numeric string
   * like every other bound column here. */
  binary_success_value: string | null;
  formula_text: string | null;
  approval_status: KpiApprovalStatus;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  row_version: number;
}

export interface KpiDefinitionVersion {
  definitionVersionId: string;
  kpiId: string;
  organizationId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  unit: string | null;
  targetGeometry: KpiTargetGeometry;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  binarySuccessValue: number | null;
  formulaText: string | null;
  approvalStatus: KpiApprovalStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rowVersion: number;
}

/** NUMERIC columns come back from `pg` as strings — parse defensively; a
 * NULL DB value must stay `null`, never become `NaN`. */
function toNullableNumber(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toKpiDefinitionVersion(row: KpiDefinitionVersionRow): KpiDefinitionVersion {
  return {
    definitionVersionId: row.definition_version_id,
    kpiId: row.kpi_id,
    organizationId: row.organization_id,
    versionNumber: row.version_number,
    name: row.name,
    description: row.description,
    unit: row.unit,
    targetGeometry: row.target_geometry,
    targetValue: toNullableNumber(row.target_value),
    targetMin: toNullableNumber(row.target_min),
    targetMax: toNullableNumber(row.target_max),
    warningLow: toNullableNumber(row.warning_low),
    warningHigh: toNullableNumber(row.warning_high),
    criticalLow: toNullableNumber(row.critical_low),
    criticalHigh: toNullableNumber(row.critical_high),
    binarySuccessValue: toNullableNumber(row.binary_success_value),
    formulaText: row.formula_text,
    approvalStatus: row.approval_status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    rowVersion: row.row_version,
  };
}

// ==========================================
// rvn_kpi_measurements
// ==========================================

export interface KpiMeasurementRow {
  measurement_id: string;
  kpi_id: string;
  definition_version_id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  actual_value: string | null;
  performance_status: KpiPerformanceStatus;
  data_quality_status: KpiDataQualityStatus;
  correction_of_measurement_id: string | null;
  correction_reason: string | null;
  source: string;
  evidence_refs: unknown[];
  notes: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface KpiMeasurement {
  measurementId: string;
  kpiId: string;
  definitionVersionId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number | null;
  performanceStatus: KpiPerformanceStatus;
  dataQualityStatus: KpiDataQualityStatus;
  correctionOfMeasurementId: string | null;
  correctionReason: string | null;
  source: string;
  evidenceRefs: unknown[];
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

export function toKpiMeasurement(row: KpiMeasurementRow): KpiMeasurement {
  return {
    measurementId: row.measurement_id,
    kpiId: row.kpi_id,
    definitionVersionId: row.definition_version_id,
    organizationId: row.organization_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    actualValue: toNullableNumber(row.actual_value),
    performanceStatus: row.performance_status,
    dataQualityStatus: row.data_quality_status,
    correctionOfMeasurementId: row.correction_of_measurement_id,
    correctionReason: row.correction_reason,
    source: row.source,
    evidenceRefs: row.evidence_refs ?? [],
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}
