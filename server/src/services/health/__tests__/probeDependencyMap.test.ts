import { describe, expect, it } from 'vitest';

import { buildDependencyHealth, PROBE_DEPENDENCIES } from '../probeDependencyMap.js';

const result = (probeId: string, status: 'pass' | 'fail' | 'unknown', ranAt: string | null) => ({
  probeId,
  module: 'test',
  title: probeId,
  description: 'test',
  status,
  durationMs: ranAt ? 1 : null,
  errorMessage: null,
  detail: null,
  ranAt,
});

describe('probe dependency map', () => {
  it('declares every current probe exactly by stable id', () => {
    expect(Object.keys(PROBE_DEPENDENCIES)).toHaveLength(20);
  });

  it('never marks a dependency healthy without cached results', () => {
    expect(buildDependencyHealth([]).every((item) => item.status === 'unknown')).toBe(true);
  });

  it('uses the worst cached probe status', () => {
    const health = buildDependencyHealth([
      result('m15_kpi_round_trip', 'pass', '2026-08-25T05:00:00.000Z'),
      result('m15_roi_round_trip', 'fail', '2026-08-25T05:01:00.000Z'),
    ]);
    expect(health.every((item) => item.status === 'failing')).toBe(true);
    expect(health[0].lastCheckedAt).toBe('2026-08-25T05:01:00.000Z');
  });
});
