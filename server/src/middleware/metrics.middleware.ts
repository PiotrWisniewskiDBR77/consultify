/**
 * Metrics Middleware (T107)
 *
 * Lightweight request metrics collection:
 * - Request counts by method/status
 * - Latency distribution (buckets)
 * - Rate limit hit counter
 * - AI timeout counter
 * - Prometheus-compatible export
 */

import type { NextFunction, Request, Response } from 'express';

interface MetricsBucket {
  requests: number;
  errors: number;
  latencySum: number;
  latencyBuckets: Record<string, number>;
  byStatus: Record<number, number>;
  byMethod: Record<string, number>;
  rateLimitHits: number;
  aiTimeouts: number;
}

const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

const metrics: MetricsBucket = {
  requests: 0,
  errors: 0,
  latencySum: 0,
  latencyBuckets: Object.fromEntries(LATENCY_BUCKETS.map((b) => [`le_${b}`, 0])),
  byStatus: {},
  byMethod: {},
  rateLimitHits: 0,
  aiTimeouts: 0,
};

export function incrementRateLimitHits(): void {
  metrics.rateLimitHits++;
}
export function incrementAiTimeouts(): void {
  metrics.aiTimeouts++;
}

export function getRequestMetrics(): MetricsBucket {
  return { ...metrics };
}

export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  lines.push(`# HELP http_requests_total Total HTTP requests`);
  lines.push(`# TYPE http_requests_total counter`);
  lines.push(`http_requests_total ${metrics.requests}`);

  lines.push(`# HELP http_errors_total Total HTTP 5xx errors`);
  lines.push(`# TYPE http_errors_total counter`);
  lines.push(`http_errors_total ${metrics.errors}`);

  lines.push(`# HELP http_request_duration_ms_sum Total request duration`);
  lines.push(`# TYPE http_request_duration_ms_sum counter`);
  lines.push(`http_request_duration_ms_sum ${metrics.latencySum.toFixed(0)}`);

  for (const bucket of LATENCY_BUCKETS) {
    lines.push(
      `http_request_duration_ms_bucket{le="${bucket}"} ${metrics.latencyBuckets[`le_${bucket}`]}`
    );
  }
  lines.push(`http_request_duration_ms_bucket{le="+Inf"} ${metrics.requests}`);

  lines.push(`# HELP rate_limit_hits_total Rate limit hits`);
  lines.push(`# TYPE rate_limit_hits_total counter`);
  lines.push(`rate_limit_hits_total ${metrics.rateLimitHits}`);

  lines.push(`# HELP ai_timeouts_total AI call timeouts`);
  lines.push(`# TYPE ai_timeouts_total counter`);
  lines.push(`ai_timeouts_total ${metrics.aiTimeouts}`);

  for (const [status, count] of Object.entries(metrics.byStatus)) {
    lines.push(`http_requests_by_status{status="${status}"} ${count}`);
  }

  return lines.join('\n') + '\n';
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  metrics.requests++;
  metrics.byMethod[req.method] = (metrics.byMethod[req.method] || 0) + 1;

  const originalEnd = res.end.bind(res) as (...args: any[]) => any;
  (res as any).end = function (...args: any[]) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    metrics.latencySum += duration;
    metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;

    if (status >= 500) metrics.errors++;

    for (const bucket of LATENCY_BUCKETS) {
      if (duration <= bucket) {
        metrics.latencyBuckets[`le_${bucket}`]++;
      }
    }

    return originalEnd(...args);
  };

  next();
};

export default metricsMiddleware;
