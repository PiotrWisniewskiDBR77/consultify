import { beforeEach, describe, expect, it } from 'vitest';

import {
  getV8MetricsSnapshot,
  recordV8Request,
  resetV8Metrics,
} from '../../../../../server/src/utils/v8MetricsStore.js';

describe('v8MetricsStore aggregate contract', () => {
  beforeEach(() => {
    resetV8Metrics();
  });

  it('keeps finite averages when NaN duration is recorded', () => {
    recordV8Request(Number.NaN, false);
    recordV8Request(100, false);

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(2);
    expect(Number.isFinite(snap.avgLatencyMs)).toBe(true);
    expect(Number.isNaN(snap.avgLatencyMs)).toBe(false);
    expect(snap.avgLatencyMs).toBe(50);
  });

  it('normalizes infinity and negative durations into safe bounded values', () => {
    recordV8Request(Infinity as unknown as number, false);
    recordV8Request(-50, false);

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(2);
    expect(Number.isFinite(snap.avgLatencyMs)).toBe(true);
    expect(snap.avgLatencyMs).toBe(0);
    expect(Number.isFinite(snap.uptime)).toBe(true);
    expect(snap.uptime).toBeGreaterThanOrEqual(0);
  });
});
