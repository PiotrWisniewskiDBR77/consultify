/**
 * CW-PERF — tiny, dependency-free latency/percentile helpers used by the
 * performance harness. No DB access, no mocking: pure math over arrays of
 * millisecond samples collected by the runner around real service calls.
 */

export interface LatencyStats {
  n: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

/** Nearest-rank percentile over a COPY of `samples` (never mutates the input). */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[idx];
}

export function summarize(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { n: 0, minMs: 0, maxMs: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
  }
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    n: samples.length,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    meanMs: sum / samples.length,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
  };
}

/** Times one async call, in milliseconds, via `performance.now()` (monotonic, sub-ms resolution). */
export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

export interface HeapSnapshot {
  label: string;
  atMs: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

const HEAP_BASELINE = performance.now();

export function snapshotHeap(label: string): HeapSnapshot {
  const m = process.memoryUsage();
  return {
    label,
    atMs: Math.round(performance.now() - HEAP_BASELINE),
    heapUsedMB: round2(m.heapUsed / (1024 * 1024)),
    heapTotalMB: round2(m.heapTotal / (1024 * 1024)),
    rssMB: round2(m.rss / (1024 * 1024)),
    externalMB: round2(m.external / (1024 * 1024)),
  };
}

/** Best-effort GC — only works when the process was started with `--expose-gc` (the runner does this). */
export function forceGcIfAvailable(): boolean {
  const g = (globalThis as { gc?: () => void }).gc;
  if (typeof g === 'function') {
    g();
    return true;
  }
  return false;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Bounded concurrency runner — no external dependency (p-limit etc.). Preserves input order in the returned array. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
