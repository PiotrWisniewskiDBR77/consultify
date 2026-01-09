/**
 * Performance Metrics Middleware Test
 * 
 * Tests for performance metrics collection middleware.
 * 
 * @module tests/unit/backend/middleware/performanceMetrics.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create performance metrics middleware
const createPerformanceMetricsMiddleware = (options = {}) => {
    const {
        slowThreshold = 1000, // 1 second
        collectHeaders = true
    } = options;

    const metrics = [];

    return {
        middleware: (req, res, next) => {
            const startTime = Date.now();

            // Capture request info
            req.metricsStartTime = startTime;

            // Override end to capture response time
            const originalEnd = res.end;
            res.end = function (...args) {
                const duration = Date.now() - startTime;

                const metric = {
                    path: req.path,
                    method: req.method,
                    statusCode: res.statusCode,
                    duration,
                    timestamp: new Date().toISOString(),
                    slow: duration > slowThreshold
                };

                if (collectHeaders) {
                    metric.userAgent = req.headers['user-agent'];
                    metric.contentLength = res.get?.('Content-Length');
                }

                metrics.push(metric);

                // Set timing header
                res.set?.('X-Response-Time', `${duration}ms`);

                return originalEnd.apply(this, args);
            };

            return next();
        },

        getMetrics: () => [...metrics],

        getSlowRequests: () => metrics.filter(m => m.slow),

        getAverageResponseTime: () => {
            if (metrics.length === 0) return 0;
            return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
        },

        clear: () => {
            metrics.length = 0;
        }
    };
};

describe('Performance Metrics Middleware', () => {
    let metricsService;
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        metricsService = createPerformanceMetricsMiddleware();
        middleware = metricsService.middleware;
        metricsService.clear();

        mockReq = {
            path: '/api/projects',
            method: 'GET',
            headers: { 'user-agent': 'Test/1.0' }
        };

        mockRes = {
            statusCode: 200,
            end: vi.fn(),
            set: vi.fn(),
            get: vi.fn()
        };

        mockNext = vi.fn();
    });

    describe('Metrics Collection', () => {
        it('should call next and allow request to proceed', () => {
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.metricsStartTime).toBeDefined();
        });

        it('should record metrics when response ends', () => {
            middleware(mockReq, mockRes, mockNext);

            // Simulate response end
            mockRes.end();

            const metrics = metricsService.getMetrics();
            expect(metrics.length).toBe(1);
            expect(metrics[0]).toMatchObject({
                path: '/api/projects',
                method: 'GET',
                statusCode: 200
            });
        });

        it('should capture user agent', () => {
            middleware(mockReq, mockRes, mockNext);
            mockRes.end();

            const metrics = metricsService.getMetrics();
            expect(metrics[0].userAgent).toBe('Test/1.0');
        });
    });

    describe('Slow Request Detection', () => {
        it('should mark slow requests', async () => {
            const slowService = createPerformanceMetricsMiddleware({
                slowThreshold: 10 // 10ms for testing
            });

            slowService.middleware(mockReq, mockRes, mockNext);

            // Simulate delay
            await new Promise(r => setTimeout(r, 20));

            mockRes.end();

            const slowRequests = slowService.getSlowRequests();
            expect(slowRequests.length).toBeGreaterThan(0);
            expect(slowRequests[0].slow).toBe(true);
        });
    });

    describe('Aggregate Metrics', () => {
        it('should calculate average response time', () => {
            middleware(mockReq, mockRes, mockNext);
            mockRes.end();

            middleware(mockReq, mockRes, mockNext);
            mockRes.end();

            const avg = metricsService.getAverageResponseTime();
            expect(avg).toBeGreaterThanOrEqual(0);
        });
    });
});
