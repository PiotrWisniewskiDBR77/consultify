/**
 * OKR-E003 — KeyResult row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §8.
 * Schema: server/migrations/20260824_rvn_okr_objective_key_result.sql.
 *
 * D09: `sourceType`/`sourceReference` are the ONLY fields anywhere on this
 * aggregate that reference an external system, and they are plain
 * strings — no FK, no typed KPI binding table in this epic (§-IO item 7).
 */

export const OKR_KEY_RESULT_MEASUREMENT_TYPES = [
  'numeric',
  'percentage',
  'currency',
  'binary',
  'milestone',
  'custom',
] as const;
export type OkrKeyResultMeasurementType = (typeof OKR_KEY_RESULT_MEASUREMENT_TYPES)[number];

/** MVP-supported subset (D-E3-4) — `createKeyResult`/`updateKeyResult`
 * reject `milestone`/`custom` at the command layer even though the schema
 * CHECK permits all 6 values. */
export const OKR_KEY_RESULT_MEASUREMENT_TYPES_MVP_SUPPORTED = [
  'numeric',
  'percentage',
  'currency',
  'binary',
] as const;

export const OKR_KEY_RESULT_DIRECTIONS = ['increase', 'decrease', 'reach', 'maintain_range', 'binary'] as const;
export type OkrKeyResultDirection = (typeof OKR_KEY_RESULT_DIRECTIONS)[number];

export const OKR_KEY_RESULT_STATUSES = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
  'cancelled',
] as const;
export type OkrKeyResultStatus = (typeof OKR_KEY_RESULT_STATUSES)[number];

export const OKR_KEY_RESULT_SOURCE_TYPES = ['manual', 'import', 'connector', 'mcp', 'calculated'] as const;
export type OkrKeyResultSourceType = (typeof OKR_KEY_RESULT_SOURCE_TYPES)[number];

export const OKR_KEY_RESULT_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrKeyResultConfidence = (typeof OKR_KEY_RESULT_CONFIDENCE_VALUES)[number];

// ==========================================
// okr_vnext_key_results
// ==========================================

export interface OkrKeyResultRow {
  key_result_id: string;
  objective_id: string;
  set_id: string;
  organization_id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  measurement_type: OkrKeyResultMeasurementType;
  unit: string | null;
  currency: string | null;
  baseline_value: string | null;
  target_value: string | null;
  start_value: string | null;
  current_value: string | null;
  direction: OkrKeyResultDirection;
  range_min: string | null;
  range_max: string | null;
  progress: string | null;
  progress_calc_policy_version_id: string;
  progress_calc_reason: string | null;
  out_of_range_distance: string | null;
  confidence: OkrKeyResultConfidence | null;
  confidence_numeric_value: string | null;
  status: OkrKeyResultStatus;
  source_type: OkrKeyResultSourceType;
  source_reference: string | null;
  weight: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrKeyResult {
  keyResultId: string;
  objectiveId: string;
  setId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  measurementType: OkrKeyResultMeasurementType;
  unit: string | null;
  currency: string | null;
  baselineValue: string | null;
  targetValue: string | null;
  startValue: string | null;
  currentValue: string | null;
  direction: OkrKeyResultDirection;
  rangeMin: string | null;
  rangeMax: string | null;
  progress: string | null;
  progressCalcPolicyVersionId: string;
  progressCalcReason: string | null;
  outOfRangeDistance: string | null;
  confidence: OkrKeyResultConfidence | null;
  confidenceNumericValue: string | null;
  status: OkrKeyResultStatus;
  sourceType: OkrKeyResultSourceType;
  sourceReference: string | null;
  weight: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrKeyResult(row: OkrKeyResultRow): OkrKeyResult {
  return {
    keyResultId: row.key_result_id,
    objectiveId: row.objective_id,
    setId: row.set_id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    measurementType: row.measurement_type,
    unit: row.unit,
    currency: row.currency,
    baselineValue: row.baseline_value,
    targetValue: row.target_value,
    startValue: row.start_value,
    currentValue: row.current_value,
    direction: row.direction,
    rangeMin: row.range_min,
    rangeMax: row.range_max,
    progress: row.progress,
    progressCalcPolicyVersionId: row.progress_calc_policy_version_id,
    progressCalcReason: row.progress_calc_reason,
    outOfRangeDistance: row.out_of_range_distance,
    confidence: row.confidence,
    confidenceNumericValue: row.confidence_numeric_value,
    status: row.status,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    weight: row.weight,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}
