import { summarize, type LatencyStats } from './stats.js';

export const NFR_PERF_THRESHOLDS = {
  apiP95Ms: 750,
  apiP99Ms: 1500,
  writeP95Ms: 1200,
  maxErrorRatePct: 0.5,
  maxHeapGrowthPct: 20,
} as const;

export interface SteadyLoadGateInput {
  apiLatencyMs: number[];
  writeLatencyMs: number[];
  totalRequests: number;
  errors: number;
  crossTenantFalseSuccesses: number;
  heapWarmMb: number;
  heapFinalMb: number;
  lastTenMinuteHeapMb: number[];
}

export interface SteadyLoadGateResult {
  pass: boolean;
  api: LatencyStats;
  writes: LatencyStats;
  errorRatePct: number;
  heapGrowthPct: number;
  monotonicLastTenMinutes: boolean;
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
    input.lastTenMinuteHeapMb.every((value, index, values) => index === 0 || value >= values[index - 1]);
  const failures: string[] = [];
  if (api.p95Ms > NFR_PERF_THRESHOLDS.apiP95Ms) failures.push('api_p95');
  if (api.p99Ms > NFR_PERF_THRESHOLDS.apiP99Ms) failures.push('api_p99');
  if (writes.n === 0 || writes.p95Ms > NFR_PERF_THRESHOLDS.writeP95Ms) failures.push('write_p95');
  if (errorRatePct >= NFR_PERF_THRESHOLDS.maxErrorRatePct) failures.push('error_rate');
  if (input.crossTenantFalseSuccesses !== 0) failures.push('cross_tenant_false_success');
  if (heapGrowthPct >= NFR_PERF_THRESHOLDS.maxHeapGrowthPct) failures.push('heap_growth');
  if (monotonicLastTenMinutes) failures.push('heap_monotonic_last_10m');
  return {
    pass: failures.length === 0,
    api,
    writes,
    errorRatePct,
    heapGrowthPct,
    monotonicLastTenMinutes,
    failures,
  };
}
