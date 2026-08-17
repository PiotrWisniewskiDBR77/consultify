import { describe, expect, it } from 'vitest';

import { evaluateSteadyLoadGate } from './lib/steadyLoadGate.js';

describe('NFR-PERF-001 steady-load gate evaluator', () => {
  it('passes an in-budget run and rejects the positive-control breach', () => {
    expect(
      evaluateSteadyLoadGate({
        apiLatencyMs: [20, 30, 40, 50],
        writeLatencyMs: [80, 90, 100],
        totalRequests: 1000,
        errors: 1,
        crossTenantFalseSuccesses: 0,
        heapWarmMb: 100,
        heapFinalMb: 108,
        lastTenMinuteHeapMb: [105, 109, 106, 108],
      }).pass
    ).toBe(true);

    const breach = evaluateSteadyLoadGate({
      apiLatencyMs: [2000, 2500, 3000],
      writeLatencyMs: [1300, 1500, 1800],
      totalRequests: 100,
      errors: 2,
      crossTenantFalseSuccesses: 1,
      heapWarmMb: 100,
      heapFinalMb: 130,
      lastTenMinuteHeapMb: [110, 115, 120, 125],
    });
    expect(breach.pass).toBe(false);
    expect(breach.failures).toEqual([
      'api_p95', 'api_p99', 'write_p95', 'error_rate',
      'cross_tenant_false_success', 'heap_growth', 'heap_monotonic_last_10m',
    ]);
  });
});
