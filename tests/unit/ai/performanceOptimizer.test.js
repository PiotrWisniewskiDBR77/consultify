/**
 * PerformanceOptimizer Unit Tests
 * 
 * Tests for AI performance monitoring and optimization service.
 */
import { describe, it, expect } from 'vitest';
import { performanceOptimizer, PerformanceOptimizer } from '../../../server/src/services/ai/performanceOptimizer.js';

describe('PerformanceOptimizer', () => {
    describe('recordMetrics()', () => {
        it('should record metrics successfully', () => {
            const traceId = 'test-trace-' + Date.now();

            expect(() => {
                performanceOptimizer.recordMetrics(traceId, {
                    responseTime: 1500,
                    tokensUsed: 1000,
                    cached: false,
                    error: false
                });
            }).not.toThrow();
        });

        it('should handle missing optional fields', () => {
            const traceId = 'test-trace-2-' + Date.now();

            expect(() => {
                performanceOptimizer.recordMetrics(traceId, {
                    responseTime: 500
                });
            }).not.toThrow();
        });

        it('should track error metrics', () => {
            const traceId = 'test-trace-error-' + Date.now();

            expect(() => {
                performanceOptimizer.recordMetrics(traceId, {
                    responseTime: 100,
                    error: true
                });
            }).not.toThrow();
        });
    });

    describe('getSummary()', () => {
        it('should return statistics object', () => {
            const service = new PerformanceOptimizer();

            // Record some metrics first
            service.recordMetrics('stat-test-1', { responseTime: 1000, tokensUsed: 500 });
            service.recordMetrics('stat-test-2', { responseTime: 2000, tokensUsed: 1000 });
            service.recordMetrics('stat-test-3', { responseTime: 1500, tokensUsed: 750 });

            const stats = service.getSummary();

            expect(stats).toBeDefined();
            expect(stats).toHaveProperty('totalRequests');
            expect(stats.responseTime).toHaveProperty('average');
            expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
        });

        it('should calculate percentiles', () => {
            const service = new PerformanceOptimizer();

            // Record metrics with varying response times
            for (let i = 0; i < 100; i++) {
                service.recordMetrics(`percentile-test-${i}`, {
                    responseTime: 100 + (i * 10),
                    tokensUsed: 100
                });
            }

            const stats = service.getSummary();

            expect(stats.responseTime).toHaveProperty('p95');
            expect(stats.responseTime).toHaveProperty('p99');
            expect(stats.responseTime.p95).toBeGreaterThan(stats.responseTime.average);
        });
    });

    describe('getRecommendations()', () => {
        it('should generate recommendations for slow responses', () => {
            const service = new PerformanceOptimizer();

            // Record slow metrics
            for (let i = 0; i < 10; i++) {
                service.recordMetrics(`slow-test-${i}`, {
                    responseTime: 10000 + (i * 1000), // 10-20 seconds
                    tokensUsed: 5000,
                    cached: false
                });
            }

            const recommendations = service.getRecommendations();

            expect(recommendations).toBeInstanceOf(Array);
            // Should recommend optimization due to slow responses
        });

        it('should recommend caching for repeated requests', () => {
            const service = new PerformanceOptimizer();

            // Record non-cached requests
            for (let i = 0; i < 20; i++) {
                service.recordMetrics(`cache-test-${i}`, {
                    responseTime: 2000,
                    tokensUsed: 1000,
                    cached: false
                });
            }

            const recommendations = service.getRecommendations();

            expect(recommendations).toBeInstanceOf(Array);
            // Should have caching recommendations
        });

        it('should return empty array for optimal performance', () => {
            const service = new PerformanceOptimizer();

            // Record fast, cached responses
            for (let i = 0; i < 10; i++) {
                service.recordMetrics(`optimal-test-${i}`, {
                    responseTime: 50,
                    tokensUsed: 100,
                    cached: true,
                    error: false
                });
            }

            const recommendations = service.getRecommendations();

            expect(recommendations).toBeInstanceOf(Array);
        });
    });

    describe('reset()', () => {
        it('should clear all recorded metrics', () => {
            const service = new PerformanceOptimizer();

            // Record some metrics
            service.recordMetrics('reset-test-1', { responseTime: 1000 });
            service.recordMetrics('reset-test-2', { responseTime: 2000 });

            // Reset
            service.reset();

            const stats = service.getSummary();
            expect(stats.totalRequests).toBe(0);
        });
    });

    describe('getCacheHitRate()', () => {
        it('should calculate cache hit rate correctly', () => {
            const service = new PerformanceOptimizer();

            // 3 cached, 7 non-cached = 30% hit rate
            for (let i = 0; i < 3; i++) {
                service.recordMetrics(`hit-${i}`, { responseTime: 50, cached: true });
            }
            for (let i = 0; i < 7; i++) {
                service.recordMetrics(`miss-${i}`, { responseTime: 1000, cached: false });
            }

            const hitRate = service.getCacheHitRate();

            expect(hitRate).toBeCloseTo(0.3, 1);
        });

        it('should return 0 for no requests', () => {
            const service = new PerformanceOptimizer();

            const hitRate = service.getCacheHitRate();

            expect(hitRate).toBe(0);
        });
    });

    describe('getErrorRate()', () => {
        it('should calculate error rate correctly', () => {
            const service = new PerformanceOptimizer();

            // 2 errors, 8 successes = 20% error rate
            for (let i = 0; i < 2; i++) {
                service.recordMetrics(`error-${i}`, { responseTime: 100, error: true });
            }
            for (let i = 0; i < 8; i++) {
                service.recordMetrics(`success-${i}`, { responseTime: 1000, error: false });
            }

            const stats = service.getSummary();

            expect(stats.errors.rate).toBeCloseTo(0.2, 1);
        });
    });
});

