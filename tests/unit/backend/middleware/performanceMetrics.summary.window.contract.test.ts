import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearMetrics,
  getMetricsSummary,
  metricsStore,
} from '../../../../server/src/middleware/performanceMetrics.middleware.ts';

describe('performanceMetrics summary window contract', () => {
  beforeEach(() => {
    clearMetrics();
  });

  it('filters out-of-window samples and computes aggregates from recent rows only', () => {
    const now = Date.now();
    metricsStore.requests.push(
      {
        timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
        method: 'GET',
        path: '/api/old',
        statusCode: 200,
        responseTime: 9999,
        dbQueryCount: 99,
        dbQueryTime: 999,
        memoryDelta: { heapUsed: 0, external: 0, rss: 0 },
        userId: null,
        organizationId: null,
      },
      {
        timestamp: new Date(now).toISOString(),
        method: 'GET',
        path: '/api/new',
        statusCode: 500,
        responseTime: 40,
        dbQueryCount: 2,
        dbQueryTime: 20,
        memoryDelta: { heapUsed: 0, external: 0, rss: 0 },
        userId: null,
        organizationId: null,
      }
    );

    const summary = getMetricsSummary(1);
    expect(summary.totalRequests).toBe(1);
    expect(summary.avgResponseTime).toBe(40);
    expect(summary.avgDbQueryCount).toBe(2);
    expect(summary.avgDbQueryTime).toBe(20);
    expect(summary.errorRate).toBe(100);
  });

  it('returns zeroed summary when no requests are in requested window', () => {
    metricsStore.requests.push({
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      method: 'GET',
      path: '/api/old',
      statusCode: 200,
      responseTime: 25,
      dbQueryCount: 1,
      dbQueryTime: 5,
      memoryDelta: { heapUsed: 0, external: 0, rss: 0 },
      userId: null,
      organizationId: null,
    });

    const summary = getMetricsSummary(1);
    expect(summary).toEqual(
      expect.objectContaining({
        totalRequests: 0,
        avgResponseTime: 0,
        slowRequests: 0,
        slowestEndpoints: [],
        errorEndpoints: [],
      })
    );
  });
});

