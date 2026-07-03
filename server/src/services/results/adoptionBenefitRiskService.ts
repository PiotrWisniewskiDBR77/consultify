/**
 * adoptionBenefitRiskService — M15/W5 (5.5 + 5.6)
 *
 * Pure, deterministic doctrine functions linking adoption signals to benefit
 * realization risk, grounded in:
 *   - BCG DICE framework (Duration, Integrity, Commitment[1+2], Effort) for the
 *     odds a change initiative succeeds.
 *   - Prosci ADKAR adoption model (Awareness→Desire→Knowledge→Ability→Reinforcement),
 *     proxied here through adoption score, sentiment trend and champion coverage.
 *
 * No I/O, no DB, no clock — easy to unit-test and to reuse from routes/services.
 */

export type DiceZone = 'win' | 'worry' | 'woe';

export interface DiceInput {
  /** Time between project milestones / reviews. Long, unreviewed efforts drift. */
  durationWeeks?: number;
  /** Interval between formal reviews. If provided, used in place of durationWeeks. */
  reviewIntervalWeeks?: number;
  /** Team Integrity (D-I-C-E "I"): capability/completeness of the delivery team. */
  teamIntegrity?: number; // 1 (excellent) .. 4 (poor)
  /** Commitment C1: senior-management visible backing. */
  seniorCommitment?: number; // 1 (clearly backed) .. 4 (against)
  /** Commitment C2: local / front-line buy-in. */
  localCommitment?: number; // 1 (eager) .. 4 (reluctant)
  /** Additional effort the change imposes on top of business-as-usual, in %. */
  extraEffortPct?: number;
}

export interface DiceResult {
  score: number;
  zone: DiceZone;
}

export type SentimentTrend = 'improving' | 'flat' | 'declining';
export type BenefitRisk = 'low' | 'medium' | 'high';

export interface AdoptionToBenefitRiskInput {
  /** Normalised adoption score in [0,1] (1 = fully adopted). */
  adoptionScore?: number;
  /** Direction of sentiment over recent measurements. */
  sentimentTrend?: SentimentTrend;
  /** Share of impacted population covered by active change champions, in %. */
  championCoveragePct?: number;
}

export interface AdoptionToBenefitRiskResult {
  risk: BenefitRisk;
  reasons: string[];
}

export interface BenefitAdoptionItem {
  id: string;
  name?: string;
  adoptionScore?: number;
  diceZone?: DiceZone;
}

export interface BenefitAdoptionFlag {
  id: string;
  name?: string;
  atRiskByAdoption: boolean;
  reason?: string;
}

/** Clamp a raw factor onto the DICE 1..4 ordinal scale (1 = best, 4 = worst). */
function normalizeFactor(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  if (value < 1) return 1;
  if (value > 4) return 4;
  // Snap to nearest integer band — DICE uses discrete 1..4 ratings.
  return Math.round(value);
}

/**
 * Map a duration (weeks between reviews) onto the DICE "D" 1..4 band.
 * BCG guidance: short and/or frequently reviewed efforts score best.
 *   <= 2 months (~8w) => 1; <= 4 months (~17w) => 2; <= 6 months (~26w) => 3; else 4.
 */
function durationToBand(weeks: number | undefined): number {
  if (weeks == null || !Number.isFinite(weeks) || weeks <= 0) return 2; // neutral default
  if (weeks <= 8) return 1;
  if (weeks <= 17) return 2;
  if (weeks <= 26) return 3;
  return 4;
}

/** Map extra-effort percentage onto the DICE "E" 1..4 band. */
function effortToBand(pct: number | undefined): number {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return 1;
  if (pct <= 10) return 1;
  if (pct <= 20) return 2;
  if (pct <= 40) return 3;
  return 4;
}

/**
 * Classic BCG DICE score: D + 2I + 2C1 + C2 + E.
 * Range 7 (best) .. 28 (worst). Thresholds:
 *   <= 14  => 'win'   (Win zone — likely to succeed)
 *   <= 17  => 'worry' (Worry zone — uncertain)
 *   else   => 'woe'   (Woe zone — unlikely to succeed)
 */
export function diceScore(input: DiceInput): DiceResult {
  const d = durationToBand(input.reviewIntervalWeeks ?? input.durationWeeks);
  const i = normalizeFactor(input.teamIntegrity, 2);
  const c1 = normalizeFactor(input.seniorCommitment, 2);
  const c2 = normalizeFactor(input.localCommitment, 2);
  const e = effortToBand(input.extraEffortPct);

  const score = d + 2 * i + 2 * c1 + c2 + e;

  let zone: DiceZone;
  if (score <= 14) zone = 'win';
  else if (score <= 17) zone = 'worry';
  else zone = 'woe';

  return { score, zone };
}

/**
 * Translate adoption signals into benefit-realization risk.
 * ADKAR-grounded heuristic: low adoption, declining sentiment and thin champion
 * coverage each push risk upward. Returns the risk band plus human-readable reasons.
 */
export function adoptionToBenefitRisk(
  input: AdoptionToBenefitRiskInput,
): AdoptionToBenefitRiskResult {
  const reasons: string[] = [];
  let points = 0;

  const adoption = Number.isFinite(input.adoptionScore as number)
    ? (input.adoptionScore as number)
    : null;
  if (adoption == null) {
    reasons.push('No adoption data — benefit realization unverified');
    points += 1;
  } else if (adoption < 0.4) {
    reasons.push(`Low adoption (${(adoption * 100).toFixed(0)}%) — benefit not landing`);
    points += 2;
  } else if (adoption < 0.7) {
    reasons.push(`Partial adoption (${(adoption * 100).toFixed(0)}%) — benefit at partial risk`);
    points += 1;
  }

  if (input.sentimentTrend === 'declining') {
    reasons.push('Declining sentiment — adoption likely to erode');
    points += 2;
  } else if (input.sentimentTrend === 'flat' && (adoption == null || adoption < 0.7)) {
    reasons.push('Flat sentiment without strong adoption — no momentum');
    points += 1;
  }

  const coverage = Number.isFinite(input.championCoveragePct as number)
    ? (input.championCoveragePct as number)
    : null;
  if (coverage == null || coverage <= 0) {
    reasons.push('No change champions — reinforcement (ADKAR-R) missing');
    points += 2;
  } else if (coverage < 25) {
    reasons.push(`Thin champion coverage (${coverage.toFixed(0)}%) — weak reinforcement`);
    points += 1;
  }

  let risk: BenefitRisk;
  if (points >= 3) risk = 'high';
  else if (points >= 1) risk = 'medium';
  else risk = 'low';

  if (reasons.length === 0) {
    reasons.push('Healthy adoption, stable sentiment and champion coverage');
  }

  return { risk, reasons };
}

/**
 * Flag benefits whose realization is jeopardised by weak adoption or a DICE Woe
 * zone. A benefit is flagged when diceZone === 'woe' OR adoptionScore < 0.4.
 */
export function flagBenefitAtRiskByAdoption(
  items: Array<BenefitAdoptionItem>,
): Array<BenefitAdoptionFlag> {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const adoption = Number.isFinite(item.adoptionScore as number)
      ? (item.adoptionScore as number)
      : null;
    const woe = item.diceZone === 'woe';
    const lowAdoption = adoption != null && adoption < 0.4;

    if (!woe && !lowAdoption) {
      return { id: item.id, name: item.name, atRiskByAdoption: false };
    }

    const parts: string[] = [];
    if (woe) parts.push('DICE Woe zone (unlikely to succeed)');
    if (lowAdoption) parts.push(`adoption ${(adoption! * 100).toFixed(0)}% < 40%`);

    return {
      id: item.id,
      name: item.name,
      atRiskByAdoption: true,
      reason: parts.join('; '),
    };
  });
}

export default {
  diceScore,
  adoptionToBenefitRisk,
  flagBenefitAtRiskByAdoption,
};
