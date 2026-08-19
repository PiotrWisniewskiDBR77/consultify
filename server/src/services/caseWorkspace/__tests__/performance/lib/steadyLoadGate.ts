import { summarize, type LatencyStats } from './stats.js';

export const NFR_PERF_THRESHOLDS = {
  apiP95Ms: 1500,
  apiP99Ms: 2500,
  writeP95Ms: 2500,
  maxErrorRatePct: 1,
  maxHeapGrowthPct: 20,
} as const;

export const NFR_PERF_WORKLOADS = [
  'case',
  'my_work',
  'settings',
  'initiatives',
  'finance',
] as const;
export type NfrPerfWorkload = (typeof NFR_PERF_WORKLOADS)[number];

export interface WorkloadGateInput {
  latencyMs: number[];
  totalRequests: number;
  errors: number;
}

export interface SteadyLoadGateInput {
  apiLatencyMs: number[];
  writeLatencyMs: number[];
  totalRequests: number;
  errors: number;
  crossTenantFalseSuccesses: number;
  heapWarmMb: number;
  heapFinalMb: number;
  lastTenMinuteHeapMb: number[];
  workloads?: Partial<Record<NfrPerfWorkload, WorkloadGateInput>>;
  expectedWriteIds?: string[];
  persistedWriteIds?: string[];
}

export interface SteadyLoadGateResult {
  pass: boolean;
  api: LatencyStats;
  writes: LatencyStats;
  errorRatePct: number;
  heapGrowthPct: number;
  monotonicLastTenMinutes: boolean;
  workloadResults: Partial<
    Record<NfrPerfWorkload, { latency: LatencyStats; errorRatePct: number; pass: boolean }>
  >;
  writeReconciliation: {
    expected: number;
    persisted: number;
    missing: string[];
    duplicates: string[];
  };
  failures: string[];
}

export function evaluateSteadyLoadGate(input: SteadyLoadGateInput): SteadyLoadGateResult {
  const api = summarize(input.apiLatencyMs);
  const writes = summarize(input.writeLatencyMs);
  const errorRatePct = input.totalRequests > 0 ? (input.errors / input.totalRequests) * 100 : 100;
  const heapGrowthPct =
    input.heapWarmMb > 0 ? ((input.heapFinalMb - input.heapWarmMb) / input.heapWarmMb) * 100 : 100;
  const monotonicLastTenMinutes =
    input.lastTenMinuteHeapMb.length >= 3 &&
    input.lastTenMinuteHeapMb.every(
      (value, index, values) => index === 0 || value >= values[index - 1]
    );
  const failures: string[] = [];
  if (api.p95Ms > NFR_PERF_THRESHOLDS.apiP95Ms) failures.push('api_p95');
  if (api.p99Ms > NFR_PERF_THRESHOLDS.apiP99Ms) failures.push('api_p99');
  if (writes.n === 0 || writes.p95Ms > NFR_PERF_THRESHOLDS.writeP95Ms) failures.push('write_p95');
  if (errorRatePct >= NFR_PERF_THRESHOLDS.maxErrorRatePct) failures.push('error_rate');
  if (input.crossTenantFalseSuccesses !== 0) failures.push('cross_tenant_false_success');
  if (heapGrowthPct >= NFR_PERF_THRESHOLDS.maxHeapGrowthPct) failures.push('heap_growth');
  if (monotonicLastTenMinutes) failures.push('heap_monotonic_last_10m');
  const workloadResults: SteadyLoadGateResult['workloadResults'] = {};
  for (const workload of NFR_PERF_WORKLOADS) {
    const sample = input.workloads?.[workload];
    const latency = summarize(sample?.latencyMs || []);
    const workloadErrorRatePct =
      sample && sample.totalRequests > 0 ? (sample.errors / sample.totalRequests) * 100 : 100;
    const pass =
      Boolean(sample?.totalRequests) &&
      latency.p95Ms <= NFR_PERF_THRESHOLDS.apiP95Ms &&
      workloadErrorRatePct < NFR_PERF_THRESHOLDS.maxErrorRatePct;
    workloadResults[workload] = { latency, errorRatePct: workloadErrorRatePct, pass };
    if (input.workloads && !pass) failures.push(`workload_${workload}`);
  }
  const expectedWriteIds = input.expectedWriteIds || [];
  const persistedWriteIds = input.persistedWriteIds || [];
  const persistedSet = new Set(persistedWriteIds);
  const missing = [...new Set(expectedWriteIds)].filter((id) => !persistedSet.has(id));
  const duplicates = persistedWriteIds.filter((id, index, values) => values.indexOf(id) !== index);
  if (missing.length > 0) failures.push('write_loss');
  if (duplicates.length > 0 || persistedWriteIds.length !== new Set(persistedWriteIds).size) {
    failures.push('write_duplicate');
  }
  return {
    pass: failures.length === 0,
    api,
    writes,
    errorRatePct,
    heapGrowthPct,
    monotonicLastTenMinutes,
    workloadResults,
    writeReconciliation: {
      expected: new Set(expectedWriteIds).size,
      persisted: persistedWriteIds.length,
      missing,
      duplicates: [...new Set(duplicates)],
    },
    failures,
  };
}
