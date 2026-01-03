/**
 * Performance Metrics Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Full TypeScript migration of performanceMetrics.js
 * Tracks response times, DB query times, and memory usage
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

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
    errors: []
};

const MAX_ENTRIES = 1000;

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
    req._performanceMetrics = {
        startTime,
        startMemory,
        dbQueryCount: 0,
        dbQueryTime: 0
    };

    // Enable performance tracking for this request
    queryHelpers.enablePerformanceTracking((queryType: string, duration: number) => {
        if (req._performanceMetrics) {
            req._performanceMetrics.dbQueryCount++;
            req._performanceMetrics.dbQueryTime += duration;
        }
    });

    // Track response finish
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const endMemory = process.memoryUsage();
        const memoryDelta = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
            rss: endMemory.rss - startMemory.rss
        };

        const metrics = req._performanceMetrics || {};
        const metric: Metric = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl || req.path,
            statusCode: res.statusCode,
            responseTime,
            dbQueryCount: metrics.dbQueryCount || 0,
            dbQueryTime: metrics.dbQueryTime || 0,
            memoryDelta,
            userId: req.user?.id || null,
            organizationId: req.user?.organizationId || null
        };

        // Store metric
        metricsStore.requests.push(metric);
        if (metricsStore.requests.length > MAX_ENTRIES) {
            metricsStore.requests.shift();
        }

        // Log slow requests (>1s) or errors
        if (responseTime > 1000 || res.statusCode >= 400) {
            logger.warn('Performance metric', {
                ...metric,
                isSlow: responseTime > 1000,
                isError: res.statusCode >= 400
            });
        }

        // Log high DB query count (>10 queries)
        if (metrics.dbQueryCount > 10) {
            logger.warn('High DB query count', {
                path: req.originalUrl || req.path,
                dbQueryCount: metrics.dbQueryCount,
                dbQueryTime: metrics.dbQueryTime
            });
        }

        // Disable performance tracking when request finishes
        queryHelpers.disablePerformanceTracking();
    });

    next();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get performance metrics summary
 */
export function getMetricsSummary(windowMinutes: number = 60): MetricsSummary {
    const cutoff = Date.now() - (windowMinutes * 60 * 1000);
    const recentRequests = metricsStore.requests.filter(
        m => new Date(m.timestamp).getTime() > cutoff
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
            windowMinutes
        };
    }

    const totalRequests = recentRequests.length;
    const avgResponseTime = recentRequests.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const avgDbQueryCount = recentRequests.reduce((sum, m) => sum + m.dbQueryCount, 0) / totalRequests;
    const avgDbQueryTime = recentRequests.reduce((sum, m) => sum + m.dbQueryTime, 0) / totalRequests;
    const errorCount = recentRequests.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    const slowRequests = recentRequests.filter(m => m.responseTime > 1000).length;

    // Group by endpoint
    const byEndpoint = recentRequests.reduce((acc, m) => {
        const key = `${m.method} ${m.path}`;
        if (!acc[key]) {
            acc[key] = {
                method: m.method,
                path: m.path,
                count: 0,
                totalTime: 0,
                avgTime: 0,
                errorCount: 0
            };
        }
        acc[key].count++;
        acc[key].totalTime += m.responseTime;
        acc[key].errorCount += m.statusCode >= 400 ? 1 : 0;
        acc[key].avgTime = acc[key].totalTime / acc[key].count;
        return acc;
    }, {} as Record<string, EndpointMetrics>);

    // Get top slowest endpoints
    const slowestEndpoints = Object.values(byEndpoint)
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 10);

    // Get endpoints with most errors
    const errorEndpoints = Object.values(byEndpoint)
        .filter(e => e.errorCount > 0)
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
        windowMinutes
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
        timestamp: new Date().toISOString()
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

