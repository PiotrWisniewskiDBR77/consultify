/**
 * M16/2.9 — KPI lineage (leading vs lagging indicators).
 *
 * Pure, dependency-free logic. Given pairs of (leading, lagging) KPI movements,
 * surface early-warning signals: a leading indicator that has moved meaningfully
 * while the lagging indicator it predicts is still flat. That divergence is the
 * earliest moment a problem (or win) is visible — before it shows up in results.
 */

/** Default movement threshold (percent). A delta whose |value| exceeds this counts as "moved". */
export const DEFAULT_MOVEMENT_THRESHOLD_PCT = 5;

export interface KpiLineagePair {
  leadingKpiId: string;
  /** Percent change of the leading KPI over the observed window. */
  leadingDeltaPct: number;
  laggingKpiId: string;
  /** Percent change of the lagging KPI over the same window. */
  laggingDeltaPct: number;
}

export interface EarlyWarning {
  leadingKpiId: string;
  laggingKpiId: string;
  warning: string;
}

function isMoved(deltaPct: number, threshold: number): boolean {
  return Number.isFinite(deltaPct) && Math.abs(deltaPct) > threshold;
}

function isFlat(deltaPct: number, threshold: number): boolean {
  return Number.isFinite(deltaPct) && Math.abs(deltaPct) <= threshold;
}

/**
 * Detect early-warning signals across leading→lagging KPI pairs.
 *
 * A warning is raised when the leading KPI has moved (|delta| > threshold) but the
 * linked lagging KPI is still flat (|delta| <= threshold). When both move or both
 * stay flat there is no divergence, so no warning is produced.
 *
 * @param pairs     leading/lagging movement pairs
 * @param threshold movement threshold in percent (default DEFAULT_MOVEMENT_THRESHOLD_PCT)
 */
export function detectEarlyWarnings(
  pairs: KpiLineagePair[],
  threshold: number = DEFAULT_MOVEMENT_THRESHOLD_PCT
): EarlyWarning[] {
  if (!Array.isArray(pairs)) return [];

  const warnings: EarlyWarning[] = [];

  for (const pair of pairs) {
    if (!pair || !pair.leadingKpiId || !pair.laggingKpiId) continue;

    const leadingMoved = isMoved(pair.leadingDeltaPct, threshold);
    const laggingFlat = isFlat(pair.laggingDeltaPct, threshold);

    if (leadingMoved && laggingFlat) {
      const direction = pair.leadingDeltaPct > 0 ? 'rose' : 'fell';
      warnings.push({
        leadingKpiId: pair.leadingKpiId,
        laggingKpiId: pair.laggingKpiId,
        warning:
          `Leading KPI ${pair.leadingKpiId} ${direction} by ` +
          `${pair.leadingDeltaPct.toFixed(1)}% but lagging KPI ` +
          `${pair.laggingKpiId} is still flat ` +
          `(${pair.laggingDeltaPct.toFixed(1)}%). Early-warning divergence.`,
      });
    }
  }

  return warnings;
}
