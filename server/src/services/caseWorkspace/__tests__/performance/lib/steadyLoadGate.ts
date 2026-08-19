import { summarize, type LatencyStats } from './stats.js';

export const NFR_PERF_THRESHOLDS = {
  readP95Ms: 1500,
  writeP95Ms: 2500,
  maxErrorRatePct: 1,
  maxHeapGrowthPct: 20,
} as const;

export interface SteadyLoadGateInput {
  readLatencyMs: number[];
  writeLatencyMs: number[];
  totalRequests: number;
  errors: number;
  crossTenantFalseSuccesses: number;
  writeLosses?: number;
  writeDuplicates?: number;
  heapWarmMb: number;
  heapFinalMb: number;
  lastTenMinuteHeapMb: number[];
}

export interface SteadyLoadGateResult {
  pass: boolean;
  reads: LatencyStats;
  writes: LatencyStats;
  errorRatePct: number;
  heapGrowthPct: number;
  monotonicLastTenMinutes: boolean;
  failures: string[];
}

export function evaluateSteadyLoadGate(input: SteadyLoadGateInput): SteadyLoadGateResult {
  const reads = summarize(input.readLatencyMs);
  const writes = summarize(input.writeLatencyMs);
  const errorRatePct = input.totalRequests > 0 ? (input.errors / input.totalRequests) * 100 : 100;
  const heapGrowthPct =
    input.heapWarmMb > 0 ? ((input.heapFinalMb - input.heapWarmMb) / input.heapWarmMb) * 100 : 100;
  const monotonicLastTenMinutes =
    input.lastTenMinuteHeapMb.length >= 3 &&
    input.lastTenMinuteHeapMb.every((value, index, values) => index === 0 || value >= values[index - 1]);
  const failures: string[] = [];
  if (reads.n === 0 || reads.p95Ms > NFR_PERF_THRESHOLDS.readP95Ms) failures.push('read_p95');
  if (writes.n === 0 || writes.p95Ms > NFR_PERF_THRESHOLDS.writeP95Ms) failures.push('write_p95');
  if (errorRatePct >= NFR_PERF_THRESHOLDS.maxErrorRatePct) failures.push('error_rate');
  if ((input.writeLosses ?? 0) !== 0) failures.push('write_loss');
  if ((input.writeDuplicates ?? 0) !== 0) failures.push('write_duplicate');
  if (input.crossTenantFalseSuccesses !== 0) failures.push('cross_tenant_false_success');
  if (heapGrowthPct >= NFR_PERF_THRESHOLDS.maxHeapGrowthPct) failures.push('heap_growth');
  if (monotonicLastTenMinutes) failures.push('heap_monotonic_last_10m');
  return {
    pass: failures.length === 0,
    reads,
    writes,
    errorRatePct,
    heapGrowthPct,
    monotonicLastTenMinutes,
    failures,
  };
}
