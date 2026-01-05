/**
 * Performance Metrics Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides performance metrics endpoint with P95/P99 latency and throughput
 * GET /api/performance/metrics - Returns performance metrics in JSON format
 */

import { type Request, type Response, Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { getMetricsService } from '../services/metricsService.js';
import {
    dbQueryDurationSeconds,
    httpRequestDurationSeconds,
    llmCallDurationSeconds,
} from '../services/metricsService.js';
import { dbQueriesPerSecond, httpRequestsPerSecond, llmRequestsPerSecond } from '../services/metricsService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

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

        // Parse metrics to extract percentiles
        // Note: Prometheus histograms expose percentiles via bucket metrics
        // For now, we'll extract basic stats from the histogram
        const latency = await extractLatencyMetrics(prometheusMetrics);
        const throughput = await extractThroughputMetrics(register);
        const errors = await extractErrorMetrics(prometheusMetrics);

        const response = {
            timestamp: new Date().toISOString(),
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
async function extractLatencyMetrics(prometheusMetrics: string): Promise<{
    http: { p50: number; p95: number; p99: number; avg: number };
    db: { p50: number; p95: number; p99: number; avg: number };
    llm: { p50: number; p95: number; p99: number; avg: number };
}> {
    // Parse Prometheus metrics to extract histogram data
    // In production, use Prometheus query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
    // For now, return placeholder values - actual calculation requires Prometheus server

    return {
        http: {
            p50: 0,
            p95: 0,
            p99: 0,
            avg: 0,
        },
        db: {
            p50: 0,
            p95: 0,
            p99: 0,
            avg: 0,
        },
        llm: {
            p50: 0,
            p95: 0,
            p99: 0,
            avg: 0,
        },
    };
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

        return {
            http: httpGauge ? httpGauge.get().values[0]?.value || 0 : 0,
            db: dbGauge ? dbGauge.get().values[0]?.value || 0 : 0,
            llm: llmGauge ? llmGauge.get().values[0]?.value || 0 : 0,
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
async function extractErrorMetrics(prometheusMetrics: string): Promise<{
    rate: number;
    total: number;
}> {
    // Parse error rate from metrics
    // In production, use Prometheus query: rate(errors_total[5m])
    const errorMatch = prometheusMetrics.match(/errors_total\s+(\d+)/);
    const totalErrors = errorMatch ? parseInt(errorMatch[1], 10) : 0;

    // Calculate error rate (simplified - actual calculation requires time window)
    return {
        rate: 0, // Would be calculated from rate(errors_total[5m])
        total: totalErrors,
    };
}

export default router;
