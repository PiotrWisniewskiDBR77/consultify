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

// ==========================================
// HELPERS
// ==========================================

/**
 * Resolve SLOW_REQUEST_THRESHOLD_MS from an env-var string.
 * - undefined / empty / non-numeric / <= 0 → 1000 (default)
 * - value > 86_400_000 (24 h) → capped at 86_400_000
 */
export function resolveSlowRequestThresholdMs(raw: string | undefined): number {
  const DEFAULT = 1000;
  const MAX = 86_400_000;
  if (raw === undefined || raw === '') return DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT;
  return Math.min(parsed, MAX);
}

const SLOW_REQUEST_THRESHOLD_MS = resolveSlowRequestThresholdMs(
  process.env.SLOW_REQUEST_THRESHOLD_MS
);

/** Safe string read from a property that may throw */
function safeStr(fn: () => unknown, fallback: string): string {
  try {
    const v = fn();
    return typeof v === 'string' ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Cap a string to maxLen chars */
function cap(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/** Return 0 for non-finite deltas */
function finiteOrZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function getRouteLabel(req: Request): string {
  try {
    const routePath = (req.route as any)?.path;
    if (typeof routePath === 'string') {
      return cap(`${req.baseUrl || ''}${routePath}` || req.path, 2048);
    }
    const raw = req.baseUrl || req.path || req.originalUrl || 'unknown';
    return cap(raw, 2048);
  } catch {
    return 'unknown';
  }
}

// Symbol used as a flag on the response to avoid double-registration
const FINISH_REGISTERED = Symbol('__perfMetricsFinishRegistered');

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

  // Store metrics in request for later access
  try {
    req._performanceMetrics = {
      startTime,
      startMemory,
      dbQueryCount: 0,
      dbQueryTime: 0,
    };
  } catch {
    // setter may throw — continue without storing
  }

  // Obtain metrics service — bail gracefully if unavailable
  let metricsService: ReturnType<typeof getMetricsService> | null = null;
  try {
    metricsService = getMetricsService();
  } catch (err) {
    logger.warn('Performance middleware getMetricsService failed', err);
  }

  // Enable performance tracking for this request (if available)
  if (typeof queryHelpers.enablePerformanceTracking === 'function') {
    try {
      queryHelpers.enablePerformanceTracking((queryType: string, duration: number) => {
        // Validate duration
        if (!Number.isFinite(duration) || duration < 0) return;
        // Validate queryType
        const rawType = typeof queryType === 'string' ? queryType : 'unknown';
        const safeType = cap(rawType.trim().toLowerCase(), 128);
        const normalizedType = safeType || 'unknown';

        // Accumulate in request metrics
        try {
          const pm = req._performanceMetrics;
          if (pm) {
            pm.dbQueryCount++;
            pm.dbQueryTime += duration;
          }
        } catch {
          // _performanceMetrics getter may throw — skip accumulation
        }

        // Record DB query metric for Prometheus
        try {
          const dbType = process.env.DB_TYPE || 'postgres';
          if (metricsService) {
            metricsService.recordDbQuery(normalizedType, dbType, duration / 1000);
          }
        } catch (err) {
          logger.warn('Performance middleware DB tracking callback failed', err);
        }
      });
    } catch (err) {
      logger.warn('Performance middleware enablePerformanceTracking failed', err);
    }
  }

  // Guard: register the finish handler only once per response object
  const resAny = res as any;
  if (resAny[FINISH_REGISTERED]) {
    // Already wired up — just proceed
    next();
    return;
  }

  // Prefer res.once (auto-removes after first fire) over res.on
  const addFinishListener =
    typeof resAny.once === 'function'
      ? (cb: () => void) => resAny.once('finish', cb)
      : typeof resAny.on === 'function'
        ? (cb: () => void) => resAny.on('finish', cb)
        : null;

  if (!addFinishListener) {
    // Response doesn't support event listeners — clean up and bail
    if (typeof queryHelpers.disablePerformanceTracking === 'function') {
      queryHelpers.disablePerformanceTracking();
    }
    next();
    return;
  }

  try {
    let finished = false;

    addFinishListener(() => {
      // Idempotency guard: record only once even if callback fires multiple times
      if (finished) return;
      finished = true;

      const endTime = Date.now();
      const responseTime = Math.max(0, endTime - startTime);

      // Sanitize statusCode (NaN → 500)
      const rawStatus = res.statusCode;
      const statusCode = Number.isFinite(rawStatus) ? rawStatus : 500;

      // Read request fields safely (they may throw)
      const method = cap(safeStr(() => req.method, 'UNKNOWN'), 32);
      const path = cap(safeStr(() => req.originalUrl || req.path, 'unknown'), 2048);
      const routeLabel = getRouteLabel(req);
      const userId = cap(safeStr(() => req.user?.id ?? '', ''), 256) || null;
      const organizationId = cap(safeStr(() => req.user?.organizationId ?? '', ''), 256) || null;

      // Read stored performance metrics (getter may throw)
      let dbQueryCount = 0;
      let dbQueryTime = 0;
      try {
        const pm = req._performanceMetrics;
        if (pm) {
          dbQueryCount = pm.dbQueryCount;
          dbQueryTime = pm.dbQueryTime;
        }
      } catch {
        // fall through with 0/0
      }

      // Compute memory delta, clamping non-finite values to 0
      const endMemory = process.memoryUsage();
      const memoryDelta = {
        heapUsed: finiteOrZero(endMemory.heapUsed - startMemory.heapUsed),
        external: finiteOrZero(endMemory.external - startMemory.external),
        rss: finiteOrZero(endMemory.rss - startMemory.rss),
      };

      const metric: Metric = {
        timestamp: new Date().toISOString(),
        method,
        path,
        statusCode,
        responseTime,
        dbQueryCount,
        dbQueryTime,
        memoryDelta,
        userId,
        organizationId,
      };

      // Store metric first (before any throws from the service)
      metricsStore.requests.push(metric);
      if (metricsStore.requests.length > MAX_ENTRIES) {
        metricsStore.requests.shift();
      }

      // Export to metrics service
      try {
        if (metricsService) {
          metricsService.recordHttpRequest(method, routeLabel, statusCode, responseTime / 1000);
        }
      } catch (err) {
        logger.warn('Performance middleware recordHttpRequest failed', err);
      }

      // Log slow requests or errors
      if (responseTime > SLOW_REQUEST_THRESHOLD_MS || statusCode >= 400) {
        logger.warn('Performance metric', {
          ...metric,
          route: routeLabel,
          isSlow: responseTime > SLOW_REQUEST_THRESHOLD_MS,
          isError: statusCode >= 400,
        });
      }

      // Log high DB query count (>10 queries)
      if (dbQueryCount > 10) {
        logger.warn('High DB query count', {
          path,
          dbQueryCount,
          dbQueryTime,
        });
      }

      // Record error metric if status >= 400
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        try {
          if (metricsService) {
            metricsService.recordError(errorType, 'http');
          }
        } catch (err) {
          logger.warn('Performance middleware recordError failed', err);
        }
      }

      // Disable performance tracking when request finishes
      if (typeof queryHelpers.disablePerformanceTracking === 'function') {
        queryHelpers.disablePerformanceTracking();
      }
    });

    // Also listen for close (connection aborted before finish)
    if (typeof resAny.once === 'function') {
      resAny.once('close', () => {
        if (typeof queryHelpers.disablePerformanceTracking === 'function') {
          queryHelpers.disablePerformanceTracking();
        }
      });
    }

    resAny[FINISH_REGISTERED] = true;
  } catch (err) {
    // res.on / res.once itself threw — clean up and continue
    logger.warn('Performance middleware finish-listener registration failed', err);
    if (typeof queryHelpers.disablePerformanceTracking === 'function') {
      queryHelpers.disablePerformanceTracking();
    }
    next();
    return;
  }

  try {
    next();
  } catch (err) {
    // next() threw synchronously — release tracking then rethrow
    if (typeof queryHelpers.disablePerformanceTracking === 'function') {
      queryHelpers.disablePerformanceTracking();
    }
    throw err;
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
