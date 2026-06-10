/**
 * financeModelLabels — pure derivation helpers for Finance model summary columns
 * and the Teresa AI prelude.
 *
 * These were previously hardcoded strings in useFinanceData (PLAN_08b P0-A). They
 * now read the real DB fields (scenario, horizon_months, event_count) so the
 * Models / Prediction tabs reflect actual model data. Kept pure + dependency-free
 * so they can be unit-tested without mounting FinanceHub.
 */

export type TranslateFn = (key: string, fallback: string) => string;

/**
 * Forecast-window label derived from the model start year and its actual horizon
 * (in months). Falls back to a 2-year window when horizon is absent/zero.
 */
export function deriveForecastWindowLabel(startDate: unknown, horizonMonths: unknown): string {
  const startYear =
    Number.parseInt(String(startDate || '').slice(0, 4), 10) || new Date().getFullYear();
  const months = Number(horizonMonths) || 0;
  const years = months > 0 ? Math.ceil(months / 12) : 2;
  return `${startYear}-${startYear + years}`;
}

/**
 * Localises the real `scenario` DB field. Unknown scenarios fall back to the raw
 * value so we never render a hardcoded placeholder.
 */
export function deriveVariantLabel(scenario: unknown, t: TranslateFn): string {
  const raw = String(scenario || 'base')
    .trim()
    .toLowerCase();
  if (raw === 'base') return t('finance.model.scenarioBase', 'Base');
  if (raw === 'optimistic') return t('finance.model.scenarioOptimistic', 'Optimistic');
  if (raw === 'conservative') return t('finance.model.scenarioConservative', 'Conservative');
  return String(scenario || 'base');
}

/**
 * Analytical-depth label (L1/L2/L3) derived from the model's active event count,
 * which the modeling service returns as `event_count`.
 */
export function deriveAnalyticalDepthLabel(eventCount: unknown, t: TranslateFn): string {
  const count = Number(eventCount ?? 0);
  if (count >= 10) return t('finance.model.depthL3', 'L3 (deep)');
  if (count >= 5) return t('finance.model.depthL2', 'L2 (standard)');
  return t('finance.model.depthL1', 'L1 (light)');
}

/**
 * Builds the Teresa AI prelude for a Finance entity. Model/prediction rows get a
 * business-case prompt (assumptions, drivers, NPV/ROI/payback); everything else
 * gets a generic financial-deliverable prompt. (PLAN_08b P0-D.)
 */
export function buildFinanceTeresaPrompt(kind: string, t: TranslateFn): string {
  const isModel = kind === 'models' || kind === 'prediction';
  return isModel
    ? t(
        'finance.teresa.explainModel',
        'Explain this financial model: its assumptions, the key drivers, and what the NPV/ROI/payback results mean for the client.'
      )
    : t(
        'finance.teresa.explainEntity',
        'Explain this financial deliverable: its assumptions, key drivers, and what the results mean for the client.'
      );
}
