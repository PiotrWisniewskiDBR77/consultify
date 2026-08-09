/**
 * ROI-E002 — shared row + DTO types for the economic-model tables.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §3.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * Same convention as `roiTypes.ts` (ROI-E001): `*Row` interfaces are
 * snake_case, matching DB columns 1:1; DTO interfaces are camelCase. Reuses
 * `toNullableNumber` from `kpi/kpiTypes.ts` rather than restating it (design
 * §8 file list references `roiTypes.ts`'s own precedent for this).
 */
import { toNullableNumber } from '../kpi/kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const ROI_TAX_TREATMENTS = ['pre_tax', 'post_tax', 'not_modeled'] as const;
export type RoiTaxTreatment = (typeof ROI_TAX_TREATMENTS)[number];

export const ROI_ROUNDING_POLICIES = ['half_up_2dp', 'half_even_2dp', 'none'] as const;
export type RoiRoundingPolicy = (typeof ROI_ROUNDING_POLICIES)[number];

export const ROI_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type RoiConfidenceLevel = (typeof ROI_CONFIDENCE_LEVELS)[number];

export const ROI_TIMING_TYPES = ['one_time', 'recurring'] as const;
export type RoiTimingType = (typeof ROI_TIMING_TYPES)[number];

export const ROI_RECURRENCE_CADENCES = ['monthly', 'quarterly', 'annual'] as const;
export type RoiRecurrenceCadence = (typeof ROI_RECURRENCE_CADENCES)[number];

export const ROI_EVIDENCE_LINK_PURPOSES = ['primary_evidence', 'supporting'] as const;
export type RoiEvidenceLinkPurpose = (typeof ROI_EVIDENCE_LINK_PURPOSES)[number];

export const ROI_EVIDENCE_LINK_DISPUTE_STATUSES = ['none', 'stale', 'disputed'] as const;
export type RoiEvidenceLinkDisputeStatus = (typeof ROI_EVIDENCE_LINK_DISPUTE_STATUSES)[number];

export const ROI_SCENARIO_TYPES = ['downside', 'upside', 'custom'] as const;
export type RoiScenarioType = (typeof ROI_SCENARIO_TYPES)[number];

export const ROI_SCENARIO_OVERRIDE_TARGET_TYPES = ['assumption', 'cost_line', 'benefit_line'] as const;
export type RoiScenarioOverrideTargetType = (typeof ROI_SCENARIO_OVERRIDE_TARGET_TYPES)[number];

export const ROI_CALCULATION_RUN_STATUSES = ['completed', 'failed'] as const;
export type RoiCalculationRunStatus = (typeof ROI_CALCULATION_RUN_STATUSES)[number];

export const ROI_IRR_STATUSES = ['computed', 'not_applicable', 'no_sign_change', 'not_required_by_policy'] as const;
export type RoiIrrStatus = (typeof ROI_IRR_STATUSES)[number];

// ==========================================
// rvn_roi_calculation_policy
// ==========================================

export interface RoiCalculationPolicyRow {
  policy_row_id: string;
  case_id: string;
  organization_id: string;
  discount_rate_pct: string | null;
  tax_treatment: RoiTaxTreatment | null;
  inflation_rate_pct: string | null;
  rounding_policy: RoiRoundingPolicy;
  required_metrics: string[] | null;
  notes: string | null;
  confidence: RoiConfidenceLevel | null;
  owner_user_id: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiCalculationPolicy {
  policyRowId: string;
  caseId: string;
  organizationId: string;
  discountRatePct: number | null;
  taxTreatment: RoiTaxTreatment | null;
  inflationRatePct: number | null;
  roundingPolicy: RoiRoundingPolicy;
  requiredMetrics: string[] | null;
  notes: string | null;
  confidence: RoiConfidenceLevel | null;
  ownerUserId: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiCalculationPolicy(row: RoiCalculationPolicyRow): RoiCalculationPolicy {
  return {
    policyRowId: row.policy_row_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    discountRatePct: toNullableNumber(row.discount_rate_pct),
    taxTreatment: row.tax_treatment,
    inflationRatePct: toNullableNumber(row.inflation_rate_pct),
    roundingPolicy: row.rounding_policy,
    requiredMetrics: row.required_metrics,
    notes: row.notes,
    confidence: row.confidence,
    ownerUserId: row.owner_user_id,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_assumptions
// ==========================================

export interface RoiAssumptionRow {
  assumption_id: string;
  case_id: string;
  organization_id: string;
  category: string;
  label: string;
  unit: string | null;
  base_value: string | null;
  downside_value: string | null;
  upside_value: string | null;
  confidence: RoiConfidenceLevel | null;
  evidence_ref: string | null;
  source: string | null;
  owner_user_id: string | null;
  sensitivity_rank: number | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiAssumption {
  assumptionId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  unit: string | null;
  baseValue: number | null;
  downsideValue: number | null;
  upsideValue: number | null;
  confidence: RoiConfidenceLevel | null;
  evidenceRef: string | null;
  source: string | null;
  ownerUserId: string | null;
  sensitivityRank: number | null;
  notes: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiAssumption(row: RoiAssumptionRow): RoiAssumption {
  return {
    assumptionId: row.assumption_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    category: row.category,
    label: row.label,
    unit: row.unit,
    baseValue: toNullableNumber(row.base_value),
    downsideValue: toNullableNumber(row.downside_value),
    upsideValue: toNullableNumber(row.upside_value),
    confidence: row.confidence,
    evidenceRef: row.evidence_ref,
    source: row.source,
    ownerUserId: row.owner_user_id,
    sensitivityRank: row.sensitivity_rank,
    notes: row.notes,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_cost_lines
// ==========================================

export interface RoiCostLineRow {
  cost_line_id: string;
  case_id: string;
  organization_id: string;
  category: string;
  label: string;
  description: string | null;
  amount: string;
  currency: string;
  timing_type: RoiTimingType;
  one_time_period_date: string | null;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  recurrence_cadence: RoiRecurrenceCadence | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  owner_user_id: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiCostLine {
  costLineId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description: string | null;
  amount: number;
  currency: string;
  timingType: RoiTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiRecurrenceCadence | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  ownerUserId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiCostLine(row: RoiCostLineRow): RoiCostLine {
  return {
    costLineId: row.cost_line_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    category: row.category,
    label: row.label,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    timingType: row.timing_type,
    oneTimePeriodDate: row.one_time_period_date,
    recurrenceStartDate: row.recurrence_start_date,
    recurrenceEndDate: row.recurrence_end_date,
    recurrenceCadence: row.recurrence_cadence,
    confidence: row.confidence,
    source: row.source,
    ownerUserId: row.owner_user_id,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_benefit_lines
// ==========================================

export interface RoiBenefitLineRow {
  benefit_line_id: string;
  case_id: string;
  organization_id: string;
  category: string;
  label: string;
  description: string | null;
  is_financial: boolean;
  amount: string | null;
  currency: string | null;
  timing_type: RoiTimingType;
  one_time_period_date: string | null;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  recurrence_cadence: RoiRecurrenceCadence | null;
  ramp_periods: number | null;
  double_counting_group: string | null;
  double_counting_resolution_note: string | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  owner_user_id: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiBenefitLine {
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description: string | null;
  isFinancial: boolean;
  amount: number | null;
  currency: string | null;
  timingType: RoiTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiRecurrenceCadence | null;
  rampPeriods: number | null;
  doubleCountingGroup: string | null;
  doubleCountingResolutionNote: string | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  ownerUserId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiBenefitLine(row: RoiBenefitLineRow): RoiBenefitLine {
  return {
    benefitLineId: row.benefit_line_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    category: row.category,
    label: row.label,
    description: row.description,
    isFinancial: row.is_financial,
    amount: toNullableNumber(row.amount),
    currency: row.currency,
    timingType: row.timing_type,
    oneTimePeriodDate: row.one_time_period_date,
    recurrenceStartDate: row.recurrence_start_date,
    recurrenceEndDate: row.recurrence_end_date,
    recurrenceCadence: row.recurrence_cadence,
    rampPeriods: row.ramp_periods,
    doubleCountingGroup: row.double_counting_group,
    doubleCountingResolutionNote: row.double_counting_resolution_note,
    confidence: row.confidence,
    source: row.source,
    ownerUserId: row.owner_user_id,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_benefit_evidence_links
// ==========================================

export interface RoiBenefitEvidenceLinkRow {
  link_id: string;
  benefit_line_id: string;
  case_id: string;
  organization_id: string;
  kpi_id: string;
  pinned_kpi_definition_version_id: string;
  expected_unit: string | null;
  purpose: RoiEvidenceLinkPurpose;
  linked_by: string;
  linked_at: string;
  freshness_checked_at: string | null;
  dispute_status: RoiEvidenceLinkDisputeStatus;
  notes: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiBenefitEvidenceLink {
  linkId: string;
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  kpiId: string;
  pinnedKpiDefinitionVersionId: string;
  expectedUnit: string | null;
  purpose: RoiEvidenceLinkPurpose;
  linkedBy: string;
  linkedAt: string;
  freshnessCheckedAt: string | null;
  disputeStatus: RoiEvidenceLinkDisputeStatus;
  notes: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiBenefitEvidenceLink(row: RoiBenefitEvidenceLinkRow): RoiBenefitEvidenceLink {
  return {
    linkId: row.link_id,
    benefitLineId: row.benefit_line_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    pinnedKpiDefinitionVersionId: row.pinned_kpi_definition_version_id,
    expectedUnit: row.expected_unit,
    purpose: row.purpose,
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    freshnessCheckedAt: row.freshness_checked_at,
    disputeStatus: row.dispute_status,
    notes: row.notes,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_scenarios
// ==========================================

export interface RoiScenarioRow {
  scenario_id: string;
  case_id: string;
  organization_id: string;
  scenario_type: RoiScenarioType;
  label: string;
  description: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiScenario {
  scenarioId: string;
  caseId: string;
  organizationId: string;
  scenarioType: RoiScenarioType;
  label: string;
  description: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiScenario(row: RoiScenarioRow): RoiScenario {
  return {
    scenarioId: row.scenario_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    scenarioType: row.scenario_type,
    label: row.label,
    description: row.description,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_scenario_overrides
// ==========================================

export interface RoiScenarioOverrideRow {
  override_id: string;
  scenario_id: string;
  organization_id: string;
  target_type: RoiScenarioOverrideTargetType;
  target_id: string;
  override_value: string | null;
  override_amount: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface RoiScenarioOverride {
  overrideId: string;
  scenarioId: string;
  organizationId: string;
  targetType: RoiScenarioOverrideTargetType;
  targetId: string;
  overrideValue: number | null;
  overrideAmount: number | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export function toRoiScenarioOverride(row: RoiScenarioOverrideRow): RoiScenarioOverride {
  return {
    overrideId: row.override_id,
    scenarioId: row.scenario_id,
    organizationId: row.organization_id,
    targetType: row.target_type,
    targetId: row.target_id,
    overrideValue: toNullableNumber(row.override_value),
    overrideAmount: toNullableNumber(row.override_amount),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ==========================================
// rvn_roi_calculation_runs
// ==========================================

export interface RoiCalculationRunRow {
  run_id: string;
  case_id: string;
  organization_id: string;
  engine_version: string;
  policy_version_stamp: string;
  scenario_id: string | null;
  status: RoiCalculationRunStatus;
  input_snapshot: Record<string, unknown>;
  input_hash: string;
  total_costs: string | null;
  total_financial_benefits: string | null;
  simple_roi: string | null;
  npv: string | null;
  irr_pct: string | null;
  irr_status: RoiIrrStatus;
  payback_periods: string | null;
  discounted_payback_periods: string | null;
  benefit_cost_ratio: string | null;
  period_series: unknown[];
  has_unresolved_double_counting: boolean;
  has_mixed_currency_failure: boolean;
  validation_findings: unknown[];
  warnings: unknown[];
  initiated_by: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export interface RoiCalculationRun {
  runId: string;
  caseId: string;
  organizationId: string;
  engineVersion: string;
  policyVersionStamp: string;
  scenarioId: string | null;
  status: RoiCalculationRunStatus;
  inputSnapshot: Record<string, unknown>;
  inputHash: string;
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  periodSeries: unknown[];
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: unknown[];
  warnings: unknown[];
  initiatedBy: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

export function toRoiCalculationRun(row: RoiCalculationRunRow): RoiCalculationRun {
  return {
    runId: row.run_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    engineVersion: row.engine_version,
    policyVersionStamp: row.policy_version_stamp,
    scenarioId: row.scenario_id,
    status: row.status,
    inputSnapshot: row.input_snapshot,
    inputHash: row.input_hash,
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
    initiatedBy: row.initiated_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}
