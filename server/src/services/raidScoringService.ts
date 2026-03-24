const PROBABILITY_SCORES: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const IMPACT_SCORES: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function calculateRiskScore(probability: string, impact: string): number {
  return (PROBABILITY_SCORES[probability?.toUpperCase()] || 1) * (IMPACT_SCORES[impact?.toUpperCase()] || 1);
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
