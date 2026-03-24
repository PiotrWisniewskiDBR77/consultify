/**
 * R0 Smoke: V4-EXEC-01 — RAID Scoring Service
 * Verifies: calculateRiskScore(), categorizeScore(), buildHeatmap()
 */

import {
  calculateRiskScore,
  categorizeScore,
  buildHeatmap,
  DEFAULT_THRESHOLDS,
} from '../../../../server/src/services/raidScoringService.js';

describe('V4-EXEC-01: RAID Scoring Service', () => {
  it('calculateRiskScore() returns a positive number', () => {
    const score = calculateRiskScore('high', 'high');
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('calculateRiskScore() high > low', () => {
    const high = calculateRiskScore('high', 'high');
    const low = calculateRiskScore('low', 'low');
    expect(high).toBeGreaterThan(low);
  });

  it('categorizeScore() returns GREEN for low scores', () => {
    expect(categorizeScore(2, DEFAULT_THRESHOLDS)).toBe('GREEN');
  });

  it('categorizeScore() returns AMBER for mid scores', () => {
    expect(categorizeScore(6, DEFAULT_THRESHOLDS)).toBe('AMBER');
  });

  it('categorizeScore() returns RED for high scores', () => {
    expect(categorizeScore(15, DEFAULT_THRESHOLDS)).toBe('RED');
  });

  it('buildHeatmap() returns cells for each item', () => {
    const items = [
      { id: 'r1', title: 'Risk A', probability: 'high', impact: 'medium' },
      { id: 'r2', title: 'Risk B', probability: 'low', impact: 'low' },
    ];
    const heatmap = buildHeatmap(items, DEFAULT_THRESHOLDS);
    expect(Array.isArray(heatmap)).toBe(true);
    expect(heatmap.length).toBeGreaterThanOrEqual(2);
  });

  it('DEFAULT_THRESHOLDS has expected shape', () => {
    expect(DEFAULT_THRESHOLDS).toHaveProperty('greenMax');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('amberMax');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('redMin');
    expect(DEFAULT_THRESHOLDS.greenMax).toBeLessThan(DEFAULT_THRESHOLDS.amberMax);
  });
});
