/**
 * M14/F1 — action queue uses the canonical risk classifier.
 *
 * The legacy action queue surfaced "high risk" via an ad-hoc SQL filter
 * (`impact IN (CRITICAL,HIGH) OR probability=HIGH`) — a 3rd, divergent definition
 * of "high risk" vs the heatmap and signals. ExecutionController.getActionQueue
 * now classifies via raidScoringService (calculateRiskScore + categorizeScore)
 * and surfaces AMBER+RED (category !== GREEN). This locks that semantics.
 */
import { describe, expect, it } from 'vitest';

import {
  calculateRiskScore,
  categorizeScore,
  DEFAULT_THRESHOLDS,
} from '../../../server/src/services/raidScoringService.js';

// The predicate the action queue now applies.
const surfaces = (probability: string, impact: string): boolean =>
  categorizeScore(calculateRiskScore(probability, impact), DEFAULT_THRESHOLDS) !== 'GREEN';

describe('action queue — canonical "high risk" = non-GREEN (P×I)', () => {
  it('surfaces AMBER and RED risks', () => {
    expect(surfaces('MEDIUM', 'HIGH')).toBe(true); // score 6 → AMBER
    expect(surfaces('HIGH', 'HIGH')).toBe(true); // 9 → AMBER
    expect(surfaces('MEDIUM', 'CRITICAL')).toBe(true); // 8 → AMBER
    expect(surfaces('HIGH', 'CRITICAL')).toBe(true); // 12 → RED
  });

  it('drops GREEN risks the old ad-hoc filter wrongly surfaced', () => {
    // HIGH impact × LOW probability = score 3 → GREEN. The legacy filter
    // (`impact IN (HIGH,CRITICAL)`) surfaced it; the canonical scorer does not.
    expect(surfaces('LOW', 'HIGH')).toBe(false);
    expect(surfaces('LOW', 'CRITICAL')).toBe(false); // score 4 → GREEN
    expect(surfaces('LOW', 'LOW')).toBe(false); // 1 → GREEN
    expect(surfaces('MEDIUM', 'MEDIUM')).toBe(false); // 4 → GREEN
  });

  it('ranks by P×I score (descending) — RED before AMBER', () => {
    const a = calculateRiskScore('HIGH', 'CRITICAL'); // 12
    const b = calculateRiskScore('MEDIUM', 'HIGH'); // 6
    expect(a).toBeGreaterThan(b);
  });
});
