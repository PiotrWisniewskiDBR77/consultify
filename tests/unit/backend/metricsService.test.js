/**
 * Metrics Service Unit Tests
 * Tests metrics collection, aggregation, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory metrics service for testing
const createMetricsService = () => {
  const metrics = new Map();
  const timers = new Map();

  return {
    // Counter metrics
    increment: (name, value = 1, tags = {}) => {
      const key = JSON.stringify({ name, tags });
      const current = metrics.get(key) || { type: 'counter', value: 0, tags };
      current.value += value;
      current.timestamp = Date.now();
      metrics.set(key, current);
    },

    // Gauge metrics
    gauge: (name, value, tags = {}) => {
      const key = JSON.stringify({ name, tags });
      metrics.set(key, { type: 'gauge', name, value, tags, timestamp: Date.now() });
    },

    // Histogram metrics
    histogram: (name, value, tags = {}) => {
      const key = JSON.stringify({ name, tags });
      const current = metrics.get(key) || { type: 'histogram', name, values: [], tags };
      current.values.push(value);
      current.timestamp = Date.now();
      metrics.set(key, current);
    },

    // Timer
    startTimer: (name) => {
      const id = `${name}-${Date.now()}-${Math.random()}`;
      timers.set(id, { name, start: Date.now() });
      return {
        end: () => {
          const timer = timers.get(id);
          if (timer) {
            const duration = Date.now() - timer.start;
            timers.delete(id);
            return duration;
          }
          return 0;
        },
      };
    },

    // Get metric value
    get: (name, tags = {}) => {
      const key = JSON.stringify({ name, tags });
      return metrics.get(key) || null;
    },

    // Get all metrics
    getAll: () => {
      const result = [];
      for (const [key, value] of metrics.entries()) {
        result.push({ ...value, key });
      }
      return result;
    },

    // Aggregations
    aggregate: (name, tags = {}) => {
      const metric = metrics.get(JSON.stringify({ name, tags }));
      if (!metric || metric.type !== 'histogram') return null;

      const values = metric.values;
      if (values.length === 0) return null;

      const sorted = [...values].sort((a, b) => a - b);
      return {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    },

    // Reset metrics
    reset: () => {
      metrics.clear();
      timers.clear();
    },

    // Export for monitoring systems
    export: (format = 'json') => {
      if (format === 'json') {
        return JSON.stringify(Array.from(metrics.entries()));
      }
      // Prometheus format
      if (format === 'prometheus') {
        let output = '';
        for (const [key, metric] of metrics.entries()) {
          const labels = Object.entries(metric.tags || {})
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          output += `${metric.name}{${labels}} ${metric.value || 0}\n`;
        }
        return output;
      }
      return null;
    },
  };
};

describe('MetricsService', () => {
  let metricsService;

  beforeEach(() => {
    metricsService = createMetricsService();
  });

  describe('Counter Metrics', () => {
    it('should increment counter', () => {
      metricsService.increment('requests_total');
      metricsService.increment('requests_total');
      metricsService.increment('requests_total');

      const metric = metricsService.get('requests_total');
      expect(metric.value).toBe(3);
    });

    it('should increment by custom value', () => {
      metricsService.increment('bytes_transferred', 1024);

      const metric = metricsService.get('bytes_transferred');
      expect(metric.value).toBe(1024);
    });

    it('should support tags', () => {
      metricsService.increment('requests_total', 1, { method: 'GET' });
      metricsService.increment('requests_total', 1, { method: 'POST' });

      const getMetric = metricsService.get('requests_total', { method: 'GET' });
      const postMetric = metricsService.get('requests_total', { method: 'POST' });

      expect(getMetric.value).toBe(1);
      expect(postMetric.value).toBe(1);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set gauge value', () => {
      metricsService.gauge('memory_usage', 512);

      const metric = metricsService.get('memory_usage');
      expect(metric.value).toBe(512);
    });

    it('should overwrite gauge value', () => {
      metricsService.gauge('active_connections', 10);
      metricsService.gauge('active_connections', 5);

      const metric = metricsService.get('active_connections');
      expect(metric.value).toBe(5);
    });
  });

  describe('Histogram Metrics', () => {
    it('should track histogram values', () => {
      metricsService.histogram('response_time', 100);
      metricsService.histogram('response_time', 150);
      metricsService.histogram('response_time', 200);

      const metric = metricsService.get('response_time');
      expect(metric.values).toHaveLength(3);
    });
  });

  describe('Timer', () => {
    it('should measure duration', async () => {
      const timer = metricsService.startTimer('operation');
      await new Promise((resolve) => setTimeout(resolve, 50));
      const duration = timer.end();

      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Aggregations', () => {
    it('should calculate aggregations', () => {
      [10, 20, 30, 40, 50].forEach((v) => {
        metricsService.histogram('latency', v);
      });

      const agg = metricsService.aggregate('latency');

      expect(agg.count).toBe(5);
      expect(agg.sum).toBe(150);
      expect(agg.avg).toBe(30);
      expect(agg.min).toBe(10);
      expect(agg.max).toBe(50);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        metricsService.histogram('values', i);
      }

      const agg = metricsService.aggregate('values');

      expect(agg.p50).toBeGreaterThanOrEqual(50);
      expect(agg.p95).toBeGreaterThanOrEqual(95);
      expect(agg.p99).toBeGreaterThanOrEqual(99);
    });
  });

  describe('Export', () => {
    it('should export as JSON', () => {
      metricsService.increment('test_metric', 5);

      const exported = metricsService.export('json');
      expect(exported).toContain('test_metric');
    });
  });

  describe('Reset', () => {
    it('should clear all metrics', () => {
      metricsService.increment('metric_a');
      metricsService.gauge('metric_b', 10);

      metricsService.reset();

      expect(metricsService.getAll()).toHaveLength(0);
    });
  });
});
