import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();

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

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

import metricsRoutes from '../../../server/src/routes/metrics.routes.js';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('metrics warnings fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use('/api/metrics', metricsRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbAllMock.mockResolvedValue([]);
  });

  it('returns 200 and sanitizes malformed metrics payload to empty object', async () => {
    dbAllMock.mockResolvedValueOnce([
      {
        id: 'warn-1',
        organization_id: 'org-1',
        organizationName: 'Org Name',
        type: 'churn_risk',
        severity: 'HIGH',
        message: 'Potential churn',
        metrics: '{bad-json',
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app).get('/api/metrics/warnings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings[0].metrics).toEqual({});
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain('SyntaxError');
    expect(payload).not.toContain('Unexpected token');
    expect(payload).not.toContain('{bad-json');
  });

  it('returns coded non-leaking 500 envelope when warnings read fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbAllMock.mockResolvedValueOnce([
      {
        id: 'warn-2',
        organization_id: 'org-2',
        organizationName: 'Org 2',
        type: 'churn_risk',
        severity: 'HIGH',
        message: 'Potential churn',
        metrics: {},
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
        get metricsTouched() {
          throw new Error('METRICS_WARNINGS_FORCED_THROW');
        },
      },
    ]);

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get('/api/metrics/warnings')
        .set('X-Correlation-ID', 'pack09s2-metrics-warnings-fail-1');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('METRICS_WARNINGS_READ_FAILED');
      expect(res.body.error.message).toBe('Failed to read metrics warnings.');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(res.body.correlationId).toBe('pack09s2-metrics-warnings-fail-1');
      expect(JSON.stringify(res.body)).not.toContain('METRICS_WARNINGS_FORCED_THROW');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});

