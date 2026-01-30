/**
 * Professional Performance Test Patterns
 *
 * Enterprise-grade patterns for load testing, benchmarking, and memory analysis
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
    count: number;
}

export interface BenchmarkResult {
    name: string;
    opsPerSecond: number;
    avgTimeMs: number;
    samples: number;
    metrics: PerformanceMetrics;
}

export interface LoadTestResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecond: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errors: string[];
}

// ============================================================================
// Statistics Helpers
// ============================================================================

function calculateStats(values: number[]): PerformanceMetrics {
    if (values.length === 0) {
        return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stdDev: 0, count: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    const median = count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
        min: sorted[0],
        max: sorted[count - 1],
        mean,
        median,
        p95: sorted[p95Index],
        p99: sorted[p99Index],
        stdDev,
        count,
    };
}

// ============================================================================
// Benchmark Functions
// ============================================================================

/**
 * Run a benchmark for a function
 */
export async function benchmark(
    name: string,
    fn: () => void | Promise<void>,
    options: { iterations?: number; warmup?: number } = {}
): Promise<BenchmarkResult> {
    const { iterations = 1000, warmup = 100 } = options;

    // Warmup phase
    for (let i = 0; i < warmup; i++) {
        await fn();
    }

    // Benchmark phase
    const times: number[] = [];
    const startTotal = performance.now();

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    const totalTime = performance.now() - startTotal;
    const metrics = calculateStats(times);

    return {
        name,
        opsPerSecond: (iterations / totalTime) * 1000,
        avgTimeMs: metrics.mean,
        samples: iterations,
        metrics,
    };
}

/**
 * Compare multiple implementations
 */
export async function compareBenchmarks(
    implementations: { name: string; fn: () => void | Promise<void> }[],
    options: { iterations?: number } = {}
): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const impl of implementations) {
        results.push(await benchmark(impl.name, impl.fn, options));
    }

    return results.sort((a, b) => b.opsPerSecond - a.opsPerSecond);
}

/**
 * Assert performance meets threshold
 */
export function assertPerformanceThreshold(
    result: BenchmarkResult,
    thresholds: { maxAvgMs?: number; minOps?: number; maxP95Ms?: number }
): void {
    if (thresholds.maxAvgMs && result.avgTimeMs > thresholds.maxAvgMs) {
        throw new Error(
            `Performance threshold exceeded: avg ${result.avgTimeMs.toFixed(2)}ms > ${thresholds.maxAvgMs}ms`
        );
    }

    if (thresholds.minOps && result.opsPerSecond < thresholds.minOps) {
        throw new Error(
            `Performance threshold not met: ${result.opsPerSecond.toFixed(0)} ops/s < ${thresholds.minOps} ops/s`
        );
    }

    if (thresholds.maxP95Ms && result.metrics.p95 > thresholds.maxP95Ms) {
        throw new Error(
            `P95 threshold exceeded: ${result.metrics.p95.toFixed(2)}ms > ${thresholds.maxP95Ms}ms`
        );
    }
}

// ============================================================================
// Load Testing
// ============================================================================

/**
 * Run a load test
 */
export async function loadTest(
    request: () => Promise<{ success: boolean; responseTime: number }>,
    options: {
        totalRequests?: number;
        concurrency?: number;
        rampUp?: number;
    } = {}
): Promise<LoadTestResult> {
    const { totalRequests = 100, concurrency = 10, rampUp = 0 } = options;

    const responseTimes: number[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failCount = 0;

    const startTime = performance.now();

    // Create request queue
    const queue: Promise<void>[] = [];

    for (let i = 0; i < totalRequests; i++) {
        // Ramp up delay
        if (rampUp > 0 && i < concurrency) {
            await new Promise((r) => setTimeout(r, (rampUp / concurrency) * i));
        }

        // Limit concurrency
        if (queue.length >= concurrency) {
            await Promise.race(queue);
        }

        const promise = request()
            .then(({ success, responseTime }) => {
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
                responseTimes.push(responseTime);
            })
            .catch((error) => {
                failCount++;
                errors.push(String(error));
            })
            .finally(() => {
                const idx = queue.indexOf(promise);
                if (idx >= 0) queue.splice(idx, 1);
            });

        queue.push(promise);
    }

    // Wait for all requests to complete
    await Promise.all(queue);

    const totalTime = performance.now() - startTime;
    const stats = calculateStats(responseTimes);

    return {
        totalRequests,
        successfulRequests: successCount,
        failedRequests: failCount,
        requestsPerSecond: (totalRequests / totalTime) * 1000,
        avgResponseTime: stats.mean,
        p95ResponseTime: stats.p95,
        p99ResponseTime: stats.p99,
        errors: errors.slice(0, 10), // Limit error messages
    };
}

// ============================================================================
// Memory Testing
// ============================================================================

interface MemorySnapshot {
    heapUsed: number;
    heapTotal: number;
    external: number;
    timestamp: number;
}

/**
 * Take memory snapshot (Node.js only)
 */
export function takeMemorySnapshot(): MemorySnapshot | null {
    const proc = globalThis as { process?: { memoryUsage?: () => { heapUsed: number; heapTotal: number; external: number } } };
    if (!proc.process?.memoryUsage) {
        return null;
    }

    const usage = proc.process.memoryUsage();
    return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        timestamp: Date.now(),
    };
}

/**
 * Check for memory leaks
 */
export async function checkMemoryLeak(
    fn: () => void | Promise<void>,
    options: { iterations?: number; threshold?: number } = {}
): Promise<{ leak: boolean; growth: number }> {
    const { iterations = 100, threshold = 1024 * 1024 } = options; // 1MB threshold

    // Force garbage collection if available
    const gc = (globalThis as { gc?: () => void }).gc;
    if (gc) gc();

    const before = takeMemorySnapshot();
    if (!before) {
        return { leak: false, growth: 0 };
    }

    for (let i = 0; i < iterations; i++) {
        await fn();
    }

    if (gc) gc();
    await new Promise((r) => setTimeout(r, 100));
    if (gc) gc();

    const after = takeMemorySnapshot();
    if (!after) {
        return { leak: false, growth: 0 };
    }

    const growth = after.heapUsed - before.heapUsed;

    return {
        leak: growth > threshold,
        growth,
    };
}

// ============================================================================
// Test Suite Patterns
// ============================================================================

/**
 * Pattern: Performance test suite
 */
export function describePerformance(
    name: string,
    tests: {
        name: string;
        fn: () => void | Promise<void>;
        threshold: { maxAvgMs?: number; minOps?: number };
    }[]
): void {
    describe(`${name} Performance`, () => {
        for (const test of tests) {
            it(`${test.name} meets performance threshold`, async () => {
                const result = await benchmark(test.name, test.fn, { iterations: 100 });
                assertPerformanceThreshold(result, test.threshold);
            });
        }
    });
}

/**
 * Pattern: Load test suite
 */
export function describeLoadTest(
    name: string,
    request: () => Promise<{ success: boolean; responseTime: number }>,
    scenarios: {
        name: string;
        totalRequests: number;
        concurrency: number;
        expectedSuccessRate: number;
        maxP95Ms: number;
    }[]
): void {
    describe(`${name} Load Test`, () => {
        for (const scenario of scenarios) {
            it(`handles ${scenario.name}`, async () => {
                const result = await loadTest(request, {
                    totalRequests: scenario.totalRequests,
                    concurrency: scenario.concurrency,
                });

                const successRate = result.successfulRequests / result.totalRequests;
                expect(successRate).toBeGreaterThanOrEqual(scenario.expectedSuccessRate);
                expect(result.p95ResponseTime).toBeLessThanOrEqual(scenario.maxP95Ms);
            });
        }
    });
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Format benchmark result for console
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
    return `
${result.name}
  Ops/sec: ${result.opsPerSecond.toFixed(2)}
  Avg: ${result.avgTimeMs.toFixed(3)}ms
  Min: ${result.metrics.min.toFixed(3)}ms
  Max: ${result.metrics.max.toFixed(3)}ms
  P95: ${result.metrics.p95.toFixed(3)}ms
  P99: ${result.metrics.p99.toFixed(3)}ms
  StdDev: ${result.metrics.stdDev.toFixed(3)}ms
  Samples: ${result.samples}
`.trim();
}

/**
 * Format load test result for console
 */
export function formatLoadTestResult(result: LoadTestResult): string {
    const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
    return `
Load Test Results
  Total Requests: ${result.totalRequests}
  Successful: ${result.successfulRequests} (${successRate}%)
  Failed: ${result.failedRequests}
  Requests/sec: ${result.requestsPerSecond.toFixed(2)}
  Avg Response: ${result.avgResponseTime.toFixed(2)}ms
  P95 Response: ${result.p95ResponseTime.toFixed(2)}ms
  P99 Response: ${result.p99ResponseTime.toFixed(2)}ms
`.trim();
}
