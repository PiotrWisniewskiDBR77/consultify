/**
 * presentationOperationsAnomalyDetectionService
 *
 * Pure statistical anomaly detection for the SuperAdmin "Operations Health"
 * scoreboard. Given an SLO id, the current observed value, and a series of
 * baseline samples (typically 24 hourly buckets immediately preceding now),
 * this service produces a typed verdict that the route layer can emit as a
 * `anomaly_detected` runtime event AND surface as an orange chip on the
 * affected SLO card.
 *
 * Algorithm (z-score, one-sided, direction-aware):
 *
 *   1. Drop baseline samples whose `observedValue` is null or non-finite.
 *   2. Need at least {@link MIN_BASELINE_SAMPLES} (= 6) valid samples;
 *      otherwise return `insufficient_data` so the UI does not flag noise
 *      from cold-start dashboards.
 *   3. Reject `current === null` / non-finite as `invalid_input`.
 *   4. Compute baseline mean and population standard deviation.
 *   5. If stdev < {@link MIN_BASELINE_STDEV} (≈ 0) the baseline is too
 *      uniform to be a meaningful reference — return `insufficient_data`
 *      to avoid divide-by-zero z-scores.
 *   6. z = (current - mean) / stdev.
 *   7. Direction-aware classification:
 *        - "higher_is_better" SLOs (success rates) only flag when current
 *          is BELOW the baseline (z <= -2.5 minor, z <= -3.5 major).
 *          A positive z (current > baseline) is an improvement, not a
 *          regression — never flag it.
 *        - "lower_is_better" SLOs (latency, blocked rate) mirror the
 *          thresholds: only flag when current is ABOVE the baseline
 *          (z >= +2.5 minor, z >= +3.5 major).
 *
 * The service NEVER throws on bad input — invalid contexts return a
 * verdict object describing the failure. This keeps the surrounding
 * Operations Health endpoint resilient: anomaly detection is a best-effort
 * enhancement that must never take down the scoreboard. See
 * `docs/operations/PRESENTATION_OPS_ANOMALY_DETECTION.md` for the full
 * operator playbook.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AnomalyDirection = 'above' | 'below';
export type AnomalySeverity = 'minor' | 'major';

export type AnomalyStatus = 'detected' | 'no_anomaly' | 'insufficient_data' | 'invalid_input';

export type AnomalySloId =
  | 'generation_success_rate'
  | 'export_success_rate'
  | 'p95_generation_latency_ms'
  | 'agent_edit_success_rate'
  | 'export_blocked_rate';

/**
 * Alias of {@link AnomalySloId} kept stable for the route layer's import.
 * The route uses it to declare its allow-list of detectable SLO ids; we
 * intentionally re-export under this name so callers don't have to import
 * the slightly different `AnomalySloId` symbol.
 */
export type DetectableSloId = AnomalySloId;

export interface AnomalySample {
  observedAt: string;
  observedValue: number | null;
}

export interface DetectAnomalyInput {
  sloId: AnomalySloId;
  current: number | null;
  baseline: AnomalySample[];
  nowIso?: string;
}

export interface AnomalyVerdict {
  status: AnomalyStatus;
  direction?: AnomalyDirection;
  severity?: AnomalySeverity;
  baselineMean: number | null;
  baselineStdev: number | null;
  zScore: number | null;
  reason: string;
}

export interface AnomalyContext {
  sloId: string;
  current: number | null;
  baseline: AnomalySample[];
}

export interface DetectAnomaliesForReportInput {
  contexts: AnomalyContext[];
  nowIso?: string;
}

export interface AnomalyContextResult {
  sloId: string;
  verdict: AnomalyVerdict;
}

// ---------------------------------------------------------------------------
// Tunable constants
//
// These are intentionally exported as constants (not config-driven) so the
// thresholds appear in one place. Operators wanting to tune them can edit
// this file and rerun the service test suite. See the docs file for the
// rationale behind each number.
// ---------------------------------------------------------------------------

/** Minimum valid baseline samples required to compute a verdict. */
export const MIN_BASELINE_SAMPLES = 6;

/** Floor on baseline stdev. Anything below this is treated as "no signal". */
export const MIN_BASELINE_STDEV = 0.0001;

/** |z| at or beyond this magnitude is a major anomaly. */
export const MAJOR_Z_THRESHOLD = 3.5;

/** |z| at or beyond this magnitude (but below the major) is a minor anomaly. */
export const MINOR_Z_THRESHOLD = 2.5;

/**
 * Per-SLO direction interpretation. "higher_is_better" means we flag drops
 * (negative z), "lower_is_better" means we flag spikes (positive z).
 */
const SLO_DIRECTION: Record<AnomalySloId, 'higher_is_better' | 'lower_is_better'> = {
  generation_success_rate: 'higher_is_better',
  export_success_rate: 'higher_is_better',
  agent_edit_success_rate: 'higher_is_better',
  p95_generation_latency_ms: 'lower_is_better',
  export_blocked_rate: 'lower_is_better',
};

const ALLOWED_SLO_IDS = new Set<string>(Object.keys(SLO_DIRECTION));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function filterValidBaseline(samples: AnomalySample[] | undefined | null): number[] {
  if (!Array.isArray(samples)) return [];
  const out: number[] = [];
  for (const s of samples) {
    if (!s) continue;
    const v = (s as AnomalySample).observedValue;
    if (isFiniteNumber(v)) out.push(v);
  }
  return out;
}

function meanOf(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function populationStdev(values: number[], mean: number): number {
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}

function severityFromAbsZ(absZ: number): AnomalySeverity | null {
  if (absZ >= MAJOR_Z_THRESHOLD) return 'major';
  if (absZ >= MINOR_Z_THRESHOLD) return 'minor';
  return null;
}

function makeFailureVerdict(
  status: AnomalyStatus,
  reason: string,
  baselineMean: number | null,
  baselineStdev: number | null
): AnomalyVerdict {
  return {
    status,
    baselineMean,
    baselineStdev,
    zScore: null,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Public entrypoint — single SLO
// ---------------------------------------------------------------------------

export function detectAnomaly(input: DetectAnomalyInput): AnomalyVerdict {
  if (!input || !ALLOWED_SLO_IDS.has(String(input.sloId))) {
    return makeFailureVerdict(
      'invalid_input',
      `Unknown SLO id: ${input?.sloId ?? '<missing>'}`,
      null,
      null
    );
  }

  const validBaseline = filterValidBaseline(input.baseline);

  if (validBaseline.length < MIN_BASELINE_SAMPLES) {
    return makeFailureVerdict(
      'insufficient_data',
      `Need >=${MIN_BASELINE_SAMPLES} baseline samples; got ${validBaseline.length}`,
      validBaseline.length > 0 ? meanOf(validBaseline) : null,
      null
    );
  }

  if (!isFiniteNumber(input.current)) {
    const m = meanOf(validBaseline);
    return makeFailureVerdict(
      'invalid_input',
      'No current observed value',
      m,
      populationStdev(validBaseline, m)
    );
  }

  const mean = meanOf(validBaseline);
  const stdev = populationStdev(validBaseline, mean);

  if (stdev < MIN_BASELINE_STDEV) {
    return makeFailureVerdict(
      'insufficient_data',
      `Baseline variance too small (stdev=${stdev.toExponential(2)})`,
      mean,
      stdev
    );
  }

  const current = input.current as number;
  const z = (current - mean) / stdev;
  const direction: AnomalyDirection = current >= mean ? 'above' : 'below';
  const sloId = input.sloId;
  const polarity = SLO_DIRECTION[sloId];

  // Direction-aware filter: success-rate SLOs ignore positive z (= current
  // is BETTER than baseline), latency / blocked-rate SLOs ignore negative z
  // (= current is BETTER than baseline). An SLO becoming better than its
  // 24h baseline is good news — never an anomaly.
  const isRegression = polarity === 'higher_is_better' ? z < 0 : z > 0;

  if (!isRegression) {
    return {
      status: 'no_anomaly',
      direction,
      baselineMean: mean,
      baselineStdev: stdev,
      zScore: z,
      reason: `Current is better than baseline (z=${z.toFixed(2)}, polarity=${polarity})`,
    };
  }

  const severity = severityFromAbsZ(Math.abs(z));
  if (!severity) {
    return {
      status: 'no_anomaly',
      direction,
      baselineMean: mean,
      baselineStdev: stdev,
      zScore: z,
      reason: `|z|=${Math.abs(z).toFixed(2)} below minor threshold ${MINOR_Z_THRESHOLD}`,
    };
  }

  return {
    status: 'detected',
    direction,
    severity,
    baselineMean: mean,
    baselineStdev: stdev,
    zScore: z,
    reason: severityReason({
      sloId,
      direction,
      severity,
      z,
      mean,
      stdev,
      current,
    }),
  };
}

interface SeverityReasonInput {
  sloId: AnomalySloId;
  direction: AnomalyDirection;
  severity: AnomalySeverity;
  z: number;
  mean: number;
  stdev: number;
  current: number;
}

function severityReason(p: SeverityReasonInput): string {
  const threshold = p.severity === 'major' ? MAJOR_Z_THRESHOLD : MINOR_Z_THRESHOLD;
  return (
    `${p.severity.toUpperCase()} anomaly on ${p.sloId}: ` +
    `current=${p.current.toFixed(3)} is ${p.direction} ` +
    `baseline mean=${p.mean.toFixed(3)} (stdev=${p.stdev.toFixed(3)}); ` +
    `z=${p.z.toFixed(2)}, |z| >= ${threshold}`
  );
}

// ---------------------------------------------------------------------------
// Public entrypoint — batch report
// ---------------------------------------------------------------------------

export function detectAnomaliesForReport(
  input: DetectAnomaliesForReportInput
): AnomalyContextResult[] {
  const out: AnomalyContextResult[] = [];
  const contexts = Array.isArray(input?.contexts) ? input.contexts : [];
  for (const ctx of contexts) {
    if (!ctx || typeof ctx.sloId !== 'string') continue;
    let verdict: AnomalyVerdict;
    try {
      verdict = detectAnomaly({
        sloId: ctx.sloId as AnomalySloId,
        current: ctx.current,
        baseline: Array.isArray(ctx.baseline) ? ctx.baseline : [],
        nowIso: input?.nowIso,
      });
    } catch (err) {
      // Detector is pure and should not throw, but the route layer treats
      // anomaly detection as best-effort. Defend against future regressions
      // so a single bad context cannot poison the whole report.
      verdict = makeFailureVerdict(
        'invalid_input',
        `Detector threw: ${(err as Error)?.message || 'unknown'}`,
        null,
        null
      );
    }
    out.push({ sloId: ctx.sloId, verdict });
  }
  return out;
}
