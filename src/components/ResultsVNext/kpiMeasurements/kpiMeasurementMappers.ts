/**
 * RN-G2 §G #7 — KPI Measurements pure mapping helpers (status labels/tones,
 * formatters). No React — mirrors `../kpiScorecards/kpiScorecardMappers.ts`'s
 * own rationale: one implementation shared by `kpiMeasurementPresenters.tsx`
 * (live `ResultsKpiMeasurementsPanel.tsx`) and the dev-render mock harness,
 * not two that can silently drift.
 *
 * -- ENUMS ARE THE REAL SERVER ONES (`server/src/services/resultsVnext/kpi/kpiTypes.ts`
 * `KPI_PERFORMANCE_STATUSES`/`KPI_DATA_QUALITY_STATUSES`, re-declared
 * client-side per this package's convention) — verified by reading
 * `targetGeometryEvaluator.ts`, NOT guessed:
 *   `performanceStatus` ∈ {'on_target','warning','critical','neutral'} — a
 *   plain 4-state enum, NEVER `'not_calculable'`. `evaluatePerformanceStatus`
 *   is total (never throws) and degrades missing/invalid input to
 *   `'neutral'` — that IS this domain's "can't compute a real status" case,
 *   already covered by an existing enum value, not a 3-way honest-missing
 *   domain the way ROI's NPV/IRR or OKR's progress are (see
 *   `RN_G2_OPEN_QUESTIONS_UI.md` OQ-UI-C, confirmed independently here for
 *   `performanceStatus` specifically: zero occurrences of `not_calculable`
 *   anywhere in `targetGeometryEvaluator.ts`/`kpiMeasurementCommands.ts`).
 *   `HonestValueCell` is therefore used ONLY for `actualValue` (a genuine
 *   `number | null` — never `not_calculable` in this domain either, see
 *   `kpiApi.ts`'s `KpiMeasurementDto` doc), not for `performanceStatus`,
 *   which always has a real, renderable value.
 */
import type { KpiDataQualityStatus, KpiPerformanceStatus } from '../kpiApi';

// ==========================================
// performanceStatus — labels/tone. Server-computed only (see kpiApi.ts
// header) — this module never evaluates target geometry itself.
// ==========================================

export const KPI_PERFORMANCE_STATUS_LABELS: Record<KpiPerformanceStatus, { pl: string; en: string }> = {
  on_target: { pl: 'W celu', en: 'On target' },
  warning: { pl: 'Ostrzeżenie', en: 'Warning' },
  critical: { pl: 'Krytyczny', en: 'Critical' },
  neutral: { pl: 'Neutralny', en: 'Neutral' },
};

export function kpiPerformanceStatusLabel(status: KpiPerformanceStatus, isPolish: boolean): string {
  return isPolish ? KPI_PERFORMANCE_STATUS_LABELS[status].pl : KPI_PERFORMANCE_STATUS_LABELS[status].en;
}

export type KpiMeasurementStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const KPI_PERFORMANCE_STATUS_TONE: Record<KpiPerformanceStatus, KpiMeasurementStatusTone> = {
  on_target: 'success',
  warning: 'warning',
  critical: 'danger',
  neutral: 'neutral',
};

// ==========================================
// dataQualityStatus — labels/tone. `'estimated'` is part of the real server
// enum (`KPI_DATA_QUALITY_STATUSES`) but no command in
// `kpiMeasurementCommands.ts` ever sets it (only `recordMeasurement`'s fixed
// `'unverified'` insert and `correct`/`verify`/`dispute`'s fixed targets —
// see that file's header) — kept in the label map for completeness (a future
// import/connector path could set it directly in the DB) but never reachable
// from any action this package builds.
// ==========================================

export const KPI_DATA_QUALITY_STATUS_LABELS: Record<KpiDataQualityStatus, { pl: string; en: string }> = {
  unverified: { pl: 'Niezweryfikowany', en: 'Unverified' },
  verified: { pl: 'Zweryfikowany', en: 'Verified' },
  disputed: { pl: 'Zakwestionowany', en: 'Disputed' },
  estimated: { pl: 'Szacunkowy', en: 'Estimated' },
};

export function kpiDataQualityStatusLabel(status: KpiDataQualityStatus, isPolish: boolean): string {
  return isPolish
    ? KPI_DATA_QUALITY_STATUS_LABELS[status].pl
    : KPI_DATA_QUALITY_STATUS_LABELS[status].en;
}

export const KPI_DATA_QUALITY_STATUS_TONE: Record<KpiDataQualityStatus, KpiMeasurementStatusTone> = {
  unverified: 'info',
  verified: 'success',
  disputed: 'danger',
  estimated: 'warning',
};

// ==========================================
// Formatters — locale follows `isPolish`, matching the repo-wide convention
// (`../ResultsKpiRegistryPage.tsx` / `../kpiScorecards/kpiScorecardMappers.ts`).
// ==========================================

export function formatKpiMeasurementDate(value: string | null | undefined, isPolish: boolean): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatKpiMeasurementDateTime(value: string | null | undefined, isPolish: boolean): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKpiMeasurementPeriod(
  periodStart: string,
  periodEnd: string,
  isPolish: boolean
): string {
  return `${formatKpiMeasurementDate(periodStart, isPolish)} – ${formatKpiMeasurementDate(periodEnd, isPolish)}`;
}

export function shortKpiMeasurementId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

/** `actualValue`/`unit` — the panel never has a unit to attach (see
 * `RN_G2_OPEN_QUESTIONS_UI.md`/task brief: no GET returns the joined
 * `rvn_kpi_definition_versions` row, so `unit` is unreachable from any read
 * this package can make). Renders the raw number, honestly unitless —
 * NEVER guesses or fabricates a unit string. */
export function formatKpiActualValue(value: number, isPolish: boolean): string {
  return value.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 4 });
}
