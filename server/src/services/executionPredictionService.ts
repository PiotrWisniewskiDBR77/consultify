/**
 * M14/F7 — heuristic prediction (leading indicators), pure functions.
 *
 * Turns the signals we already compute (EVM SPI/CPI, schedule slip + its trend,
 * blockers, open high risks) into a forward-looking risk level — "this will be
 * late / over budget" BEFORE the deadline passes — with cited reasons. v1 is
 * deterministic heuristics (per CEO decision); an ML model is a v1.1 swap-in
 * behind the same interface. No DB, fully unit-tested.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PredictionInputs {
  /** Schedule Performance Index (EV/PV); null when unknown. */
  spi?: number | null;
  /** Cost Performance Index (EV/AC); null when unknown. */
  cpi?: number | null;
  /** days behind plan as of now (positive = late). */
  slipDays?: number | null;
  /** slip trajectory: is the slip growing? */
  slipTrend?: 'worsening' | 'flat' | 'improving' | null;
  /** open blockers on the initiative. */
  blockers?: number | null;
  /** open AMBER+ risks (canonical). */
  openHighRisks?: number | null;
  /** % complete (0–1) — late + low completion is worse. */
  percentComplete?: number | null;
}

export interface Prediction {
  level: RiskLevel;
  /** 0–100 confidence-ish score driving the level. */
  score: number;
  reasons: string[];
}

const LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const bump = (cur: RiskLevel, by = 1): RiskLevel =>
  LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(cur) + by)];

function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

/** Predict delay risk from schedule performance + slip trajectory. */
export function predictDelayRisk(inp: PredictionInputs): Prediction {
  const reasons: string[] = [];
  let score = 0;
  if (inp.spi != null) {
    if (inp.spi < 0.8) {
      score += 40;
      reasons.push(`SPI ${inp.spi} (severely behind schedule)`);
    } else if (inp.spi < 0.9) {
      score += 25;
      reasons.push(`SPI ${inp.spi} (behind schedule)`);
    } else if (inp.spi < 0.95) {
      score += 10;
      reasons.push(`SPI ${inp.spi} (slightly behind)`);
    }
  }
  if (inp.slipDays != null && inp.slipDays > 0) {
    score += Math.min(25, inp.slipDays);
    reasons.push(`${Math.round(inp.slipDays)} day(s) behind plan`);
  }
  if (inp.slipTrend === 'worsening') {
    score += 20;
    reasons.push('slip is growing (worsening trend)');
  } else if (inp.slipTrend === 'improving') {
    score = Math.max(0, score - 10);
  }
  if (inp.blockers != null && inp.blockers > 0) {
    score += Math.min(20, inp.blockers * 10);
    reasons.push(`${inp.blockers} active blocker(s)`);
  }
  // late AND low completion compounds
  if (inp.percentComplete != null && inp.percentComplete < 0.5 && inp.spi != null && inp.spi < 0.9) {
    score += 10;
    reasons.push('low completion while already behind');
  }
  return { level: levelFromScore(score), score: Math.min(100, Math.round(score)), reasons };
}

/** Predict cost-overrun risk from cost performance. */
export function predictOverrunRisk(inp: PredictionInputs): Prediction {
  const reasons: string[] = [];
  let score = 0;
  if (inp.cpi != null) {
    if (inp.cpi < 0.8) {
      score += 50;
      reasons.push(`CPI ${inp.cpi} (severe cost overrun trajectory)`);
    } else if (inp.cpi < 0.9) {
      score += 30;
      reasons.push(`CPI ${inp.cpi} (over budget)`);
    } else if (inp.cpi < 0.95) {
      score += 12;
      reasons.push(`CPI ${inp.cpi} (slightly over budget)`);
    }
  }
  // spending fast while behind schedule → overrun likely
  if (inp.cpi != null && inp.cpi < 0.95 && inp.spi != null && inp.spi < 0.9) {
    score += 15;
    reasons.push('over budget AND behind schedule');
  }
  return { level: levelFromScore(score), score: Math.min(100, Math.round(score)), reasons };
}

/**
 * Combined initiative prediction: worst of delay/overrun, escalated one level
 * when open high risks pile on. Returns both sub-predictions for transparency.
 */
export function predictInitiative(inp: PredictionInputs): {
  overall: RiskLevel;
  delay: Prediction;
  overrun: Prediction;
  reasons: string[];
} {
  const delay = predictDelayRisk(inp);
  const overrun = predictOverrunRisk(inp);
  let overall: RiskLevel =
    LEVELS.indexOf(delay.level) >= LEVELS.indexOf(overrun.level) ? delay.level : overrun.level;
  const reasons = [...delay.reasons, ...overrun.reasons];
  if (inp.openHighRisks != null && inp.openHighRisks >= 3) {
    overall = bump(overall);
    reasons.push(`${inp.openHighRisks} open high risks amplify exposure`);
  }
  return { overall, delay, overrun, reasons };
}
