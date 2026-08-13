/**
 * RN-G2 §G #12-14 — pure mapping helpers for the ROI Case model-setup
 * surfaces (baseline/calculation-policy/assumptions/cost+benefit lines).
 * Same split as `roiRegistryMappers.ts`: no React, shared by
 * `roiCaseDetailPresenters.tsx` and the dev-render mock screen.
 *
 * Lock semantics are DELIBERATELY NOT redeclared here — every one of these
 * five sub-resources guards on the exact same `NON_EDITABLE_STATUSES`
 * (`roiCaseCommands.ts` L492-506) as the ROI Case itself (confirmed by
 * reading `roiBaselineCommands.ts`, `roiCalculationPolicyCommands.ts`,
 * `roiAssumptionCommands.ts`, `roiCostLineCommands.ts`,
 * `roiBenefitLineCommands.ts` — every one imports and checks
 * `NON_EDITABLE_STATUSES`), so callers import `isRoiCaseLocked`/
 * `getRoiCaseLockInfo` straight from `roiRegistryMappers.ts` — one mirror of
 * the server list, not five.
 */
import type {
  RoiBaselineProjectionMethod,
  RoiConfidenceLevel,
  RoiRecurrenceCadence,
  RoiRoundingPolicy,
  RoiTaxTreatment,
  RoiTimingType,
} from './roiCaseDetailApi';

// ==========================================
// Shared confidence (baseline / calc policy / assumption / cost line /
// benefit line all use the identical 'low'|'medium'|'high' domain).
// ==========================================

export const ROI_CONFIDENCE_LABELS: Record<RoiConfidenceLevel, { pl: string; en: string }> = {
  low: { pl: 'Niska', en: 'Low' },
  medium: { pl: 'Średnia', en: 'Medium' },
  high: { pl: 'Wysoka', en: 'High' },
};

export function roiConfidenceLabel(value: RoiConfidenceLevel | null, isPolish: boolean): string {
  if (!value) return '—';
  return isPolish ? ROI_CONFIDENCE_LABELS[value].pl : ROI_CONFIDENCE_LABELS[value].en;
}

// ==========================================
// Baseline
// ==========================================

export const ROI_BASELINE_PROJECTION_METHOD_LABELS: Record<RoiBaselineProjectionMethod, { pl: string; en: string }> = {
  flat: { pl: 'Płaska (bez wzrostu)', en: 'Flat (no growth)' },
  growth_rate: { pl: 'Stopa wzrostu', en: 'Growth rate' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};

export function roiBaselineProjectionMethodLabel(value: RoiBaselineProjectionMethod, isPolish: boolean): string {
  return isPolish ? ROI_BASELINE_PROJECTION_METHOD_LABELS[value].pl : ROI_BASELINE_PROJECTION_METHOD_LABELS[value].en;
}

// ==========================================
// Calculation policy
// ==========================================

export const ROI_TAX_TREATMENT_LABELS: Record<RoiTaxTreatment, { pl: string; en: string }> = {
  pre_tax: { pl: 'Przed opodatkowaniem', en: 'Pre-tax' },
  post_tax: { pl: 'Po opodatkowaniu', en: 'Post-tax' },
  not_modeled: { pl: 'Nie modelowane', en: 'Not modeled' },
};

export function roiTaxTreatmentLabel(value: RoiTaxTreatment | null, isPolish: boolean): string {
  if (!value) return '—';
  return isPolish ? ROI_TAX_TREATMENT_LABELS[value].pl : ROI_TAX_TREATMENT_LABELS[value].en;
}

export const ROI_ROUNDING_POLICY_LABELS: Record<RoiRoundingPolicy, { pl: string; en: string }> = {
  half_up_2dp: { pl: 'W górę, 2 miejsca po przecinku', en: 'Half up, 2 decimals' },
  half_even_2dp: { pl: 'Bankierskie, 2 miejsca po przecinku', en: "Half even (banker's), 2 decimals" },
  none: { pl: 'Bez zaokrąglania', en: 'No rounding' },
};

export function roiRoundingPolicyLabel(value: RoiRoundingPolicy, isPolish: boolean): string {
  return isPolish ? ROI_ROUNDING_POLICY_LABELS[value].pl : ROI_ROUNDING_POLICY_LABELS[value].en;
}

// ==========================================
// Assumptions / cost lines / benefit lines — timing
// ==========================================

export const ROI_TIMING_TYPE_LABELS: Record<RoiTimingType, { pl: string; en: string }> = {
  one_time: { pl: 'Jednorazowa', en: 'One-time' },
  recurring: { pl: 'Cykliczna', en: 'Recurring' },
};

export function roiTimingTypeLabel(value: RoiTimingType, isPolish: boolean): string {
  return isPolish ? ROI_TIMING_TYPE_LABELS[value].pl : ROI_TIMING_TYPE_LABELS[value].en;
}

export const ROI_RECURRENCE_CADENCE_LABELS: Record<RoiRecurrenceCadence, { pl: string; en: string }> = {
  monthly: { pl: 'Miesięcznie', en: 'Monthly' },
  quarterly: { pl: 'Kwartalnie', en: 'Quarterly' },
  annual: { pl: 'Rocznie', en: 'Annually' },
};

export function roiRecurrenceCadenceLabel(value: RoiRecurrenceCadence | null, isPolish: boolean): string {
  if (!value) return '—';
  return isPolish ? ROI_RECURRENCE_CADENCE_LABELS[value].pl : ROI_RECURRENCE_CADENCE_LABELS[value].en;
}

/** One-line honest summary of a line item's timing shape — used in table
 * cells where there's no room for the full properties table. Never invents
 * a date/cadence that isn't on the row (a one-time line with no date shows
 * "One-time" alone, not a fabricated "—" date glued on). */
export function describeRoiLineTiming(
  row: {
    timingType: RoiTimingType;
    oneTimePeriodDate: string | null;
    recurrenceCadence: RoiRecurrenceCadence | null;
  },
  isPolish: boolean,
  formatDate: (value: string | null, isPolish: boolean) => string
): string {
  if (row.timingType === 'one_time') {
    return row.oneTimePeriodDate
      ? `${roiTimingTypeLabel('one_time', isPolish)} · ${formatDate(row.oneTimePeriodDate, isPolish)}`
      : roiTimingTypeLabel('one_time', isPolish);
  }
  return row.recurrenceCadence
    ? `${roiTimingTypeLabel('recurring', isPolish)} · ${roiRecurrenceCadenceLabel(row.recurrenceCadence, isPolish)}`
    : roiTimingTypeLabel('recurring', isPolish);
}
