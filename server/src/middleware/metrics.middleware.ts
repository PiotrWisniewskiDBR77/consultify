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

import { getPrimaryPoolSaturationPercent } from '../database/PostgresDatabase.js';
import {
  getOperationalPrometheusMetrics,
  operationalAlerts,
} from '../services/operationalAlertService.js';

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

const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000].sort((a, b) => a - b);
const METRICS_MW_INSTALLED = Symbol('consultify.metrics.middleware.installed');
const MAX_METRIC_METHOD_CHARS = 32;
const MAX_METRIC_COUNTER = Number.MAX_SAFE_INTEGER;
const MAX_RECORDED_REQUEST_DURATION_MS = 600_000;
const MAX_DISTINCT_METHOD_LABELS = 64;
const METHOD_OVERFLOW_BUCKET = 'OTHER';

const metrics: MetricsBucket = {
  requests: 0,
  errors: 0,
  latencySum: 0,
  latencyBuckets: Object.fromEntries(LATENCY_BUCKETS.map((b) => [`le_${b}`, 0])),
  byStatus: Object.create(null) as Record<number, number>,
  byMethod: Object.create(null) as Record<string, number>,
  rateLimitHits: 0,
  aiTimeouts: 0,
};

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function safeMethod(req: Request): string {
  const raw = normalizeOptionalString(safeRead(() => req.method, undefined));
  if (!raw) return 'UNKNOWN';
  const normalized = raw.toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(normalized)) return 'OTHER';
  return normalized.length > MAX_METRIC_METHOD_CHARS
    ? normalized.slice(0, MAX_METRIC_METHOD_CHARS)
    : normalized;
}

function normalizeHttpStatus(rawStatus: unknown): number {
  const parsed = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus);
  if (!Number.isFinite(parsed)) return 500;
  const integerStatus = Math.trunc(parsed);
  if (integerStatus < 100 || integerStatus > 599) return 500;
  return integerStatus;
}

function toPrometheusCounter(rawValue: unknown): string {
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return '0';
  return Math.trunc(value).toString();
}

function escapePrometheusLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"');
}

function addBoundedMetric(current: unknown, delta: unknown): number {
  const currentValue =
    typeof current === 'number' && Number.isFinite(current) && current >= 0 ? current : 0;
  const deltaValue = typeof delta === 'number' && Number.isFinite(delta) && delta > 0 ? delta : 0;
  if (deltaValue === 0) return Math.min(currentValue, MAX_METRIC_COUNTER);
  return Math.min(MAX_METRIC_COUNTER, currentValue + deltaValue);
}

function subtractBoundedMetric(current: unknown, delta: unknown): number {
  const currentValue =
    typeof current === 'number' && Number.isFinite(current) && current >= 0 ? current : 0;
  const deltaValue = typeof delta === 'number' && Number.isFinite(delta) && delta > 0 ? delta : 0;
  if (deltaValue === 0) return Math.min(currentValue, MAX_METRIC_COUNTER);
  return Math.max(0, Math.min(MAX_METRIC_COUNTER, currentValue - deltaValue));
}

export function incrementRateLimitHits(): void {
  metrics.rateLimitHits = addBoundedMetric(metrics.rateLimitHits, 1);
}
export function incrementAiTimeouts(): void {
  metrics.aiTimeouts = addBoundedMetric(metrics.aiTimeouts, 1);
}

export function getRequestMetrics(): MetricsBucket {
  return {
    requests: metrics.requests,
    errors: metrics.errors,
    latencySum: metrics.latencySum,
    latencyBuckets: { ...metrics.latencyBuckets },
    byStatus: Object.assign(Object.create(null), metrics.byStatus),
    byMethod: Object.assign(Object.create(null), metrics.byMethod),
    rateLimitHits: metrics.rateLimitHits,
    aiTimeouts: metrics.aiTimeouts,
  };
}

export function getPrometheusMetrics(): string {
  try {
    const lines: string[] = [];
    lines.push(`# HELP http_requests_total Total HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total ${toPrometheusCounter(metrics.requests)}`);

    lines.push(`# HELP http_errors_total Total HTTP 5xx errors`);
    lines.push(`# TYPE http_errors_total counter`);
    lines.push(`http_errors_total ${toPrometheusCounter(metrics.errors)}`);

    lines.push(`# HELP http_request_duration_ms_sum Total request duration`);
    lines.push(`# TYPE http_request_duration_ms_sum counter`);
    lines.push(`http_request_duration_ms_sum ${toPrometheusCounter(metrics.latencySum)}`);

    for (const bucket of LATENCY_BUCKETS) {
      lines.push(
        `http_request_duration_ms_bucket{le="${bucket}"} ${toPrometheusCounter(metrics.latencyBuckets[`le_${bucket}`])}`
      );
    }
    lines.push(
      `http_request_duration_ms_bucket{le="+Inf"} ${toPrometheusCounter(metrics.requests)}`
    );

    lines.push(`# HELP rate_limit_hits_total Rate limit hits`);
    lines.push(`# TYPE rate_limit_hits_total counter`);
    lines.push(`rate_limit_hits_total ${toPrometheusCounter(metrics.rateLimitHits)}`);

    lines.push(`# HELP ai_timeouts_total AI call timeouts`);
    lines.push(`# TYPE ai_timeouts_total counter`);
    lines.push(`ai_timeouts_total ${toPrometheusCounter(metrics.aiTimeouts)}`);

    lines.push(`# HELP http_requests_by_method_total HTTP requests by normalized method`);
    lines.push(`# TYPE http_requests_by_method_total counter`);
    for (const [method, count] of Object.entries(metrics.byMethod)) {
      lines.push(
        `http_requests_by_method_total{method="${escapePrometheusLabelValue(method)}"} ${toPrometheusCounter(count)}`
      );
    }

    lines.push(`# HELP http_requests_by_status HTTP requests by normalized response status`);
    lines.push(`# TYPE http_requests_by_status counter`);
    for (const [status, count] of Object.entries(metrics.byStatus)) {
      lines.push(
        `http_requests_by_status{status="${escapePrometheusLabelValue(status)}"} ${toPrometheusCounter(count)}`
      );
    }

    operationalAlerts.recordDbSaturation(getPrimaryPoolSaturationPercent(), 'metrics:primary-pool');
    lines.push(`# HELP consultify_operational_alert_active Whether an OPS-OBS-001 alert is active`);
    lines.push(`# TYPE consultify_operational_alert_active gauge`);
    lines.push(getOperationalPrometheusMetrics());

    return lines.join('\n') + '\n';
  } catch {
    return '# consultify metrics export failed\n';
  }
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (safeRead(() => Boolean((res as any)[METRICS_MW_INSTALLED]), false)) {
    next();
    return;
  }

  const start = Date.now();
  const method = safeMethod(req);
  const effectiveMethod = (() => {
    if (method in metrics.byMethod) return method;
    if (Object.keys(metrics.byMethod).length < MAX_DISTINCT_METHOD_LABELS) return method;
    return METHOD_OVERFLOW_BUCKET;
  })();
  let completionRecorded = false;
  let listenersDetached = false;
  const detachCompletionListeners = () => {
    if (listenersDetached) return;
    const remove = (res as any).removeListener;
    if (typeof remove === 'function') {
      safeRead(() => {
        remove.call(res, 'finish', onFinish);
        return true;
      }, false);
      safeRead(() => {
        remove.call(res, 'close', onClose);
        return true;
      }, false);
    }
    listenersDetached = true;
  };
  const recordCompletion = () => {
    if (completionRecorded) return;
    completionRecorded = true;
    try {
      const rawDuration = Date.now() - start;
      const duration = Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : 0;
      const recordedDuration = Math.min(duration, MAX_RECORDED_REQUEST_DURATION_MS);
      const status = normalizeHttpStatus(safeRead(() => res.statusCode, 500));

      metrics.latencySum = addBoundedMetric(metrics.latencySum, recordedDuration);
      metrics.byStatus[status] = addBoundedMetric(metrics.byStatus[status], 1);

      if (status >= 500) metrics.errors = addBoundedMetric(metrics.errors, 1);
      if (status === 401 || status === 403) {
        operationalAlerts.recordAuthDenial(
          normalizeOptionalString(safeRead(() => req.headers['x-request-id'], undefined))
        );
      }

      for (const bucket of LATENCY_BUCKETS) {
        if (recordedDuration <= bucket) {
          metrics.latencyBuckets[`le_${bucket}`] = addBoundedMetric(
            metrics.latencyBuckets[`le_${bucket}`],
            1
          );
        }
      }
    } catch {
      // Never break the response path due to metrics accounting.
    }
    detachCompletionListeners();
  };
  const onFinish = () => {
    recordCompletion();
  };
  const onClose = () => {
    recordCompletion();
  };

  const originalEnd = safeRead(() => res.end.bind(res), null as unknown as (...args: any[]) => any);
  if (!originalEnd) {
    next();
    return;
  }
  const wrappedEnd = function (this: unknown, ...args: any[]) {
    try {
      return originalEnd.apply(this, args);
    } finally {
      recordCompletion();
    }
  };
  const installed = safeRead(() => {
    (res as any).end = wrappedEnd as typeof res.end;
    return true;
  }, false);
  if (!installed) {
    next();
    return;
  }
  safeRead(() => {
    (res as any)[METRICS_MW_INSTALLED] = true;
    return true;
  }, false);
  let listenerAttachFailed = false;
  try {
    if (typeof (res as any).once === 'function') {
      (res as any).once('finish', onFinish);
      (res as any).once('close', onClose);
    } else if (typeof (res as any).on === 'function') {
      (res as any).on('finish', onFinish);
      (res as any).on('close', onClose);
    }
  } catch {
    listenerAttachFailed = true;
  }
  if (listenerAttachFailed) {
    safeRead(() => {
      (res as any).end = originalEnd as typeof res.end;
      delete (res as any)[METRICS_MW_INSTALLED];
      return true;
    }, false);
    next();
    return;
  }

  metrics.requests = addBoundedMetric(metrics.requests, 1);
  metrics.byMethod[effectiveMethod] = addBoundedMetric(metrics.byMethod[effectiveMethod], 1);

  try {
    next();
  } catch (error) {
    detachCompletionListeners();
    safeRead(() => {
      (res as any).end = originalEnd as typeof res.end;
      delete (res as any)[METRICS_MW_INSTALLED];
      return true;
    }, false);
    metrics.requests = subtractBoundedMetric(metrics.requests, 1);
    metrics.byMethod[effectiveMethod] = subtractBoundedMetric(metrics.byMethod[effectiveMethod], 1);
    throw error;
  }
};

export default metricsMiddleware;

export const __private__ = {
  addBoundedMetric,
  subtractBoundedMetric,
  escapePrometheusLabelValue,
};
