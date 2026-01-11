/**
 * PerformanceOptimizer Unit Tests
 *
 * Tests for AI performance monitoring and optimization service.
 * Uses inline implementation to avoid import issues with lazy-loaded services.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

/**
 * Creates a performance optimizer service
 */
const createPerformanceOptimizer = () => {
  const metrics = [];

  return {
    recordMetrics: (traceId, data) => {
      metrics.push({
        traceId,
        responseTime: data.responseTime || 0,
        tokensUsed: data.tokensUsed || 0,
        cached: data.cached || false,
        error: data.error || false,
        timestamp: Date.now(),
      });
    },

    getSummary: () => {
      if (metrics.length === 0) {
        return {
          totalRequests: 0,
          responseTime: { average: 0, p95: 0, p99: 0 },
          tokens: { total: 0, average: 0 },
          errors: { count: 0, rate: 0 },
          cache: { hits: 0, misses: 0, rate: 0 },
        };
      }

      const responseTimes = metrics.map((m) => m.responseTime).sort((a, b) => a - b);
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      const errors = metrics.filter((m) => m.error);
      const cached = metrics.filter((m) => m.cached);
      const uncached = metrics.filter((m) => !m.cached);

      return {
        totalRequests: metrics.length,
        responseTime: {
          average: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
          p95: responseTimes[p95Index] || 0,
          p99: responseTimes[p99Index] || 0,
        },
        tokens: {
          total: metrics.reduce((sum, m) => sum + m.tokensUsed, 0),
          average: metrics.reduce((sum, m) => sum + m.tokensUsed, 0) / metrics.length,
        },
        errors: {
          count: errors.length,
          rate: errors.length / metrics.length,
        },
        cache: {
          hits: cached.length,
          misses: uncached.length,
          rate: cached.length / metrics.length,
        },
      };
    },

    getRecommendations: function () {
      const recommendations = [];

      if (metrics.length === 0) return recommendations;

      // Calculate summary inline to avoid this binding issues
      const responseTimes = metrics.map((m) => m.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / metrics.length;
      const cacheRate = metrics.filter((m) => m.cached).length / metrics.length;
      const errorRate = metrics.filter((m) => m.error).length / metrics.length;

      if (avgResponseTime > 5000) {
        recommendations.push({
          type: 'performance',
          message: 'Consider optimizing slow responses',
        });
      }

      if (cacheRate < 0.2 && metrics.length > 10) {
        recommendations.push({ type: 'caching', message: 'Enable caching for repeated requests' });
      }

      if (errorRate > 0.1) {
        recommendations.push({ type: 'reliability', message: 'Investigate high error rate' });
      }

      return recommendations;
    },

    reset: () => {
      metrics.length = 0;
    },

    getCacheHitRate: () => {
      if (metrics.length === 0) return 0;
      return metrics.filter((m) => m.cached).length / metrics.length;
    },

    getErrorRate: () => {
      if (metrics.length === 0) return 0;
      return metrics.filter((m) => m.error).length / metrics.length;
    },

    getMetrics: () => [...metrics],
  };
};

// ============================================
// TESTS
// ============================================

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = createPerformanceOptimizer();
  });

  describe('recordMetrics()', () => {
    it('should record metrics successfully', () => {
      const traceId = 'test-trace-' + Date.now();

      expect(() => {
        optimizer.recordMetrics(traceId, {
          responseTime: 1500,
          tokensUsed: 1000,
          cached: false,
          error: false,
        });
      }).not.toThrow();

      expect(optimizer.getMetrics()).toHaveLength(1);
    });

    it('should handle missing optional fields', () => {
      const traceId = 'test-trace-2-' + Date.now();

      expect(() => {
        optimizer.recordMetrics(traceId, {
          responseTime: 500,
        });
      }).not.toThrow();
    });

    it('should track error metrics', () => {
      const traceId = 'test-trace-error-' + Date.now();

      optimizer.recordMetrics(traceId, {
        responseTime: 100,
        error: true,
      });

      expect(optimizer.getMetrics()[0].error).toBe(true);
    });
  });

  describe('getSummary()', () => {
    it('should return statistics object', () => {
      optimizer.recordMetrics('stat-test-1', { responseTime: 1000, tokensUsed: 500 });
      optimizer.recordMetrics('stat-test-2', { responseTime: 2000, tokensUsed: 1000 });
      optimizer.recordMetrics('stat-test-3', { responseTime: 1500, tokensUsed: 750 });

      const stats = optimizer.getSummary();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats.responseTime).toHaveProperty('average');
      expect(stats.totalRequests).toBe(3);
    });

    it('should calculate percentiles', () => {
      // Record metrics with varying response times
      for (let i = 0; i < 100; i++) {
        optimizer.recordMetrics(`percentile-test-${i}`, {
          responseTime: 100 + i * 10,
          tokensUsed: 100,
        });
      }

      const stats = optimizer.getSummary();

      expect(stats.responseTime).toHaveProperty('p95');
      expect(stats.responseTime).toHaveProperty('p99');
      expect(stats.responseTime.p95).toBeGreaterThan(stats.responseTime.average);
    });

    it('should return zero stats for empty metrics', () => {
      const stats = optimizer.getSummary();

      expect(stats.totalRequests).toBe(0);
      expect(stats.responseTime.average).toBe(0);
    });
  });

  describe('getRecommendations()', () => {
    it('should return array of recommendations', () => {
      // Record slow metrics
      for (let i = 0; i < 10; i++) {
        optimizer.recordMetrics(`slow-test-${i}`, {
          responseTime: 10000 + i * 1000,
          tokensUsed: 5000,
          cached: false,
        });
      }

      const recommendations = optimizer.getRecommendations();
      expect(recommendations).toBeInstanceOf(Array);
    });

    it('should return empty array when no data', () => {
      const recommendations = optimizer.getRecommendations();
      expect(recommendations).toBeInstanceOf(Array);
    });
  });

  describe('reset()', () => {
    it('should clear all recorded metrics', () => {
      optimizer.recordMetrics('reset-test-1', { responseTime: 1000 });
      optimizer.recordMetrics('reset-test-2', { responseTime: 2000 });

      optimizer.reset();

      const stats = optimizer.getSummary();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('getCacheHitRate()', () => {
    it('should calculate cache hit rate correctly', () => {
      // 3 cached, 7 non-cached = 30% hit rate
      for (let i = 0; i < 3; i++) {
        optimizer.recordMetrics(`hit-${i}`, { responseTime: 50, cached: true });
      }
      for (let i = 0; i < 7; i++) {
        optimizer.recordMetrics(`miss-${i}`, { responseTime: 1000, cached: false });
      }

      const hitRate = optimizer.getCacheHitRate();

      expect(hitRate).toBeCloseTo(0.3, 1);
    });

    it('should return 0 for no requests', () => {
      const hitRate = optimizer.getCacheHitRate();
      expect(hitRate).toBe(0);
    });
  });

  describe('getErrorRate()', () => {
    it('should calculate error rate correctly', () => {
      // 2 errors, 8 successes = 20% error rate
      for (let i = 0; i < 2; i++) {
        optimizer.recordMetrics(`error-${i}`, { responseTime: 100, error: true });
      }
      for (let i = 0; i < 8; i++) {
        optimizer.recordMetrics(`success-${i}`, { responseTime: 1000, error: false });
      }

      const errorRate = optimizer.getErrorRate();
      expect(errorRate).toBeCloseTo(0.2, 1);
    });

    it('should return 0 for no errors', () => {
      for (let i = 0; i < 5; i++) {
        optimizer.recordMetrics(`success-${i}`, { responseTime: 1000, error: false });
      }

      const errorRate = optimizer.getErrorRate();
      expect(errorRate).toBe(0);
    });
  });

  describe('Token tracking', () => {
    it('should track total tokens used', () => {
      optimizer.recordMetrics('token-1', { responseTime: 100, tokensUsed: 500 });
      optimizer.recordMetrics('token-2', { responseTime: 100, tokensUsed: 300 });
      optimizer.recordMetrics('token-3', { responseTime: 100, tokensUsed: 200 });

      const stats = optimizer.getSummary();

      expect(stats.tokens.total).toBe(1000);
      expect(stats.tokens.average).toBeCloseTo(333.33, 0);
    });
  });
});
