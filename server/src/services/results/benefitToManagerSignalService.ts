/**
 * benefitToManagerSignalService — pure functions for the M15 → M14 loop.
 *
 * Translates an at-risk realized benefit (M15 Results) into a signal destined
 * for the Manager-lane in M14 (Execution / Wdrożenie), plus escalation routing
 * and a roll-up summary. No DB, no I/O — deterministic and unit-testable.
 */

export interface BenefitInput {
  initiativeId?: string;
  name?: string;
  /** Realization ratio 0..1 (e.g. 0.55 = 55% of the benefit realized). */
  realizationPct?: number;
  /** Confidence 0..1 in the realization estimate. */
  confidence?: number;
  /** Explicit at-risk flag from upstream. */
  atRisk?: boolean;
  /** Economic value exposed if the benefit is not realized. */
  valueAtStake?: number;
}

export type BenefitSignalType = 'BENEFIT_AT_RISK';
export type BenefitSignalSeverity = 'warning' | 'critical';

export interface BenefitSignal {
  initiativeId?: string;
  initiativeName?: string;
  type: BenefitSignalType;
  severity: BenefitSignalSeverity;
  /** Human-readable title that quotes the realization. */
  title: string;
  valueAtStake?: number;
  suggestedAction: string;
  realizationPct?: number;
}

export interface EscalationTarget {
  escalateTo: 'sponsor' | 'pmo' | 'owner';
  reason: string;
}

export interface SignalsSummary {
  total: number;
  critical: number;
  valueAtRisk: number;
}

/** Realization at/under this ratio makes a benefit a signal. */
const REALIZATION_RISK_THRESHOLD = 0.6;
/** Realization below this ratio escalates the signal to critical. */
const REALIZATION_CRITICAL_THRESHOLD = 0.4;
/** valueAtStake at/above this makes the signal critical regardless of realization. */
const HIGH_VALUE_AT_STAKE = 100_000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function formatRealization(realizationPct?: number): string {
  if (!isFiniteNumber(realizationPct)) return 'realizacja nieznana';
  const pct = Math.round(realizationPct * 100);
  return `realizacja ${pct}%`;
}

/**
 * Build Manager-lane signals from realized-benefit items.
 * An item becomes a signal when it is flagged `atRisk` OR its realization < 0.6.
 * Severity is `critical` when realization < 0.4 OR valueAtStake is high.
 */
export function buildBenefitSignals(items: BenefitInput[]): BenefitSignal[] {
  if (!Array.isArray(items)) return [];

  const signals: BenefitSignal[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const realization = isFiniteNumber(item.realizationPct) ? item.realizationPct : undefined;
    const belowThreshold = realization !== undefined && realization < REALIZATION_RISK_THRESHOLD;
    const flagged = item.atRisk === true;

    if (!flagged && !belowThreshold) continue;

    const highValue = isFiniteNumber(item.valueAtStake) && item.valueAtStake >= HIGH_VALUE_AT_STAKE;
    const criticalRealization = realization !== undefined && realization < REALIZATION_CRITICAL_THRESHOLD;
    const severity: BenefitSignalSeverity = criticalRealization || highValue ? 'critical' : 'warning';

    const label = item.name && item.name.trim().length > 0 ? item.name.trim() : 'Korzyść';
    const title = `${label} zagrożona (${formatRealization(realization)})`;

    const suggestedAction =
      severity === 'critical'
        ? 'eskaluj do sponsora / uruchom akcję naprawczą'
        : 'zaplanuj akcję naprawczą / przegląd z ownerem';

    signals.push({
      initiativeId: item.initiativeId,
      initiativeName: item.name && item.name.trim().length > 0 ? item.name.trim() : undefined,
      type: 'BENEFIT_AT_RISK',
      severity,
      title,
      valueAtStake: isFiniteNumber(item.valueAtStake) ? item.valueAtStake : undefined,
      suggestedAction,
      realizationPct: isFiniteNumber(realization) ? realization : undefined,
    });
  }

  return signals;
}

/**
 * Route a signal to the right escalation owner.
 * critical → sponsor; high value (warning) → pmo; otherwise → owner.
 */
export function escalationForSignal(signal: BenefitSignal): EscalationTarget {
  if (signal.severity === 'critical') {
    return {
      escalateTo: 'sponsor',
      reason: `Korzyść krytycznie zagrożona: ${signal.title}`,
    };
  }

  if (isFiniteNumber(signal.valueAtStake) && signal.valueAtStake >= HIGH_VALUE_AT_STAKE) {
    return {
      escalateTo: 'pmo',
      reason: `Istotna wartość pod ryzykiem: ${signal.title}`,
    };
  }

  return {
    escalateTo: 'owner',
    reason: `Wymaga przeglądu właściciela: ${signal.title}`,
  };
}

/** Roll-up: count, critical count, total value at risk. */
export function signalsSummary(signals: BenefitSignal[]): SignalsSummary {
  if (!Array.isArray(signals)) {
    return { total: 0, critical: 0, valueAtRisk: 0 };
  }

  let critical = 0;
  let valueAtRisk = 0;

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.severity === 'critical') critical += 1;
    if (isFiniteNumber(signal.valueAtStake)) valueAtRisk += signal.valueAtStake;
  }

  return { total: signals.length, critical, valueAtRisk };
}
