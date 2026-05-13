/**
 * Performance Metrics Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of performanceMetrics.js
 * Tracks response times, DB query times, and memory usage
 */

import type { NextFunction, Request, Response } from 'express';

import { getMetricsService } from '../services/metricsService.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ==========================================
// TYPES
// ==========================================

interface PerformanceMetrics {
  startTime: number;
  startMemory: NodeJS.MemoryUsage;
  dbQueryCount: number;
  dbQueryTime: number;
}

interface RequestWithMetrics extends Request {
  _performanceMetrics?: PerformanceMetrics;
  user?: {
    id?: string;
    organizationId?: string;
  };
}

interface Metric {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  dbQueryCount: number;
  dbQueryTime: number;
  memoryDelta: {
    heapUsed: number;
    external: number;
    rss: number;
  };
  userId: string | null;
  organizationId: string | null;
}

interface MetricsStore {
  requests: Metric[];
  dbQueries: unknown[];
  errors: unknown[];
}

interface EndpointMetrics {
  method: string;
  path: string;
  count: number;
  totalTime: number;
  avgTime: number;
  errorCount: number;
}

interface MetricsSummary {
  totalRequests: number;
  avgResponseTime: number;
  avgDbQueryCount: number;
  avgDbQueryTime: number;
  errorRate: number;
  slowRequests: number;
  slowestEndpoints: EndpointMetrics[];
  errorEndpoints: EndpointMetrics[];
  windowMinutes: number;
}

// ==========================================
// STORE
// ==========================================

const metricsStore: MetricsStore = {
  requests: [],
  dbQueries: [],
  errors: [],
};

const MAX_ENTRIES = 1000;
const MAX_METRIC_PATH_CHARS = 2048;
const MAX_METHOD_LABEL_CHARS = 32;
const MAX_DB_QUERY_TYPE_CHARS = 128;
const MAX_USER_CONTEXT_CHARS = 256;
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1000;
const MAX_SLOW_REQUEST_THRESHOLD_MS = 86_400_000;
const resolveSlowRequestThresholdMs = (raw: string | undefined): number => {
  const normalized = normalizeOptionalString(raw);
  if (!normalized) return DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
  return Math.min(parsed, MAX_SLOW_REQUEST_THRESHOLD_MS);
};
const SLOW_REQUEST_THRESHOLD_MS = resolveSlowRequestThresholdMs(process.env.SLOW_REQUEST_THRESHOLD_MS);
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const performanceFinishHooked = new WeakSet<Response>();

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

function readRequestMethod(req: Request): string {
  return normalizeOptionalString(safeRead(() => req.method, undefined)) || 'UNKNOWN';
}

function readRequestPath(req: Request): string {
  return (
    normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
    normalizeOptionalString(safeRead(() => req.path, undefined)) ||
    'unknown'
  );
}

function getRouteLabel(req: Request): string {
  const routePath = safeRead(() => (req.route as any)?.path, undefined);
  const baseUrl = normalizeOptionalString(safeRead(() => req.baseUrl, undefined)) || '';
  const path = readRequestPath(req);
  if (typeof routePath === 'string') {
    return `${baseUrl}${routePath}` || path;
  }
  return baseUrl || path;
}
function clampMetricText(value: string, maxChars: number): string {
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function sanitizeDbQueryType(value: unknown): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return 'unknown';
  return clampMetricText(normalized.toLowerCase(), MAX_DB_QUERY_TYPE_CHARS);
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Performance metrics middleware
 * Tracks response time, DB queries, and memory usage
 */
export function performanceMetricsMiddleware(
  req: RequestWithMetrics,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  const requestMethod = readRequestMethod(req);
  const requestPath = readRequestPath(req);

  // Store metrics in request for later access
  req._performanceMetrics = {
    startTime,
    startMemory,
    dbQueryCount: 0,
    dbQueryTime: 0,
  };

  // Enable performance tracking for this request (if available)
  const metricsService = getMetricsService();
  let performanceTrackingEnabled = false;
  if (typeof queryHelpers.enablePerformanceTracking === 'function') {
    try {
      queryHelpers.enablePerformanceTracking((_queryType: string, duration: number) => {
        try {
          if (!Number.isFinite(duration) || duration < 0) {
            return;
          }
          if (req._performanceMetrics) {
            req._performanceMetrics.dbQueryCount++;
            req._performanceMetrics.dbQueryTime += duration;
          }
          // Record DB query metric for Prometheus
          const dbType = process.env.DB_TYPE || 'postgres';
          const queryType = sanitizeDbQueryType(_queryType);
          metricsService.recordDbQuery(queryType, dbType, duration / 1000); // Convert to seconds
        } catch (error) {
          logger.warn('Performance middleware DB tracking callback failed', error);
        }
      });
      performanceTrackingEnabled = true;
    } catch (error) {
      logger.warn('Performance middleware enablePerformanceTracking failed', error);
    }
  }
  let trackingReleased = false;
  let finishObserved = false;
  const releasePerformanceTracking = (): void => {
    if (!performanceTrackingEnabled || trackingReleased) return;
    trackingReleased = true;
    if (typeof queryHelpers.disablePerformanceTracking === 'function') {
      try {
        queryHelpers.disablePerformanceTracking();
      } catch (error) {
        logger.warn('Performance middleware tracking teardown failed', error);
      }
    }
  };

  // Track response finish
  const onFinish = () => {
    if (finishObserved) {
      return;
    }
    finishObserved = true;
    try {
      const responseTimeRaw = Date.now() - startTime;
      const responseTime =
        Number.isFinite(responseTimeRaw) && responseTimeRaw >= 0 ? responseTimeRaw : 0;
      const routeLabel = clampMetricText(getRouteLabel(req), MAX_METRIC_PATH_CHARS);
      const endMemory = safeRead(() => process.memoryUsage(), startMemory);
      const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss,
      };

      const metrics = safeRead(
        () => req._performanceMetrics || { dbQueryCount: 0, dbQueryTime: 0 },
        { dbQueryCount: 0, dbQueryTime: 0 }
      );
      const statusCodeRaw = safeRead(() => res.statusCode, 500);
      const statusCode =
        Number.isFinite(statusCodeRaw) &&
        Number.isInteger(statusCodeRaw) &&
        statusCodeRaw >= 100 &&
        statusCodeRaw <= 599
          ? statusCodeRaw
          : 500;
      const metric: Metric = {
        timestamp: new Date().toISOString(),
        method: clampMetricText(requestMethod, MAX_METHOD_LABEL_CHARS),
        path: clampMetricText(requestPath, MAX_METRIC_PATH_CHARS),
        statusCode,
        responseTime,
        dbQueryCount: metrics.dbQueryCount,
        dbQueryTime: metrics.dbQueryTime,
        memoryDelta,
        userId: clampMetricText(
          normalizeOptionalString(safeRead(() => req.user?.id, undefined)) || '',
          MAX_USER_CONTEXT_CHARS
        ) || null,
        organizationId:
          clampMetricText(
            normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) || '',
            MAX_USER_CONTEXT_CHARS
          ) || null,
      };

      // Store metric
      metricsStore.requests.push(metric);
      if (metricsStore.requests.length > MAX_ENTRIES) {
        metricsStore.requests.shift();
      }
      try {
        metricsService.recordHttpRequest(requestMethod, routeLabel, statusCode, responseTime / 1000);
      } catch (error) {
        logger.warn('Performance middleware recordHttpRequest failed', error);
      }

      // Log slow requests or errors outside test mode.
      // Tests intentionally exercise many 401/403/4xx paths, which can create noisy logs.
      if (!IS_TEST_ENV && (responseTime > SLOW_REQUEST_THRESHOLD_MS || statusCode >= 400)) {
        logger.warn('Performance metric', {
          ...metric,
          route: routeLabel,
          isSlow: responseTime > SLOW_REQUEST_THRESHOLD_MS,
          isError: statusCode >= 400,
        });
      }

      // Log high DB query counts outside test mode.
      if (!IS_TEST_ENV && metrics.dbQueryCount > 10) {
        logger.warn('High DB query count', {
          path: metric.path,
          dbQueryCount: metrics.dbQueryCount,
          dbQueryTime: metrics.dbQueryTime,
        });
      }

      // Record error metric if status >= 400
      if (statusCode >= 400) {
        try {
          const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
          metricsService.recordError(errorType, 'http');
        } catch (error) {
          logger.warn('Performance middleware recordError failed', error);
        }
      }
    } catch (error) {
      logger.warn('Performance middleware finish handler failed', error);
    } finally {
      releasePerformanceTracking();
    }
  };

  const finishListenerAttached = safeRead(() => {
    if (typeof res.on !== 'function') {
      return false;
    }
    if (performanceFinishHooked.has(res)) {
      return true;
    }
    if (
      typeof (res as Response & { once?: (event: string, listener: () => void) => Response })
        .once === 'function'
    ) {
      (res as Response & { once: (event: string, listener: () => void) => Response }).once(
        'finish',
        onFinish
      );
    } else {
      res.on('finish', onFinish);
    }
    performanceFinishHooked.add(res);
    return true;
  }, false);

  if (performanceTrackingEnabled && !finishListenerAttached) {
    releasePerformanceTracking();
  }

  try {
    next();
  } catch (error) {
    releasePerformanceTracking();
    throw error;
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get performance metrics summary
 */
export function getMetricsSummary(windowMinutes: number = 60): MetricsSummary {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recentRequests = metricsStore.requests.filter(
    (m) => new Date(m.timestamp).getTime() > cutoff
  );

  if (recentRequests.length === 0) {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      avgDbQueryCount: 0,
      avgDbQueryTime: 0,
      errorRate: 0,
      slowRequests: 0,
      slowestEndpoints: [],
      errorEndpoints: [],
      windowMinutes,
    };
  }

  const totalRequests = recentRequests.length;
  const avgResponseTime =
    recentRequests.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
  const avgDbQueryCount =
    recentRequests.reduce((sum, m) => sum + m.dbQueryCount, 0) / totalRequests;
  const avgDbQueryTime = recentRequests.reduce((sum, m) => sum + m.dbQueryTime, 0) / totalRequests;
  const errorCount = recentRequests.filter((m) => m.statusCode >= 400).length;
  const errorRate = (errorCount / totalRequests) * 100;
  const slowRequests = recentRequests.filter((m) => m.responseTime > 1000).length;

  // Group by endpoint
  const byEndpoint = recentRequests.reduce(
    (acc, m) => {
      const key = `${m.method} ${m.path}`;
      if (!acc[key]) {
        acc[key] = {
          method: m.method,
          path: m.path,
          count: 0,
          totalTime: 0,
          avgTime: 0,
          errorCount: 0,
        };
      }
      acc[key].count++;
      acc[key].totalTime += m.responseTime;
      acc[key].errorCount += m.statusCode >= 400 ? 1 : 0;
      acc[key].avgTime = acc[key].totalTime / acc[key].count;
      return acc;
    },
    {} as Record<string, EndpointMetrics>
  );

  // Get top slowest endpoints
  const slowestEndpoints = Object.values(byEndpoint)
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  // Get endpoints with most errors
  const errorEndpoints = Object.values(byEndpoint)
    .filter((e) => e.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 10);

  return {
    totalRequests,
    avgResponseTime: Math.round(avgResponseTime),
    avgDbQueryCount: Math.round(avgDbQueryCount * 100) / 100,
    avgDbQueryTime: Math.round(avgDbQueryTime),
    errorRate: Math.round(errorRate * 100) / 100,
    slowRequests,
    slowestEndpoints,
    errorEndpoints,
    windowMinutes,
  };
}

/**
 * Get current memory usage
 */
export function getMemoryMetrics(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: string;
} {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear metrics store (useful for testing or periodic cleanup)
 */
export function clearMetrics(): void {
  metricsStore.requests = [];
  metricsStore.dbQueries = [];
  metricsStore.errors = [];
}

export const resetMetrics = clearMetrics;
export { metricsStore }; // Expose for testing
export { resolveSlowRequestThresholdMs };
