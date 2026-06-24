import { describe, it, expect } from 'vitest';

import {
  detectEarlyWarnings,
  DEFAULT_MOVEMENT_THRESHOLD_PCT,
  type KpiLineagePair,
} from '../../../server/src/services/kpiLineageService.js';

describe('kpiLineageService.detectEarlyWarnings', () => {
  it('warns when the leading KPI moves but the linked lagging KPI stays flat', () => {
    const pairs: KpiLineagePair[] = [
      { leadingKpiId: 'lead-1', leadingDeltaPct: 20, laggingKpiId: 'lag-1', laggingDeltaPct: 1 },
    ];
    const out = detectEarlyWarnings(pairs);
    expect(out).toHaveLength(1);
    expect(out[0].leadingKpiId).toBe('lead-1');
    expect(out[0].laggingKpiId).toBe('lag-1');
    expect(out[0].warning).toContain('lead-1');
    expect(out[0].warning).toContain('lag-1');
  });

  it('does not warn when both leading and lagging move together', () => {
    const pairs: KpiLineagePair[] = [
      { leadingKpiId: 'lead-2', leadingDeltaPct: 20, laggingKpiId: 'lag-2', laggingDeltaPct: 18 },
    ];
    expect(detectEarlyWarnings(pairs)).toHaveLength(0);
  });

  it('does not warn when both leading and lagging are flat', () => {
    const pairs: KpiLineagePair[] = [
      { leadingKpiId: 'lead-3', leadingDeltaPct: 1, laggingKpiId: 'lag-3', laggingDeltaPct: 2 },
    ];
    expect(detectEarlyWarnings(pairs)).toHaveLength(0);
  });

  it('also warns on a downward leading move while lagging stays flat', () => {
    const pairs: KpiLineagePair[] = [
      { leadingKpiId: 'lead-4', leadingDeltaPct: -30, laggingKpiId: 'lag-4', laggingDeltaPct: 0 },
    ];
    const out = detectEarlyWarnings(pairs);
    expect(out).toHaveLength(1);
    expect(out[0].warning).toContain('fell');
  });

  it('respects a custom threshold (sub-threshold leading move is not a warning)', () => {
    const pairs: KpiLineagePair[] = [
      { leadingKpiId: 'lead-5', leadingDeltaPct: 8, laggingKpiId: 'lag-5', laggingDeltaPct: 0 },
    ];
    // 8% > default 5% would warn, but with threshold 10% it should not.
    expect(detectEarlyWarnings(pairs, 10)).toHaveLength(0);
    expect(detectEarlyWarnings(pairs, DEFAULT_MOVEMENT_THRESHOLD_PCT)).toHaveLength(1);
  });

  it('handles empty / malformed input safely', () => {
    expect(detectEarlyWarnings([])).toEqual([]);
    // @ts-expect-error intentional bad input
    expect(detectEarlyWarnings(null)).toEqual([]);
    const out = detectEarlyWarnings([
      // missing ids -> skipped
      { leadingKpiId: '', leadingDeltaPct: 50, laggingKpiId: 'lag', laggingDeltaPct: 0 } as KpiLineagePair,
    ]);
    expect(out).toEqual([]);
  });
});
