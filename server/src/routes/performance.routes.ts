/**
 * Performance Metrics Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides performance metrics endpoint with P95/P99 latency and throughput
 * GET /api/performance/metrics - Returns performance metrics in JSON format
 */

import { type Request, type Response, Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { errorsTotal } from '../services/metricsService.js';
import { getMetricsService } from '../services/metricsService.js';
import {
  dbQueryDurationSeconds,
  httpRequestDurationSeconds,
  llmCallDurationSeconds,
} from '../services/metricsService.js';
import {
  dbQueriesPerSecond,
  httpRequestsPerSecond,
  llmRequestsPerSecond,
} from '../services/metricsService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

type HistogramSummary = {
  count: number;
  sum: number;
  buckets: Array<{ le: number; count: number }>;
};

const SLI_BUDGETS_MS = {
  loginP95: 1500,
  notificationsP95: 300,
  unreadCountP95: 200,
  organizationProfileP95: 400,
  llmProviderSnapshotP95: 200,
} as const;

async function summarizeHistogram(metric: any): Promise<HistogramSummary> {
  const raw = await metric?.get?.();
  const values: Array<{ labels?: Record<string, unknown>; value?: number; metricName?: string }> =
    raw?.values || [];

  let count = 0;
  let sum = 0;
  const bucketsByLe = new Map<number, number>();

  for (const v of values) {
    const metricName = String((v as any)?.metricName || '');
    const val = Number((v as any)?.value || 0);

    if (metricName.endsWith('_sum')) {
      sum += val;
      continue;
    }

    if (metricName.endsWith('_count')) {
      count += val;
      continue;
    }

    if (metricName.endsWith('_bucket')) {
      const leRaw = (v as any)?.labels?.le;
      const le =
        leRaw === '+Inf'
          ? Number.POSITIVE_INFINITY
          : typeof leRaw === 'string' || typeof leRaw === 'number'
            ? Number(leRaw)
            : Number.NaN;
      if (Number.isFinite(le) || le === Number.POSITIVE_INFINITY) {
        bucketsByLe.set(le, (bucketsByLe.get(le) || 0) + val);
      }
    }
  }

  const buckets = Array.from(bucketsByLe.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([le, c]) => ({ le, count: c }));

  return { count, sum, buckets };
}

function approxQuantileFromBuckets(summary: HistogramSummary, q: number): number {
  if (!summary.count || summary.count <= 0) return 0;
  const target = Math.ceil(summary.count * q);
  for (const b of summary.buckets) {
    if (b.count >= target) {
      if (!Number.isFinite(b.le)) {
        // If the quantile falls into +Inf, best-effort return the highest finite bucket if present.
        const finite = summary.buckets.filter((x) => Number.isFinite(x.le));
        return finite.length ? finite[finite.length - 1].le : 0;
      }
      return b.le;
    }
  }
  const finite = summary.buckets.filter((x) => Number.isFinite(x.le));
  return finite.length ? finite[finite.length - 1].le : 0;
}

// ==========================================
// PERFORMANCE METRICS ENDPOINT
// ==========================================

/**
 * GET /api/performance/metrics
 * Returns performance metrics including P95/P99 latency and throughput
 *
 * Response format:
 * {
 *   timestamp: string,
 *   latency: {
 *     http: { p50, p95, p99, avg },
 *     db: { p50, p95, p99, avg },
 *     llm: { p50, p95, p99, avg }
 *   },
 *   throughput: {
 *     http: number, // req/s
 *     db: number,   // queries/s
 *     llm: number   // calls/s
 *   },
 *   errors: {
 *     rate: number,
 *     total: number
 *   }
 * }
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const register = metricsService.getRegistry();

    // Get all metrics in Prometheus format
    const prometheusMetrics = await register.metrics();

    const latency = await extractLatencyMetrics();
    const throughput = await extractThroughputMetrics(register);
    const errors = await extractErrorMetrics();

    const response = {
      timestamp: new Date().toISOString(),
      sliBudgetsMs: SLI_BUDGETS_MS,
      latency,
      throughput,
      errors,
      // Include raw Prometheus metrics for advanced analysis
      raw: process.env.NODE_ENV === 'development' ? prometheusMetrics : undefined,
    };

    return res.status(200).json(response);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[PerformanceRoutes] Error generating performance metrics:', err);
    return res.status(500).json({
      error: 'Failed to generate performance metrics',
      details: err.message,
    });
  }
});

/**
 * Extract latency metrics from Prometheus format
 * Note: Actual percentile calculation requires Prometheus query
 * This is a simplified version that extracts available data
 */
async function extractLatencyMetrics(): Promise<{
  http: { p50: number; p95: number; p99: number; avg: number };
  db: { p50: number; p95: number; p99: number; avg: number };
  llm: { p50: number; p95: number; p99: number; avg: number };
}> {
  const [http, db, llm] = await Promise.all([
    summarizeHistogram(httpRequestDurationSeconds),
    summarizeHistogram(dbQueryDurationSeconds),
    summarizeHistogram(llmCallDurationSeconds),
  ]);

  const mk = (h: HistogramSummary) => ({
    p50: approxQuantileFromBuckets(h, 0.5),
    p95: approxQuantileFromBuckets(h, 0.95),
    p99: approxQuantileFromBuckets(h, 0.99),
    avg: h.count > 0 ? h.sum / h.count : 0,
  });

  return { http: mk(http), db: mk(db), llm: mk(llm) };
}

/**
 * Extract throughput metrics from gauge values
 */
async function extractThroughputMetrics(register: any): Promise<{
  http: number;
  db: number;
  llm: number;
}> {
  try {
    // Get gauge values
    const httpGauge = register.getSingleMetric('http_requests_per_second');
    const dbGauge = register.getSingleMetric('db_queries_per_second');
    const llmGauge = register.getSingleMetric('llm_requests_per_second');

    const [httpVal, dbVal, llmVal] = await Promise.all([
      httpGauge?.get?.(),
      dbGauge?.get?.(),
      llmGauge?.get?.(),
    ]);

    return {
      http: httpVal?.values?.[0]?.value || 0,
      db: dbVal?.values?.[0]?.value || 0,
      llm: llmVal?.values?.[0]?.value || 0,
    };
  } catch (error) {
    logger.warn('[PerformanceRoutes] Error extracting throughput metrics:', error);
    return {
      http: 0,
      db: 0,
      llm: 0,
    };
  }
}

/**
 * Extract error metrics from Prometheus format
 */
async function extractErrorMetrics(): Promise<{
  rate: number;
  total: number;
}> {
  const metric = await errorsTotal.get();
  const values: Array<{ value?: number }> = (metric as any)?.values || [];
  const total = values.reduce((acc, v) => acc + Number((v as any)?.value || 0), 0);

  // Best-effort rate: delta since the last call to this endpoint.
  // This avoids returning a fake constant like 0 while not pretending to be a Prometheus 5m window.
  const now = Date.now();
  const lastTotal = (extractErrorMetrics as any)._lastTotal as number | undefined;
  const lastAt = (extractErrorMetrics as any)._lastAt as number | undefined;
  (extractErrorMetrics as any)._lastTotal = total;
  (extractErrorMetrics as any)._lastAt = now;

  let rate = 0;
  if (typeof lastTotal === 'number' && typeof lastAt === 'number' && now > lastAt) {
    const dt = (now - lastAt) / 1000;
    rate = dt > 0 ? Math.max(0, (total - lastTotal) / dt) : 0;
  }

  return { rate, total };
}

export default router;
