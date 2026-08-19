import { describe, expect, it } from 'vitest';

import { evaluateSteadyLoadGate, NFR_PERF_WORKLOADS } from './lib/steadyLoadGate.js';

const healthyWorkloads = Object.fromEntries(
  NFR_PERF_WORKLOADS.map((name) => [name, { latencyMs: [20, 30, 40], totalRequests: 3, errors: 0 }])
);

describe('NFR-PERF-001 steady-load gate evaluator', () => {
  it('passes an in-budget run and rejects the positive-control breach', () => {
    expect(
      evaluateSteadyLoadGate({
        readLatencyMs: [20, 30, 40, 50],
        writeLatencyMs: [80, 90, 100],
        totalRequests: 1000,
        errors: 1,
        crossTenantFalseSuccesses: 0,
        heapWarmMb: 100,
        heapFinalMb: 108,
        lastTenMinuteHeapMb: [105, 109, 106, 108],
        workloads: healthyWorkloads,
        expectedWriteIds: ['case-1', 'case-2'],
        persistedWriteIds: ['case-1', 'case-2'],
      }).pass
    ).toBe(true);

    const breach = evaluateSteadyLoadGate({
      apiLatencyMs: [2000, 2500, 3000],
      writeLatencyMs: [2600, 2800, 3200],
      totalRequests: 100,
      errors: 2,
      crossTenantFalseSuccesses: 1,
      heapWarmMb: 100,
      heapFinalMb: 130,
      lastTenMinuteHeapMb: [110, 115, 120, 125],
      workloads: {
        ...healthyWorkloads,
        finance: { latencyMs: [1600, 1900], totalRequests: 2, errors: 1 },
      },
      expectedWriteIds: ['case-1', 'case-2'],
      persistedWriteIds: ['case-1', 'case-1'],
    });
    expect(breach.pass).toBe(false);
    expect(breach.failures).toEqual([
      'api_p95',
      'api_p99',
      'write_p95',
      'error_rate',
      'cross_tenant_false_success',
      'heap_growth',
      'heap_monotonic_last_10m',
      'workload_finance',
      'write_loss',
      'write_duplicate',
    ]);
    expect(breach.writeReconciliation).toMatchObject({
      expected: 2,
      persisted: 2,
      missing: ['case-2'],
      duplicates: ['case-1'],
    });
  });
});
