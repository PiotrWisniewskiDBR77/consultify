/**
 * ROI Case FULL TOOL — pure mapping helpers (labels/formatters/honest-value
 * derivation) for the 11 sub-resource groups `roiCaseFullToolApi.ts` adds.
 * No React — same split as `roiRegistryMappers.ts`/`roiCaseDetailMappers.ts`,
 * shared by the presenters file and the dev-render mock screen.
 *
 * Every status/enum value pairs 1:1 with the const arrays exported from
 * `roiCaseFullToolApi.ts` (themselves copied verbatim from server CHECK
 * constraints/TS const arrays) — no 4th/5th value invented, no label
 * collapsing two states into one.
 */
import type { HonestValue } from '../types';
import type {
  RoiActualEntryType,
  RoiCalculationRun,
  RoiDataQualityStatus,
  RoiEvidenceLinkDisputeStatus,
  RoiEvidenceLinkPurpose,
  RoiFinanceReconciliationStatus,
  RoiForecastVersion,
  RoiPirOutcome,
  RoiPirStatus,
  RoiPirTeresaDraftDisposition,
  RoiScenarioOverrideTargetType,
  RoiScenarioType,
  RoiVarianceComparisonType,
  RoiVarianceStatus,
} from './roiCaseFullToolApi';
import { irrNotCalculableReason, npvNotCalculableReason } from './roiRegistryMappers';

// ==========================================
// Scenarios
// ==========================================

export const ROI_SCENARIO_TYPE_LABELS: Record<RoiScenarioType, { pl: string; en: string }> = {
  downside: { pl: 'Pesymistyczny', en: 'Downside' },
  upside: { pl: 'Optymistyczny', en: 'Upside' },
  custom: { pl: 'Niestandardowy', en: 'Custom' },
};
export function roiScenarioTypeLabel(value: RoiScenarioType, isPolish: boolean): string {
  return isPolish ? ROI_SCENARIO_TYPE_LABELS[value].pl : ROI_SCENARIO_TYPE_LABELS[value].en;
}

export const ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS: Record<RoiScenarioOverrideTargetType, { pl: string; en: string }> = {
  assumption: { pl: 'Założenie', en: 'Assumption' },
  cost_line: { pl: 'Pozycja kosztowa', en: 'Cost line' },
  benefit_line: { pl: 'Pozycja korzyści', en: 'Benefit line' },
};
export function roiScenarioOverrideTargetTypeLabel(value: RoiScenarioOverrideTargetType, isPolish: boolean): string {
  return isPolish
    ? ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS[value].pl
    : ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS[value].en;
}

// ==========================================
// KPI evidence links
// ==========================================

export const ROI_EVIDENCE_LINK_PURPOSE_LABELS: Record<RoiEvidenceLinkPurpose, { pl: string; en: string }> = {
  primary_evidence: { pl: 'Dowód główny', en: 'Primary evidence' },
  supporting: { pl: 'Dowód pomocniczy', en: 'Supporting' },
};
export function roiEvidenceLinkPurposeLabel(value: RoiEvidenceLinkPurpose, isPolish: boolean): string {
  return isPolish ? ROI_EVIDENCE_LINK_PURPOSE_LABELS[value].pl : ROI_EVIDENCE_LINK_PURPOSE_LABELS[value].en;
}

export const ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS: Record<RoiEvidenceLinkDisputeStatus, { pl: string; en: string }> = {
  none: { pl: 'Brak sporu', en: 'None' },
  stale: { pl: 'Nieaktualny', en: 'Stale' },
  disputed: { pl: 'Sporny', en: 'Disputed' },
};
export function roiEvidenceLinkDisputeStatusLabel(value: RoiEvidenceLinkDisputeStatus, isPolish: boolean): string {
  return isPolish ? ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS[value].pl : ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS[value].en;
}

// ==========================================
// Actuals
// ==========================================

export const ROI_ACTUAL_ENTRY_TYPE_LABELS: Record<RoiActualEntryType, { pl: string; en: string }> = {
  cost: { pl: 'Koszt', en: 'Cost' },
  benefit: { pl: 'Korzyść', en: 'Benefit' },
  observation: { pl: 'Obserwacja', en: 'Observation' },
};
export function roiActualEntryTypeLabel(value: RoiActualEntryType, isPolish: boolean): string {
  return isPolish ? ROI_ACTUAL_ENTRY_TYPE_LABELS[value].pl : ROI_ACTUAL_ENTRY_TYPE_LABELS[value].en;
}

export const ROI_DATA_QUALITY_STATUS_LABELS: Record<RoiDataQualityStatus, { pl: string; en: string }> = {
  unverified: { pl: 'Niezweryfikowane', en: 'Unverified' },
  verified: { pl: 'Zweryfikowane', en: 'Verified' },
  disputed: { pl: 'Sporne', en: 'Disputed' },
  estimated: { pl: 'Szacowane', en: 'Estimated' },
};
export function roiDataQualityStatusLabel(value: RoiDataQualityStatus, isPolish: boolean): string {
  return isPolish ? ROI_DATA_QUALITY_STATUS_LABELS[value].pl : ROI_DATA_QUALITY_STATUS_LABELS[value].en;
}
export type RoiDataQualityTone = 'neutral' | 'success' | 'danger' | 'info';
export const ROI_DATA_QUALITY_TONE: Record<RoiDataQualityStatus, RoiDataQualityTone> = {
  unverified: 'neutral',
  verified: 'success',
  disputed: 'danger',
  estimated: 'info',
};

// ==========================================
// Variances
// ==========================================

export const ROI_VARIANCE_COMPARISON_TYPE_LABELS: Record<RoiVarianceComparisonType, { pl: string; en: string }> = {
  approved_vs_forecast: { pl: 'Zaakceptowane vs prognoza', en: 'Approved vs forecast' },
  approved_vs_actual: { pl: 'Zaakceptowane vs wykonanie', en: 'Approved vs actual' },
  forecast_vs_actual: { pl: 'Prognoza vs wykonanie', en: 'Forecast vs actual' },
};
export function roiVarianceComparisonTypeLabel(value: RoiVarianceComparisonType, isPolish: boolean): string {
  return isPolish ? ROI_VARIANCE_COMPARISON_TYPE_LABELS[value].pl : ROI_VARIANCE_COMPARISON_TYPE_LABELS[value].en;
}

export const ROI_VARIANCE_STATUS_LABELS: Record<RoiVarianceStatus, { pl: string; en: string }> = {
  open: { pl: 'Otwarta', en: 'Open' },
  explained: { pl: 'Wyjaśniona', en: 'Explained' },
  action_planned: { pl: 'Zaplanowano działanie', en: 'Action planned' },
  resolved: { pl: 'Rozwiązana', en: 'Resolved' },
};
export function roiVarianceStatusLabel(value: RoiVarianceStatus, isPolish: boolean): string {
  return isPolish ? ROI_VARIANCE_STATUS_LABELS[value].pl : ROI_VARIANCE_STATUS_LABELS[value].en;
}
export type RoiVarianceTone = 'neutral' | 'warning' | 'info' | 'success';
export const ROI_VARIANCE_STATUS_TONE: Record<RoiVarianceStatus, RoiVarianceTone> = {
  open: 'warning',
  explained: 'info',
  action_planned: 'info',
  resolved: 'success',
};

export const ROI_COMPARE_METRIC_LABELS: Record<string, { pl: string; en: string }> = {
  npv: { pl: 'NPV', en: 'NPV' },
  simpleRoi: { pl: 'Prosty ROI', en: 'Simple ROI' },
  totalCosts: { pl: 'Suma kosztów', en: 'Total costs' },
  totalFinancialBenefits: { pl: 'Suma korzyści finansowych', en: 'Total financial benefits' },
  paybackPeriods: { pl: 'Okres zwrotu', en: 'Payback periods' },
};
export function roiCompareMetricLabel(value: string, isPolish: boolean): string {
  const entry = ROI_COMPARE_METRIC_LABELS[value];
  if (!entry) return value;
  return isPolish ? entry.pl : entry.en;
}

// ==========================================
// PIR
// ==========================================

export const ROI_PIR_STATUS_LABELS: Record<RoiPirStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  finalized: { pl: 'Zamknięty', en: 'Finalized' },
};
export function roiPirStatusLabel(value: RoiPirStatus, isPolish: boolean): string {
  return isPolish ? ROI_PIR_STATUS_LABELS[value].pl : ROI_PIR_STATUS_LABELS[value].en;
}

export const ROI_PIR_OUTCOME_LABELS: Record<RoiPirOutcome, { pl: string; en: string }> = {
  benefits_fully_realized: { pl: 'Korzyści w pełni zrealizowane', en: 'Benefits fully realized' },
  benefits_partially_realized: { pl: 'Korzyści częściowo zrealizowane', en: 'Benefits partially realized' },
  benefits_not_realized: { pl: 'Korzyści niezrealizowane', en: 'Benefits not realized' },
};
export function roiPirOutcomeLabel(value: RoiPirOutcome | null, isPolish: boolean): string {
  if (!value) return '—';
  return isPolish ? ROI_PIR_OUTCOME_LABELS[value].pl : ROI_PIR_OUTCOME_LABELS[value].en;
}

export const ROI_PIR_TERESA_DISPOSITION_LABELS: Record<RoiPirTeresaDraftDisposition, { pl: string; en: string }> = {
  accepted: { pl: 'Zaakceptowano', en: 'Accepted' },
  rejected: { pl: 'Odrzucono', en: 'Rejected' },
  edited_then_accepted: { pl: 'Zmieniono i zaakceptowano', en: 'Edited then accepted' },
};
export function roiPirTeresaDispositionLabel(value: RoiPirTeresaDraftDisposition | null, isPolish: boolean): string {
  if (!value) return '—';
  return isPolish ? ROI_PIR_TERESA_DISPOSITION_LABELS[value].pl : ROI_PIR_TERESA_DISPOSITION_LABELS[value].en;
}

// ==========================================
// Finance reconciliations
// ==========================================

export const ROI_FINANCE_RECONCILIATION_STATUS_LABELS: Record<RoiFinanceReconciliationStatus, { pl: string; en: string }> = {
  open: { pl: 'Otwarta', en: 'Open' },
  investigating: { pl: 'W wyjaśnianiu', en: 'Investigating' },
  resolved: { pl: 'Rozwiązana', en: 'Resolved' },
  accepted_divergence: { pl: 'Zaakceptowana rozbieżność', en: 'Accepted divergence' },
};
export function roiFinanceReconciliationStatusLabel(value: RoiFinanceReconciliationStatus, isPolish: boolean): string {
  return isPolish
    ? ROI_FINANCE_RECONCILIATION_STATUS_LABELS[value].pl
    : ROI_FINANCE_RECONCILIATION_STATUS_LABELS[value].en;
}
export type RoiFinanceReconciliationTone = 'warning' | 'info' | 'success' | 'neutral';
export const ROI_FINANCE_RECONCILIATION_STATUS_TONE: Record<RoiFinanceReconciliationStatus, RoiFinanceReconciliationTone> = {
  open: 'warning',
  investigating: 'info',
  resolved: 'success',
  accepted_divergence: 'neutral',
};

// ==========================================
// Honest-value derivation — calculation runs / forecast versions share the
// exact same NPV/IRR shape the registry's `deriveNpvHonestValue`/
// `deriveIrrHonestValue` already handle for `RoiCalculationRunSummary`. This
// package's `RoiCalculationRun`/`RoiForecastVersion` carry the identical
// `status`/`irrPct`/`irrStatus` fields (verbatim server shape,
// `roiEconomicModelTypes.ts` L589-617 / `roiForecastActualTypes.ts` L77-107)
// — narrow structurally instead of duplicating the two functions a third
// and fourth time.
// ==========================================

type NpvIrrShape = { status: 'completed' | 'failed'; npv: number | null; irrPct: number | null; irrStatus: string };

export function deriveRunOrForecastNpv(run: NpvIrrShape | null): HonestValue<number> {
  if (!run) return null;
  if (run.status === 'failed') return 'not_calculable';
  return run.npv;
}
export function deriveRunOrForecastIrr(run: NpvIrrShape | null): HonestValue<number> {
  if (!run) return null;
  if (run.status === 'failed') return 'not_calculable';
  if (run.irrStatus !== 'computed') return 'not_calculable';
  return run.irrPct;
}

export function calcRunNpvReason(run: RoiCalculationRun | null, isPolish: boolean): string {
  return npvNotCalculableReason(run as unknown as Parameters<typeof npvNotCalculableReason>[0], isPolish);
}
export function calcRunIrrReason(run: RoiCalculationRun | null, isPolish: boolean): string {
  return irrNotCalculableReason(run as unknown as Parameters<typeof irrNotCalculableReason>[0], isPolish);
}
export function forecastVersionNpvReason(fv: RoiForecastVersion | null, isPolish: boolean): string {
  return npvNotCalculableReason(fv as unknown as Parameters<typeof npvNotCalculableReason>[0], isPolish);
}
export function forecastVersionIrrReason(fv: RoiForecastVersion | null, isPolish: boolean): string {
  return irrNotCalculableReason(fv as unknown as Parameters<typeof irrNotCalculableReason>[0], isPolish);
}
