/**
 * Performance Metrics Middleware
 * 
 * FAZA 5: Monitoring - Tracks response times, DB query times, and memory usage
 * 
 * Collects performance metrics for all API requests:
 * - Response time
 * - Database query count and total time
 * - Memory usage
 * - Error rates
 */

const logger = require('../utils/logger');

// In-memory metrics store (can be replaced with Redis/DB in production)
const metricsStore = {
    requests: [],
    dbQueries: [],
    errors: []
};

// Keep only last 1000 entries to prevent memory leaks
const MAX_ENTRIES = 1000;

const queryHelpers = require('../utils/queryHelpers');

/**
 * Performance metrics middleware
 * Tracks response time, DB queries, and memory usage
 * 
 * DB query tracking is done via queryHelpers wrapper
 */
function performanceMetricsMiddleware(req, res, next) {
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
    queryHelpers.enablePerformanceTracking((queryType, duration) => {
        req._performanceMetrics.dbQueryCount++;
        req._performanceMetrics.dbQueryTime += duration;
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
        const metric = {
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
    });

    // Disable performance tracking when request finishes
    res.on('finish', () => {
        queryHelpers.disablePerformanceTracking();
    });

    next();
}

/**
 * Get performance metrics summary
 * @param {number} windowMinutes - Time window in minutes (default: 60)
 * @returns {Object} Metrics summary
 */
function getMetricsSummary(windowMinutes = 60) {
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
            slowRequests: 0
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
    }, {});

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
 * @returns {Object} Memory metrics
 */
function getMemoryMetrics() {
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
function clearMetrics() {
    metricsStore.requests = [];
    metricsStore.dbQueries = [];
    metricsStore.errors = [];
}

module.exports = {
    performanceMetricsMiddleware,
    getMetricsSummary,
    getMemoryMetrics,
    clearMetrics,
    metricsStore // Expose for testing
};

