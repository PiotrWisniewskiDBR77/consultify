/**
 * presentationBenchmarkTrendService — Sprint 15 Epic H2
 *
 * Pure-logic builder of the SuperAdmin "Benchmark Trend" report. Consumes a
 * chronological list of benchmark run records (one row per monthly DBR77/VTS
 * benchmark execution) and computes per-dimension movement toward the Gamma
 * target (default 4.0).
 *
 * The H1 scorecard service (Sprint 15) emits one `BenchmarkRunRecord` per
 * monthly run with five canonical dimension scores in the [0..5] range. To
 * keep H2 shippable independently of H1 the record shape is defined here and
 * re-exported; H1 can adopt the same shape later without breaking changes.
 *
 * Invariants:
 *   - Pure function. NEVER throws. Never reads `Date.now()` or the DB.
 *   - Run order independence: input is sorted internally by `recordedAt`.
 *   - Schema-tolerant DB helper: returns `[]` on missing table.
 *   - JSON-serializable output (no class instances, no Date objects).
 *   - Trend status thresholds intentionally use a wider band than the SLO
 *     gates so the dashboard surfaces movement BEFORE the gate is breached.
 *
 * Status thresholds (delta = averageLast3 - averageLast6):
 *   - improving:    delta >= +0.1
 *   - regressing:   delta <= -0.1
 *   - stable:       |delta|  < 0.1
 *   - inconclusive: < 3 points OR averageLast6 unavailable AND averageLast3
 *                   has fewer than 3 samples
 *
 * Overall verdict precedence:
 *   1. AHEAD_OF_TARGET: ALL dimensions latestValue >= gammaTarget.
 *   2. AT_RISK:         ANY dimension regressing AND latestValue < warningThreshold.
 *   3. TRACKING:        At least 1 dimension improving and no AT_RISK trigger.
 *   4. INCONCLUSIVE:    Otherwise.
 */

export type BenchmarkDimension =
  | 'content_quality'
  | 'visual_design'
  | 'long_context_processing'
  | 'api_automation'
  | 'conversational_editing';

export const BENCHMARK_DIMENSIONS: readonly BenchmarkDimension[] = [
  'content_quality',
  'visual_design',
  'long_context_processing',
  'api_automation',
  'conversational_editing',
] as const;

export type DimensionTrendStatus =
  | 'improving'
  | 'stable'
  | 'regressing'
  | 'inconclusive';

export type OverallTrendVerdict =
  | 'TRACKING'
  | 'AT_RISK'
  | 'AHEAD_OF_TARGET'
  | 'INCONCLUSIVE';

export const DEFAULT_GAMMA_TARGET = 4.0;
export const DEFAULT_WARNING_THRESHOLD = 3.5;
export const DEFAULT_TREND_DELTA_THRESHOLD = 0.1;
export const DEFAULT_WINDOW_MONTHS = 12;
export const MAX_WINDOW_MONTHS = 36;

/**
 * Local definition of the H1 benchmark run record. Defined here so H2 can
 * ship without H1 in the tree; re-exported for any future H1 import.
 */
export interface BenchmarkRunRecord {
  runId: string;
  organizationId: string;
  referenceSet: string;
  recordedAt: string; // ISO timestamp
  scores: Partial<Record<BenchmarkDimension, number>>;
}

export interface DimensionTrendPoint {
  runLabel: string; // 'YYYY-MM'
  value: number | null;
  delta: number | null;
}

export interface DimensionTrend {
  dimension: BenchmarkDimension;
  points: DimensionTrendPoint[];
  latestValue: number | null;
  averageLast3: number | null;
  averageLast6: number | null;
  status: DimensionTrendStatus;
  distanceToGamma: number | null;
  estimatedRunsToGamma: number | null;
}

export interface BenchmarkTrendReport {
  generatedAt: string;
  organizationId: string;
  referenceSet: string;
  windowMonths: number;
  gammaTarget: number;
  warningThreshold: number;
  dimensions: DimensionTrend[];
  overallVerdict: OverallTrendVerdict;
  summary: string;
}

export interface BuildBenchmarkTrendInput {
  runs: BenchmarkRunRecord[];
  organizationId: string;
  referenceSet: string;
  gammaTarget?: number;
  warningThreshold?: number;
  nowIso?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeIsoOrFallback(value: unknown, fallbackIso: string): string {
  if (typeof value !== 'string' || value.length === 0) return fallbackIso;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return fallbackIso;
  return new Date(ts).toISOString();
}

function formatRunLabel(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso.slice(0, 7);
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Average improvement per run, derived from the slope of the last N points
 * via simple linear regression. Returns null when fewer than 2 finite
 * points are available, when slope is non-positive, or when the result is
 * not finite. Slope-based (vs naive last-minus-first) so the estimate is
 * resilient to a single noisy bounce.
 */
function averageImprovementPerRun(values: (number | null)[]): number | null {
  const points: { x: number; y: number }[] = [];
  values.forEach((v, idx) => {
    if (v !== null && Number.isFinite(v)) points.push({ x: idx, y: v });
  });
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  if (!Number.isFinite(slope) || slope <= 0) return null;
  return slope;
}

function clampDimensionScore(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  // Domain rule: dimension scores live in [0..5]. Out-of-range values are
  // treated as missing (null) rather than silently clipped — fabricating a
  // boundary value would make `distanceToGamma` lie.
  if (value < 0 || value > 5) return null;
  return value;
}

function sortRunsChronologically(runs: BenchmarkRunRecord[]): BenchmarkRunRecord[] {
  // Defensive copy so callers don't observe in-place mutation.
  return [...runs].sort((a, b) => {
    const ta = Date.parse(a?.recordedAt ?? '');
    const tb = Date.parse(b?.recordedAt ?? '');
    const safeA = Number.isFinite(ta) ? ta : 0;
    const safeB = Number.isFinite(tb) ? tb : 0;
    return safeA - safeB;
  });
}

function buildDimensionTrend(
  dimension: BenchmarkDimension,
  runs: BenchmarkRunRecord[],
  gammaTarget: number,
  deltaThreshold: number
): DimensionTrend {
  const points: DimensionTrendPoint[] = [];
  let prev: number | null = null;
  for (const run of runs) {
    const raw = run?.scores ? run.scores[dimension] : undefined;
    const value = clampDimensionScore(raw);
    const label = formatRunLabel(run.recordedAt ?? '');
    let delta: number | null = null;
    if (value !== null && prev !== null) delta = value - prev;
    points.push({ runLabel: label, value, delta });
    if (value !== null) prev = value;
  }

  const finiteValues = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const latestValue =
    finiteValues.length > 0 ? finiteValues[finiteValues.length - 1] ?? null : null;

  const last3 = finiteValues.slice(-3);
  const last6 = finiteValues.slice(-6);
  const averageLast3 = last3.length >= 3 ? meanOf(last3) : null;
  const averageLast6 = last6.length >= 6 ? meanOf(last6) : null;

  let status: DimensionTrendStatus;
  if (averageLast3 === null) {
    status = 'inconclusive';
  } else if (averageLast6 === null) {
    // Have 3..5 points: classify by comparing recent half to the older half.
    const half = Math.floor(finiteValues.length / 2) || 1;
    const olderMean = meanOf(finiteValues.slice(0, half));
    const recentMean = meanOf(finiteValues.slice(half));
    if (olderMean === null || recentMean === null) {
      status = 'inconclusive';
    } else {
      const d = recentMean - olderMean;
      if (d >= deltaThreshold) status = 'improving';
      else if (d <= -deltaThreshold) status = 'regressing';
      else status = 'stable';
    }
  } else {
    const d = averageLast3 - averageLast6;
    if (d >= deltaThreshold) status = 'improving';
    else if (d <= -deltaThreshold) status = 'regressing';
    else status = 'stable';
  }

  const distanceToGamma = latestValue === null ? null : gammaTarget - latestValue;

  let estimatedRunsToGamma: number | null = null;
  if (latestValue !== null && latestValue >= gammaTarget) {
    estimatedRunsToGamma = 0;
  } else if (status === 'improving' && distanceToGamma !== null && distanceToGamma > 0) {
    const slopeWindow = points.slice(-6).map((p) => p.value);
    const rate = averageImprovementPerRun(slopeWindow);
    if (rate !== null && rate > 0) {
      const est = Math.ceil(distanceToGamma / rate);
      if (Number.isFinite(est) && est > 0) estimatedRunsToGamma = est;
    }
  }

  return {
    dimension,
    points,
    latestValue,
    averageLast3,
    averageLast6,
    status,
    distanceToGamma,
    estimatedRunsToGamma,
  };
}

function computeOverallVerdict(
  dimensions: DimensionTrend[],
  gammaTarget: number,
  warningThreshold: number
): OverallTrendVerdict {
  const dimsWithLatest = dimensions.filter((d) => d.latestValue !== null);

  if (dimsWithLatest.length === 0) return 'INCONCLUSIVE';

  if (
    dimsWithLatest.length === BENCHMARK_DIMENSIONS.length &&
    dimsWithLatest.every((d) => (d.latestValue ?? -Infinity) >= gammaTarget)
  ) {
    return 'AHEAD_OF_TARGET';
  }

  const atRisk = dimensions.some(
    (d) =>
      d.status === 'regressing' &&
      d.latestValue !== null &&
      d.latestValue < warningThreshold
  );
  if (atRisk) return 'AT_RISK';

  const hasImproving = dimensions.some((d) => d.status === 'improving');
  const conclusiveCount = dimensions.filter((d) => d.status !== 'inconclusive').length;
  if (hasImproving && conclusiveCount > 0) return 'TRACKING';

  return 'INCONCLUSIVE';
}

function describeDimension(dim: BenchmarkDimension): string {
  // Snake-case canonical id is operator-friendly enough; a richer label map
  // can ship later without changing the verdict math.
  return dim;
}

function buildSummary(
  dimensions: DimensionTrend[],
  verdict: OverallTrendVerdict,
  gammaTarget: number
): string {
  const total = dimensions.length;
  const tracking = dimensions.filter(
    (d) => d.latestValue !== null && d.latestValue >= gammaTarget
  ).length;
  const improving = dimensions.filter((d) => d.status === 'improving');
  const regressing = dimensions.filter((d) => d.status === 'regressing');

  if (verdict === 'INCONCLUSIVE') {
    return 'Insufficient benchmark history to assess movement toward Gamma.';
  }

  if (verdict === 'AHEAD_OF_TARGET') {
    return `All ${total} dimensions at or above Gamma target (${gammaTarget.toFixed(1)}).`;
  }

  const parts: string[] = [];
  const tier = improving.length > 0 ? improving.length : tracking;
  parts.push(`${tier} of ${total} dimensions tracking toward Gamma`);

  if (regressing.length > 0) {
    const r = regressing[0];
    if (r) {
      const fromTo = formatFromTo(r);
      const tail = fromTo ? ` (${fromTo})` : '';
      parts.push(`${describeDimension(r.dimension)} regressing${tail}`);
    }
  }

  return `${parts.join('; ')}.`;
}

function formatFromTo(trend: DimensionTrend): string | null {
  const finitePoints = trend.points.filter(
    (p): p is DimensionTrendPoint & { value: number } =>
      p.value !== null && Number.isFinite(p.value)
  );
  if (finitePoints.length < 2) return null;
  const last = finitePoints[finitePoints.length - 1];
  const prev = finitePoints[finitePoints.length - 2];
  if (!last || !prev) return null;
  return `${prev.value.toFixed(1)} → ${last.value.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// Public API: pure builder
// ---------------------------------------------------------------------------

export function buildBenchmarkTrendReport(
  input: BuildBenchmarkTrendInput
): BenchmarkTrendReport {
  const fallbackNowIso = '1970-01-01T00:00:00.000Z';
  const generatedAt = safeIsoOrFallback(input?.nowIso, fallbackNowIso);
  const gammaTarget = isFiniteNumber(input?.gammaTarget)
    ? (input!.gammaTarget as number)
    : DEFAULT_GAMMA_TARGET;
  const warningThreshold = isFiniteNumber(input?.warningThreshold)
    ? (input!.warningThreshold as number)
    : DEFAULT_WARNING_THRESHOLD;

  const organizationId =
    typeof input?.organizationId === 'string' ? input.organizationId : '';
  const referenceSet =
    typeof input?.referenceSet === 'string' ? input.referenceSet : '';

  const rawRuns = Array.isArray(input?.runs) ? input.runs : [];
  // Filter obviously malformed entries so the rest of the math is safe.
  const safeRuns = rawRuns.filter(
    (r): r is BenchmarkRunRecord => !!r && typeof r === 'object'
  );
  const runs = sortRunsChronologically(safeRuns);
  const windowMonths = computeWindowMonths(runs);

  const dimensions: DimensionTrend[] = BENCHMARK_DIMENSIONS.map((dim) =>
    buildDimensionTrend(dim, runs, gammaTarget, DEFAULT_TREND_DELTA_THRESHOLD)
  );

  const overallVerdict = computeOverallVerdict(
    dimensions,
    gammaTarget,
    warningThreshold
  );
  const summary = buildSummary(dimensions, overallVerdict, gammaTarget);

  return {
    generatedAt,
    organizationId,
    referenceSet,
    windowMonths,
    gammaTarget,
    warningThreshold,
    dimensions,
    overallVerdict,
    summary,
  };
}

function computeWindowMonths(runs: BenchmarkRunRecord[]): number {
  if (runs.length === 0) return 0;
  if (runs.length === 1) return 1;
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (!first || !last) return runs.length;
  const a = Date.parse(first.recordedAt ?? '');
  const b = Date.parse(last.recordedAt ?? '');
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return runs.length;
  const months = (b - a) / (1000 * 60 * 60 * 24 * 30);
  // Inclusive count: 0-month span across 2 runs still represents 1 sample window.
  return Math.max(1, Math.round(months) + 1);
}

// ---------------------------------------------------------------------------
// DB helper: schema-tolerant loader
// ---------------------------------------------------------------------------

interface DbAllFn {
  (sql: string, params?: unknown[]): Promise<unknown[]>;
}

interface DbModule {
  all?: DbAllFn;
}

async function loadDbModule(): Promise<DbModule | null> {
  // Late, narrow import keeps the pure builder fully isolated from DB code
  // and makes this service easy to unit-test without touching the database.
  try {
    const mod = (await import('../utils/DbPromise.js')) as DbModule;
    return mod;
  } catch {
    return null;
  }
}

interface BenchmarkRunRow {
  run_id?: string | null;
  organization_id?: string | null;
  reference_set?: string | null;
  recorded_at?: string | null;
  scores_json?: string | null;
}

function parseScoresJson(raw: string | null | undefined): BenchmarkRunRecord['scores'] {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Partial<Record<BenchmarkDimension, number>> = {};
    for (const dim of BENCHMARK_DIMENSIONS) {
      const v = (parsed as Record<string, unknown>)[dim];
      if (isFiniteNumber(v)) out[dim] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as { message?: unknown })?.message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

export interface LoadRecentBenchmarkRunsOptions {
  limit?: number;
  referenceSet?: string;
}

/**
 * Schema-tolerant loader. Returns `[]` when the H1 table
 * `presentation_benchmark_runs` is missing (e.g. before migration 768 ships)
 * or when the underlying driver throws for any reason. This keeps the H2
 * dashboard honest in early environments instead of 500ing.
 */
export async function loadRecentBenchmarkRuns(
  orgId: string,
  opts?: LoadRecentBenchmarkRunsOptions
): Promise<BenchmarkRunRecord[]> {
  if (typeof orgId !== 'string' || orgId.length === 0) return [];
  const safeLimit = (() => {
    const raw = opts?.limit;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 36;
    return Math.min(Math.max(Math.round(raw), 1), 240);
  })();
  const refSet = typeof opts?.referenceSet === 'string' ? opts.referenceSet : null;

  const db = await loadDbModule();
  if (!db || typeof db.all !== 'function') return [];

  try {
    const params: unknown[] = [orgId];
    let where = 'organization_id = ?';
    if (refSet) {
      where += ' AND reference_set = ?';
      params.push(refSet);
    }
    params.push(safeLimit);
    const rows = (await db.all(
      `SELECT run_id, organization_id, reference_set, recorded_at, scores_json
       FROM presentation_benchmark_runs
       WHERE ${where}
       ORDER BY recorded_at DESC
       LIMIT ?`,
      params
    )) as BenchmarkRunRow[] | undefined;
    if (!Array.isArray(rows)) return [];
    const records: BenchmarkRunRecord[] = rows
      .filter((r) => !!r)
      .map((r) => ({
        runId: typeof r.run_id === 'string' ? r.run_id : '',
        organizationId:
          typeof r.organization_id === 'string' ? r.organization_id : orgId,
        referenceSet: typeof r.reference_set === 'string' ? r.reference_set : '',
        recordedAt: typeof r.recorded_at === 'string' ? r.recorded_at : '',
        scores: parseScoresJson(r.scores_json),
      }));
    // Loader returns ascending chronological order so callers can feed the
    // builder directly without re-sorting.
    return sortRunsChronologically(records);
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      // Best-effort: keep the dashboard up. We still log so ops can notice
      // a non-schema-missing failure mode in production logs.
      // eslint-disable-next-line no-console
      console.warn(
        '[presentationBenchmarkTrendService] loadRecentBenchmarkRuns failed',
        error
      );
    }
    return [];
  }
}
