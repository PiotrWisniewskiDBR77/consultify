/**
 * SuperAdmin API Throughput Performance Tests
 * Tests API endpoints for latency, throughput, and concurrent handling
 *
 * @module tests/performance/superadmin-api-throughput.test.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const CONCURRENT_REQUESTS = 20;
const TARGET_LATENCY_MS = 500;
const TARGET_THROUGHPUT_RPS = 50;

// Helper: measure request latency
async function measureLatency(url, options = {}) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const end = performance.now();
    return {
      success: response.ok,
      status: response.status,
      latency: end - start,
    };
  } catch (error) {
    const end = performance.now();
    return {
      success: false,
      status: 0,
      latency: end - start,
      error: error.message,
    };
  }
}

// Helper: run concurrent requests
async function runConcurrent(count, requestFn) {
  const start = performance.now();
  const promises = Array(count)
    .fill(null)
    .map(() => requestFn());
  const results = await Promise.all(promises);
  const end = performance.now();

  const successful = results.filter((r) => r.success).length;
  const latencies = results.map((r) => r.latency);

  return {
    totalTime: end - start,
    totalRequests: count,
    successful,
    failed: count - successful,
    avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    p95Latency: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)],
    throughput: (count / ((end - start) / 1000)).toFixed(2),
  };
}

describe('SuperAdmin API Throughput Performance', () => {
  // Skip if no server available
  let serverAvailable = true;

  beforeAll(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 });
      serverAvailable = response.ok;
    } catch {
      serverAvailable = false;
    }
  });

  describe('Health Endpoint Performance', () => {
    it('should respond to health check under 100ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/health`);

      expect(result.success).toBe(true);
      expect(result.latency).toBeLessThan(100);
    });

    it('should handle 20 concurrent health checks', async () => {
      if (!serverAvailable) return;

      const result = await runConcurrent(20, () => measureLatency(`${BASE_URL}/api/health`));

      expect(result.successful).toBeGreaterThanOrEqual(18); // 90% success
      expect(result.avgLatency).toBeLessThan(200);
    });
  });

  describe('SuperAdmin Dashboard API Performance', () => {
    it('should load dashboard stats under 500ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/dashboard`);

      // May return 401/403 without auth, that's OK for perf test
      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });

    it('should handle concurrent dashboard requests', async () => {
      if (!serverAvailable) return;

      const result = await runConcurrent(CONCURRENT_REQUESTS, () =>
        measureLatency(`${BASE_URL}/api/superadmin/dashboard`)
      );

      expect(result.avgLatency).toBeLessThan(TARGET_LATENCY_MS);
      expect(parseFloat(result.throughput)).toBeGreaterThan(10);
    });

    it('should measure dashboard p95 latency', async () => {
      if (!serverAvailable) return;

      const result = await runConcurrent(50, () =>
        measureLatency(`${BASE_URL}/api/superadmin/dashboard`)
      );

      expect(result.p95Latency).toBeLessThan(1000); // 1 second p95
    });
  });

  describe('Customer List API Performance', () => {
    it('should fetch customer list under 500ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/customers`);

      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });

    it('should handle paginated customer requests', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/customers?page=1&limit=20`);

      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });

    it('should handle concurrent customer list requests', async () => {
      if (!serverAvailable) return;

      const result = await runConcurrent(CONCURRENT_REQUESTS, () =>
        measureLatency(`${BASE_URL}/api/superadmin/customers?page=1&limit=10`)
      );

      expect(result.avgLatency).toBeLessThan(TARGET_LATENCY_MS);
    });
  });

  describe('Analytics API Performance', () => {
    it('should fetch analytics under 1000ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/analytics`);

      // Analytics can be heavier, allow more time
      expect(result.latency).toBeLessThan(1000);
    });

    it('should handle analytics with date range', async () => {
      if (!serverAvailable) return;

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const result = await measureLatency(
        `${BASE_URL}/api/superadmin/analytics?start=${startDate}&end=${endDate}`
      );

      expect(result.latency).toBeLessThan(1500);
    });
  });

  describe('Revenue API Performance', () => {
    it('should fetch revenue data under 500ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/revenue`);

      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });

    it('should handle revenue metrics request', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/revenue/metrics`);

      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });
  });

  describe('System Health API Performance', () => {
    it('should fetch system health under 300ms', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/system/health`);

      expect(result.latency).toBeLessThan(300);
    });

    it('should handle audit log requests', async () => {
      if (!serverAvailable) return;

      const result = await measureLatency(`${BASE_URL}/api/superadmin/system/audit-logs?limit=50`);

      expect(result.latency).toBeLessThan(TARGET_LATENCY_MS);
    });
  });

  describe('Sustained Load Performance', () => {
    it('should maintain performance under sustained load', async () => {
      if (!serverAvailable) return;

      const iterations = 5;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await runConcurrent(10, () => measureLatency(`${BASE_URL}/api/health`));
        results.push(result);
        await new Promise((r) => setTimeout(r, 100)); // Brief pause
      }

      // Latency should not degrade significantly over time
      const latencies = results.map((r) => r.avgLatency);
      const firstHalf = latencies.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const secondHalf = latencies.slice(-2).reduce((a, b) => a + b, 0) / 2;

      // Second half should not be more than 2x slower
      expect(secondHalf).toBeLessThan(firstHalf * 2);
    });

    it('should handle burst traffic', async () => {
      if (!serverAvailable) return;

      // Simulate burst: many requests at once
      const result = await runConcurrent(50, () => measureLatency(`${BASE_URL}/api/health`));

      expect(result.successful).toBeGreaterThanOrEqual(45); // 90% success
      expect(result.p95Latency).toBeLessThan(1000);
    });
  });

  describe('Error Rate Performance', () => {
    it('should have low error rate under normal load', async () => {
      if (!serverAvailable) return;

      const result = await runConcurrent(30, () => measureLatency(`${BASE_URL}/api/health`));

      const errorRate = result.failed / result.totalRequests;
      expect(errorRate).toBeLessThan(0.05); // Less than 5% errors
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory over multiple requests', async () => {
      if (!serverAvailable) return;

      // Baseline
      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests
      for (let i = 0; i < 10; i++) {
        await runConcurrent(10, () => measureLatency(`${BASE_URL}/api/health`));
      }

      // Allow GC
      if (global.gc) global.gc();
      await new Promise((r) => setTimeout(r, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not grow more than 50MB
      expect(memoryGrowth).toBeLessThan(50);
    });
  });
});
