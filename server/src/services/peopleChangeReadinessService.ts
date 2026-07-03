/**
 * People-Change Readiness Roll-up Service (M14 / F6, step 6.5)
 *
 * Lightweight, DB-free ADKAR roll-up that maps live adoption signals onto a
 * change-readiness score for the Execution Manager lane.
 *
 * NOTE: This is intentionally separate from the DB-backed `adkarService.ts`
 * (which scores survey responses and persists them). This service does no I/O:
 * it is a set of pure functions that turn already-collected adoption signals
 * (communication coverage, sentiment, capability gap, reinforcement follow-ups)
 * into a per-dimension ADKAR roll-up plus a lane-ready problem descriptor.
 *
 * ADKAR dimensions (each 1-5, or null when unmeasured):
 *  - Awareness     ← communication coverage
 *  - Desire        ← sentiment trend + average
 *  - Knowledge     ← capability gap (large gap → low score)
 *  - Ability       ← capability gap (large gap → low score)
 *  - Reinforcement ← reinforcement follow-ups
 */

// ==========================================
// TYPES
// ==========================================

export interface ReadinessInputs {
  /** % of impacted population reached by change communications (0-100). */
  communicationCoveragePct?: number;
  /** Direction of adoption sentiment over time. */
  sentimentTrend?: 'improving' | 'stable' | 'declining';
  /** Average sentiment score, normalized 0-1 (1 = most positive). */
  sentimentAvg?: number;
  /** % capability gap across impacted roles (0 = no gap, 100 = full gap). */
  capabilityGapPct?: number;
  /** Count of reinforcement follow-ups executed (coaching, check-ins, etc.). */
  reinforcementFollowups?: number;
}

export type ReadinessLevel = 'AT_RISK' | 'DEVELOPING' | 'READY' | 'UNKNOWN';

export interface ReadinessResult {
  awareness: number | null;
  desire: number | null;
  knowledge: number | null;
  ability: number | null;
  reinforcement: number | null;
  /** Mean of the measured dimensions, rounded to 1 decimal; null when none measured. */
  overall: number | null;
  /** Dimensions scoring below 3 (human-readable). */
  barriers: string[];
  /** Dimensions with no input signal. */
  unmeasured: string[];
  readiness: ReadinessLevel;
}

export type ProblemSeverity = 'info' | 'warning' | 'critical';

export interface ReadinessLaneProblem {
  problemType: string;
  severity: ProblemSeverity;
  title: string;
}

// ==========================================
// HELPERS
// ==========================================

const BARRIER_SCORE = 3; // dimensions scoring below this are barriers
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp1to5 = (v: number): number => Math.max(1, Math.min(5, Math.round(v)));

/**
 * Map a 0-100 percentage onto a 1-5 score where HIGHER percentage = HIGHER score.
 * (Used for "more is better" signals such as communication coverage.)
 */
function pctToScore(pct: number): number {
  const p = Math.max(0, Math.min(100, pct));
  // 0% -> 1, 100% -> 5
  return clamp1to5(1 + (p / 100) * 4);
}

/**
 * Map a 0-100 gap percentage onto a 1-5 score where a LARGER gap = LOWER score.
 * (Used for capability gap: large gap means low Knowledge/Ability.)
 */
function gapToScore(gapPct: number): number {
  const g = Math.max(0, Math.min(100, gapPct));
  // 0% gap -> 5, 100% gap -> 1
  return clamp1to5(5 - (g / 100) * 4);
}

// ==========================================
// CORE
// ==========================================

/**
 * Roll up adoption signals into an ADKAR readiness result.
 * Unmeasured dimensions are returned as null and excluded from `overall`.
 */
export function computeReadiness(inp: ReadinessInputs = {}): ReadinessResult {
  // --- Awareness ← communication coverage ---
  const awareness = isNum(inp.communicationCoveragePct)
    ? pctToScore(inp.communicationCoveragePct)
    : null;

  // --- Desire ← sentiment trend + average ---
  let desire: number | null = null;
  if (inp.sentimentTrend != null || isNum(inp.sentimentAvg)) {
    // Base from average sentiment (0-1 -> 1-5), default neutral 3 when only trend given.
    let base = isNum(inp.sentimentAvg) ? 1 + Math.max(0, Math.min(1, inp.sentimentAvg)) * 4 : 3;
    if (inp.sentimentTrend === 'improving') base += 1;
    else if (inp.sentimentTrend === 'declining') base -= 1;
    desire = clamp1to5(base);
  }

  // --- Knowledge & Ability ← capability gap (large gap -> low) ---
  const knowledge = isNum(inp.capabilityGapPct) ? gapToScore(inp.capabilityGapPct) : null;
  const ability = isNum(inp.capabilityGapPct) ? gapToScore(inp.capabilityGapPct) : null;

  // --- Reinforcement ← follow-ups ---
  let reinforcement: number | null = null;
  if (isNum(inp.reinforcementFollowups)) {
    const n = Math.max(0, inp.reinforcementFollowups);
    // 0 -> 1, 4+ -> 5 (linear, saturating).
    reinforcement = clamp1to5(1 + Math.min(n, 4));
  }

  const dims: Array<{ label: string; score: number | null }> = [
    { label: 'Awareness', score: awareness },
    { label: 'Desire', score: desire },
    { label: 'Knowledge', score: knowledge },
    { label: 'Ability', score: ability },
    { label: 'Reinforcement', score: reinforcement },
  ];

  const barriers: string[] = [];
  const unmeasured: string[] = [];
  const measured: number[] = [];

  for (const d of dims) {
    if (d.score == null) {
      unmeasured.push(d.label);
      continue;
    }
    measured.push(d.score);
    if (d.score < BARRIER_SCORE) {
      barriers.push(d.label);
    }
  }

  const overall =
    measured.length > 0
      ? Math.round((measured.reduce((a, b) => a + b, 0) / measured.length) * 10) / 10
      : null;

  let readiness: ReadinessLevel;
  if (overall == null) readiness = 'UNKNOWN';
  else if (overall < 2.5) readiness = 'AT_RISK';
  else if (overall < 4) readiness = 'DEVELOPING';
  else readiness = 'READY';

  return {
    awareness,
    desire,
    knowledge,
    ability,
    reinforcement,
    overall,
    barriers,
    unmeasured,
    readiness,
  };
}

/**
 * Translate a readiness roll-up into a Manager-lane problem descriptor.
 * Returns a problem when adoption is AT_RISK or any ADKAR barrier exists;
 * otherwise null (nothing to surface).
 */
export function readinessToLaneProblem(readiness: ReadinessResult): ReadinessLaneProblem | null {
  const hasBarrier = readiness.barriers.length > 0;

  if (readiness.readiness !== 'AT_RISK' && !hasBarrier) {
    return null;
  }

  const severity: ProblemSeverity = readiness.readiness === 'AT_RISK' ? 'critical' : 'warning';

  const detail = hasBarrier ? ` (${readiness.barriers.join(', ')})` : '';
  const title =
    readiness.readiness === 'AT_RISK'
      ? `People-change adoption at risk${detail}`
      : `Adoption barriers detected${detail}`;

  return {
    problemType: 'declining_adoption',
    severity,
    title,
  };
}

export default {
  computeReadiness,
  readinessToLaneProblem,
};
