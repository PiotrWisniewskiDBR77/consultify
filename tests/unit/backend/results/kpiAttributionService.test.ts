import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/DbPromise.js', () => {
  return {
    all: vi.fn(async (sql: string) => {
      if (sql.includes('FROM initiative_kpis')) {
        return [
          {
            id: 'kpi-1',
            name: 'OEE',
            unit: '%',
            baseline_value: 50,
            target_value: 80,
            current_value: 72,
          },
        ];
      }

      if (sql.includes('FROM kpi_time_series')) {
        return [
          { value: 55, period_start: '2026-01-01' },
          { value: 60, period_start: '2026-02-01' },
          { value: 70, period_start: '2026-03-01' },
        ];
      }

      if (sql.includes('FROM initiative_kpi_mappings')) {
        return [
          {
            initiative_id: 'init-1',
            initiative_name: 'Reduce scrap',
            impact_weight: 1,
            expected_delta: 8,
            status: 'EXECUTING',
            progress: 80,
          },
          {
            initiative_id: 'init-2',
            initiative_name: 'Improve setup time',
            impact_weight: 0.5,
            expected_delta: 4,
            status: 'TRACKING',
            progress: 60,
          },
        ];
      }

      return [];
    }),
  };
});

import { computeAttribution } from '../../../../server/src/services/kpiAttributionService.js';

describe('kpiAttributionService', () => {
  it('returns heuristic contributions while preserving manual-mapping uncertainty', async () => {
    const result = await computeAttribution('kpi-1', 'org-1', '2026-01-01', '2026-03-31');

    expect(result.kpiId).toBe('kpi-1');
    expect(result.kpiName).toBe('OEE');
    expect(result.kpiDelta).toBe(15);
    expect(result.contributions).toHaveLength(2);
    expect(result.contributions[0]?.initiativeName).toBe('Reduce scrap');
    expect(result.contributions[0]?.contributionPercent).toBeGreaterThan(
      result.contributions[1]?.contributionPercent || 0
    );
    expect(result.unexplainedPercent).toBeGreaterThanOrEqual(0);
    expect(result.unexplainedPercent).toBeLessThan(100);
    expect(result.assumptions).toContain('Contribution proportional to mapping weight × initiative progress');
    expect(result.disclaimer).toContain('heuristics');
  });
});
