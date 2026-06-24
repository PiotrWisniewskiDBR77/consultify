const PROBABILITY_SCORES: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const IMPACT_SCORES: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function calculateRiskScore(probability: string, impact: string): number {
  return (
    (PROBABILITY_SCORES[probability?.toUpperCase()] || 1) *
    (IMPACT_SCORES[impact?.toUpperCase()] || 1)
  );
}

export function categorizeScore(
  score: number,
  thresholds: { greenMax: number; amberMax: number; redMin: number }
): 'GREEN' | 'AMBER' | 'RED' {
  if (score <= thresholds.greenMax) return 'GREEN';
  if (score <= thresholds.amberMax) return 'AMBER';
  return 'RED';
}

export interface HeatmapCell {
  probability: string;
  impact: string;
  score: number;
  category: string;
  count: number;
  items: Array<{ id: string; title: string; initiativeId?: string }>;
}

export function buildHeatmap(
  raidItems: Array<{
    id: string;
    title: string;
    probability: string;
    impact: string;
    initiativeId?: string;
  }>,
  thresholds: { greenMax: number; amberMax: number; redMin: number }
): HeatmapCell[] {
  const probabilities = ['LOW', 'MEDIUM', 'HIGH'];
  const impacts = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const cells: HeatmapCell[] = [];

  for (const prob of probabilities) {
    for (const imp of impacts) {
      const score = calculateRiskScore(prob, imp);
      const category = categorizeScore(score, thresholds);
      const matching = raidItems.filter(
        (r) =>
          (r.probability?.toUpperCase() || 'LOW') === prob &&
          (r.impact?.toUpperCase() || 'LOW') === imp
      );
      cells.push({
        probability: prob,
        impact: imp,
        score,
        category,
        count: matching.length,
        items: matching.map((i) => ({ id: i.id, title: i.title, initiativeId: i.initiativeId })),
      });
    }
  }
  return cells;
}

export const DEFAULT_THRESHOLDS = {
  greenMax: 4,
  amberMax: 9,
  redMin: 10,
};

// =============================================================================
// M14/F8 — quantitative + 5×5 extensions (ADDITIVE — the 3×4 functions above
// stay untouched; riskDetectionService / InitiativeController keep using them).
// =============================================================================

const clampNum = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Expected Monetary Value = P(%) × financial impact. Lets risks be compared and
 * prioritised in money terms (PMBOK), and weighed against mitigation cost.
 */
export function calculateEmv(probabilityPercent: number, financialImpact: number): number {
  const p = clampNum(Number(probabilityPercent) || 0, 0, 100) / 100;
  const impact = Math.max(0, Number(financialImpact) || 0);
  return Math.round(p * impact);
}

export const PROBABILITY_5: Record<string, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};
export const IMPACT_5: Record<string, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5,
};

/** 5×5 P×I score (1–25). Returns null on an unknown value (no silent fallback). */
export function calculateRiskScore5x5(probability: string, impact: string): number | null {
  const p = PROBABILITY_5[String(probability || '').toUpperCase()];
  const i = IMPACT_5[String(impact || '').toUpperCase()];
  if (p == null || i == null) return null;
  return p * i;
}

/** Categorise a 5×5 score. Standard bands: ≤6 GREEN, ≤12 AMBER, else RED. */
export function categorizeScore5x5(
  score: number,
  thresholds: { green: number; amber: number } = { green: 6, amber: 12 }
): 'GREEN' | 'AMBER' | 'RED' {
  if (score <= thresholds.green) return 'GREEN';
  if (score <= thresholds.amber) return 'AMBER';
  return 'RED';
}

/**
 * Residual risk = inherent score reduced by control effectiveness (0–1).
 * Effectiveness 0 ⇒ residual = inherent; 1 ⇒ residual = 0.
 */
export function residualScore(inherentScore: number, controlEffectiveness: number): number {
  const eff = clampNum(Number(controlEffectiveness) || 0, 0, 1);
  return Math.round((Number(inherentScore) || 0) * (1 - eff));
}
