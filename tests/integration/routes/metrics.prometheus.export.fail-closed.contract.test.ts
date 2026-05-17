import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMetrics = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/services/metricsService.js', () => ({
  getMetricsService: () => ({
    getMetrics: (...args: unknown[]) => mockGetMetrics(...args),
  }),
}));

import apiLoggingMiddleware from '../../../server/src/middleware/apiLogging.middleware.js';
import metricsRoutes from '../../../server/src/routes/metrics.routes.js';

describe('metrics prometheus export fail-closed contract', () => {
  const app = express();
  app.use(apiLoggingMiddleware);
  app.use('/api/metrics', metricsRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetrics.mockResolvedValue('some_prometheus_metric 1\n');
  });

  it('returns coded 503 plain text without leaking exception details', async () => {
    mockGetMetrics.mockRejectedValueOnce(new Error('SECRET_INTERNAL_DETAIL'));

    const res = await request(app)
      .get('/api/metrics')
      .set('X-Correlation-ID', 'metrics-contract-test-1');

    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('code=METRICS_PROMETHEUS_EXPORT_FAILED');
    expect(res.text).toContain('correlation_id=metrics-contract-test-1');
    expect(res.text).not.toContain('SECRET_INTERNAL_DETAIL');
  });
});
