/**
 * ROI-E004 — shared row + DTO types for Forecast/Actual/Variance.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §3/§4.
 * Schema: server/migrations/20260818_rvn_roi_forecast_actual.sql.
 *
 * Same `*Row` (snake_case, 1:1 with DB columns) / DTO (camelCase) split
 * every other file in this package uses — one file per epic's tables,
 * matching `roiEconomicModelTypes.ts`'s precedent (design §4). Reuses
 * `toNullableNumber` from `kpi/kpiTypes.ts` rather than restating it.
 */
import { toNullableNumber } from '../kpi/kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const ROI_FORECAST_VERSION_STATUSES = ['completed', 'failed'] as const;
export type RoiForecastVersionStatus = (typeof ROI_FORECAST_VERSION_STATUSES)[number];

export const ROI_FORECAST_IRR_STATUSES = [
  'computed',
  'not_applicable',
  'no_sign_change',
  'not_required_by_policy',
] as const;
export type RoiForecastIrrStatus = (typeof ROI_FORECAST_IRR_STATUSES)[number];

export const ROI_ACTUAL_ENTRY_TYPES = ['cost', 'benefit', 'observation'] as const;
export type RoiActualEntryType = (typeof ROI_ACTUAL_ENTRY_TYPES)[number];

export const ROI_ACTUAL_ENTRY_DATA_QUALITY_STATUSES = ['unverified', 'verified', 'disputed', 'estimated'] as const;
export type RoiActualEntryDataQualityStatus = (typeof ROI_ACTUAL_ENTRY_DATA_QUALITY_STATUSES)[number];

export const ROI_VARIANCE_COMPARISON_TYPES = ['approved_vs_forecast', 'approved_vs_actual', 'forecast_vs_actual'] as const;
export type RoiVarianceComparisonType = (typeof ROI_VARIANCE_COMPARISON_TYPES)[number];

export const ROI_VARIANCE_STATUSES = ['open', 'explained', 'action_planned', 'resolved'] as const;
export type RoiVarianceStatus = (typeof ROI_VARIANCE_STATUSES)[number];

// ==========================================
// rvn_roi_forecast_versions
// ==========================================

export interface RoiForecastVersionRow {
  forecast_version_id: string;
  case_id: string;
  organization_id: string;
  sequence_number: number;
  reason: string;
  published_by: string;
  published_at: string;
  compared_against_snapshot_id: string;
  engine_version: string;
  policy_version_stamp: string;
  input_overrides: unknown[];
  input_snapshot: Record<string, unknown>;
  input_hash: string;
  status: RoiForecastVersionStatus;
  total_costs: string | null;
  total_financial_benefits: string | null;
  simple_roi: string | null;
  npv: string | null;
  irr_pct: string | null;
  irr_status: RoiForecastIrrStatus;
  payback_periods: string | null;
  discounted_payback_periods: string | null;
  benefit_cost_ratio: string | null;
  period_series: unknown[];
  has_unresolved_double_counting: boolean;
  has_mixed_currency_failure: boolean;
  validation_findings: unknown[];
  warnings: unknown[];
  created_at: string;
}

export interface RoiForecastVersion {
  forecastVersionId: string;
  caseId: string;
  organizationId: string;
  sequenceNumber: number;
  reason: string;
  publishedBy: string;
  publishedAt: string;
  comparedAgainstSnapshotId: string;
  engineVersion: string;
  policyVersionStamp: string;
  inputOverrides: unknown[];
  inputSnapshot: Record<string, unknown>;
  inputHash: string;
  status: RoiForecastVersionStatus;
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiForecastIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  periodSeries: unknown[];
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: unknown[];
  warnings: unknown[];
  createdAt: string;
}

export function toRoiForecastVersion(row: RoiForecastVersionRow): RoiForecastVersion {
  return {
    forecastVersionId: row.forecast_version_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    sequenceNumber: row.sequence_number,
    reason: row.reason,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    comparedAgainstSnapshotId: row.compared_against_snapshot_id,
    engineVersion: row.engine_version,
    policyVersionStamp: row.policy_version_stamp,
    inputOverrides: row.input_overrides,
    inputSnapshot: row.input_snapshot,
    inputHash: row.input_hash,
    status: row.status,
    totalCosts: toNullableNumber(row.total_costs),
    totalFinancialBenefits: toNullableNumber(row.total_financial_benefits),
    simpleRoi: toNullableNumber(row.simple_roi),
    npv: toNullableNumber(row.npv),
    irrPct: toNullableNumber(row.irr_pct),
    irrStatus: row.irr_status,
    paybackPeriods: toNullableNumber(row.payback_periods),
    discountedPaybackPeriods: toNullableNumber(row.discounted_payback_periods),
    benefitCostRatio: toNullableNumber(row.benefit_cost_ratio),
    periodSeries: row.period_series,
    hasUnresolvedDoubleCounting: row.has_unresolved_double_counting,
    hasMixedCurrencyFailure: row.has_mixed_currency_failure,
    validationFindings: row.validation_findings,
    warnings: row.warnings,
    createdAt: row.created_at,
  };
}

// ==========================================
// rvn_roi_actual_entries
// ==========================================

export interface RoiActualEntryRow {
  actual_entry_id: string;
  case_id: string;
  organization_id: string;
  entry_type: RoiActualEntryType;
  cost_line_id: string | null;
  benefit_line_id: string | null;
  period_start: string;
  period_end: string;
  amount: string | null;
  currency: string | null;
  data_quality_status: RoiActualEntryDataQualityStatus;
  correction_of_actual_entry_id: string | null;
  correction_reason: string | null;
  source: string;
  evidence_refs: unknown[];
  notes: string | null;
  recorded_by: string;
  recorded_at: string;
  verified_by: string | null;
  verified_at: string | null;
  line_key: string;
}

export interface RoiActualEntry {
  actualEntryId: string;
  caseId: string;
  organizationId: string;
  entryType: RoiActualEntryType;
  costLineId: string | null;
  benefitLineId: string | null;
  periodStart: string;
  periodEnd: string;
  amount: number | null;
  currency: string | null;
  dataQualityStatus: RoiActualEntryDataQualityStatus;
  correctionOfActualEntryId: string | null;
  correctionReason: string | null;
  source: string;
  evidenceRefs: unknown[];
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  lineKey: string;
}

export function toRoiActualEntry(row: RoiActualEntryRow): RoiActualEntry {
  return {
    actualEntryId: row.actual_entry_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    entryType: row.entry_type,
    costLineId: row.cost_line_id,
    benefitLineId: row.benefit_line_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: toNullableNumber(row.amount),
    currency: row.currency,
    dataQualityStatus: row.data_quality_status,
    correctionOfActualEntryId: row.correction_of_actual_entry_id,
    correctionReason: row.correction_reason,
    source: row.source,
    evidenceRefs: row.evidence_refs,
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    lineKey: row.line_key,
  };
}

// ==========================================
// rvn_roi_actual_snapshots
// ==========================================

export interface RoiActualSnapshotRow {
  actual_snapshot_id: string;
  case_id: string;
  organization_id: string;
  sequence_number: number;
  as_of_period_end: string;
  published_by: string;
  published_at: string;
  total_actual_costs: string | null;
  total_actual_financial_benefits: string | null;
  actual_simple_roi: string | null;
  actual_npv: string | null;
  periods_with_actual_count: number;
  periods_expected_count: number;
  coverage_pct: string | null;
  unverified_entry_count: number;
  disputed_entry_count: number;
  entry_ids_included: string[];
  created_at: string;
}

export interface RoiActualSnapshot {
  actualSnapshotId: string;
  caseId: string;
  organizationId: string;
  sequenceNumber: number;
  asOfPeriodEnd: string;
  publishedBy: string;
  publishedAt: string;
  totalActualCosts: number | null;
  totalActualFinancialBenefits: number | null;
  actualSimpleRoi: number | null;
  actualNpv: number | null;
  periodsWithActualCount: number;
  periodsExpectedCount: number;
  coveragePct: number | null;
  unverifiedEntryCount: number;
  disputedEntryCount: number;
  entryIdsIncluded: string[];
  createdAt: string;
}

export function toRoiActualSnapshot(row: RoiActualSnapshotRow): RoiActualSnapshot {
  return {
    actualSnapshotId: row.actual_snapshot_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    sequenceNumber: row.sequence_number,
    asOfPeriodEnd: row.as_of_period_end,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    totalActualCosts: toNullableNumber(row.total_actual_costs),
    totalActualFinancialBenefits: toNullableNumber(row.total_actual_financial_benefits),
    actualSimpleRoi: toNullableNumber(row.actual_simple_roi),
    actualNpv: toNullableNumber(row.actual_npv),
    periodsWithActualCount: row.periods_with_actual_count,
    periodsExpectedCount: row.periods_expected_count,
    coveragePct: toNullableNumber(row.coverage_pct),
    unverifiedEntryCount: row.unverified_entry_count,
    disputedEntryCount: row.disputed_entry_count,
    entryIdsIncluded: row.entry_ids_included,
    createdAt: row.created_at,
  };
}

// ==========================================
// rvn_roi_variances
// ==========================================

export interface RoiVarianceRow {
  variance_id: string;
  case_id: string;
  organization_id: string;
  comparison_type: RoiVarianceComparisonType;
  metric: string;
  reference_approval_snapshot_id: string | null;
  reference_forecast_version_id: string | null;
  reference_actual_snapshot_id: string | null;
  baseline_value: string | null;
  comparison_value: string | null;
  variance_amount: string | null;
  variance_pct: string | null;
  status: RoiVarianceStatus;
  owner_user_id: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface RoiVariance {
  varianceId: string;
  caseId: string;
  organizationId: string;
  comparisonType: RoiVarianceComparisonType;
  metric: string;
  referenceApprovalSnapshotId: string | null;
  referenceForecastVersionId: string | null;
  referenceActualSnapshotId: string | null;
  baselineValue: number | null;
  comparisonValue: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  status: RoiVarianceStatus;
  ownerUserId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toRoiVariance(row: RoiVarianceRow): RoiVariance {
  return {
    varianceId: row.variance_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    comparisonType: row.comparison_type,
    metric: row.metric,
    referenceApprovalSnapshotId: row.reference_approval_snapshot_id,
    referenceForecastVersionId: row.reference_forecast_version_id,
    referenceActualSnapshotId: row.reference_actual_snapshot_id,
    baselineValue: toNullableNumber(row.baseline_value),
    comparisonValue: toNullableNumber(row.comparison_value),
    varianceAmount: toNullableNumber(row.variance_amount),
    variancePct: toNullableNumber(row.variance_pct),
    status: row.status,
    ownerUserId: row.owner_user_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_variance_causes
// ==========================================

export interface RoiVarianceCauseRow {
  cause_id: string;
  variance_id: string;
  organization_id: string;
  cause_category: string;
  contribution_pct: string | null;
  narrative: string;
  created_by: string;
  created_at: string;
}

export interface RoiVarianceCause {
  causeId: string;
  varianceId: string;
  organizationId: string;
  causeCategory: string;
  contributionPct: number | null;
  narrative: string;
  createdBy: string;
  createdAt: string;
}

export function toRoiVarianceCause(row: RoiVarianceCauseRow): RoiVarianceCause {
  return {
    causeId: row.cause_id,
    varianceId: row.variance_id,
    organizationId: row.organization_id,
    causeCategory: row.cause_category,
    contributionPct: toNullableNumber(row.contribution_pct),
    narrative: row.narrative,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
