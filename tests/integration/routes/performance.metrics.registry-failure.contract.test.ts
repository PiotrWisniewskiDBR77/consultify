import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRegistryMetrics = vi.fn();

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/services/metricsService.js', async () => {
  const actual = (await vi.importActual('../../../server/src/services/metricsService.js')) as any;
  return {
    ...actual,
    getMetricsService: () => ({
      getRegistry: () => ({
        metrics: (...args: unknown[]) => mockGetRegistryMetrics(...args),
        getSingleMetric: vi.fn(),
      }),
    }),
  };
});

import apiLoggingMiddleware from '../../../server/src/middleware/apiLogging.middleware.js';
import performanceRoutes from '../../../server/src/routes/performance.routes.ts';

describe('performance metrics registry failure contract', () => {
  const app = express();
  app.use(apiLoggingMiddleware);
  app.use('/api/performance', performanceRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegistryMetrics.mockResolvedValue('metric_ok 1\n');
  });

  it('returns 500 contract without leaking internal registry error details', async () => {
    mockGetRegistryMetrics.mockRejectedValueOnce(new Error('PACK08S5_SYNTHETIC_METRICS_FAILURE'));

    const res = await request(app)
      .get('/api/performance/metrics')
      .set('X-Correlation-ID', 'pack08s5-perf-metrics-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to generate performance metrics');
    expect(res.body.correlationId).toBe('pack08s5-perf-metrics-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('PACK08S5_SYNTHETIC_METRICS_FAILURE');
  });
});

