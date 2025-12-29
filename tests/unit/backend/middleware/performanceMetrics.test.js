import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';
import {
    performanceMetricsMiddleware,
    getMetricsSummary,
    metricsStore,
    clearMetrics,
    _setDependencies
} from '../../../../server/middleware/performanceMetrics';

describe('Performance Metrics Middleware', () => {
    let req;
    let res;
    let next;
    let mockLogger;
    let mockQueryHelpers;

    beforeEach(() => {
        vi.clearAllMocks();
        clearMetrics();

        // Create Mocks
        mockLogger = {
            warn: vi.fn(),
            info: vi.fn()
        };

        mockQueryHelpers = {
            enablePerformanceTracking: vi.fn((cb) => {
                // Store callback for manual invocation
                mockQueryHelpers._cb = cb;
            }),
            disablePerformanceTracking: vi.fn(),
            _cb: null
        };

        // Inject Mocks
        _setDependencies({
            logger: mockLogger,
            queryHelpers: mockQueryHelpers
        });

        req = {
            method: 'GET',
            originalUrl: '/api/test',
            user: { id: 'u1', organizationId: 'o1' }
        };

        res = new EventEmitter();
        res.statusCode = 200;
        res.end = vi.fn();

        next = vi.fn();

        vi.spyOn(process, 'memoryUsage').mockReturnValue({
            heapUsed: 1000,
            heapTotal: 2000,
            external: 500,
            rss: 3000
        });

        vi.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('performanceMetricsMiddleware', () => {
        it('should initialize metrics on request', () => {
            performanceMetricsMiddleware(req, res, next);
            expect(req._performanceMetrics).toBeDefined();
            expect(req._performanceMetrics.startTime).toBe(1000);
            expect(mockQueryHelpers.enablePerformanceTracking).toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
        });

        it('should track db queries', () => {
            performanceMetricsMiddleware(req, res, next);

            // Trigger callback
            const cb = mockQueryHelpers._cb;
            expect(cb).toBeDefined();
            cb('SELECT', 50);

            expect(req._performanceMetrics.dbQueryCount).toBe(1);
            expect(req._performanceMetrics.dbQueryTime).toBe(50);
        });

        it('should record metrics on response finish', () => {
            performanceMetricsMiddleware(req, res, next);
            vi.spyOn(Date, 'now').mockReturnValue(1200);
            res.emit('finish');

            expect(metricsStore.requests).toHaveLength(1);
            expect(metricsStore.requests[0].responseTime).toBe(200);
            expect(mockQueryHelpers.disablePerformanceTracking).toHaveBeenCalled();
        });

        it('should log warning for slow requests', () => {
            performanceMetricsMiddleware(req, res, next);
            vi.spyOn(Date, 'now').mockReturnValue(3000);
            res.emit('finish');
            expect(mockLogger.warn).toHaveBeenCalledWith('Performance metric', expect.objectContaining({ isSlow: true }));
        });

        it('should log warning for high db query count', () => {
            performanceMetricsMiddleware(req, res, next);
            const cb = mockQueryHelpers._cb;
            for (let i = 0; i < 11; i++) cb('SELECT', 1);
            res.emit('finish');
            expect(mockLogger.warn).toHaveBeenCalledWith('High DB query count', expect.any(Object));
        });
    });

    describe('getMetricsSummary', () => {
        it('should calculate averages correctly', () => {
            const now = Date.now();
            metricsStore.requests = [
                { timestamp: new Date(now).toISOString(), responseTime: 100, dbQueryCount: 1, dbQueryTime: 10, statusCode: 200, method: 'GET', path: '/api/1' },
                { timestamp: new Date(now).toISOString(), responseTime: 300, dbQueryCount: 3, dbQueryTime: 50, statusCode: 500, method: 'GET', path: '/api/1' }
            ];

            const summary = getMetricsSummary(60);

            expect(summary.totalRequests).toBe(2);
            expect(summary.avgResponseTime).toBe(200);
        });
    });
});
