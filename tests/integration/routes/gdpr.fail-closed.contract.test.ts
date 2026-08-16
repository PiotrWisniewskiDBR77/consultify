import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-gdpr-1', organizationId: 'org-gdpr-1' };
    req.organizationId = 'org-gdpr-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGetMock(...args),
  all: vi.fn(async () => []),
  run: (...args: unknown[]) => dbRunMock(...args),
}));

import gdprRoutes from '../../../server/src/routes/gdpr.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('gdpr fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/gdpr', gdprRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(null);
    dbRunMock.mockResolvedValue({ success: true, changes: 1 });
  });

  it('returns coded 400 for missing consents payload with correlation parity', async () => {
    const res = await request(app)
      .put('/api/gdpr/consents')
      .send({})
      .set('X-Correlation-ID', 'pack10s1-gdpr-consents-required');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('GDPR_CONSENTS_PAYLOAD_REQUIRED');
    expect(res.body.error.message).toBe('Consents payload is required.');
    expect(res.body.correlationId).toBe('pack10s1-gdpr-consents-required');
  });

  it('returns coded 400 for invalid retention period with correlation parity', async () => {
    const res = await request(app)
      .put('/api/gdpr/retention')
      .send({ retention: { period: '15', autoDelete: false } })
      .set('X-Correlation-ID', 'pack10s1-gdpr-retention-invalid');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('GDPR_RETENTION_PERIOD_INVALID');
    expect(res.body.error.message).toBe('Retention period is invalid.');
    expect(res.body.correlationId).toBe('pack10s1-gdpr-retention-invalid');
  });

  it('returns coded non-leaking 500 for consents update failure', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbRunMock.mockRejectedValueOnce(new Error('SECRET_INTERNAL_GDPR_CONSENTS_WRITE_FAILURE'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .put('/api/gdpr/consents')
        .send({
          consents: {
            analytics: true,
            personalization: true,
            marketing: false,
            thirdPartySharing: false,
            aiTraining: true,
          },
        })
        .set('X-Correlation-ID', 'pack10s1-gdpr-consents-write-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('GDPR_CONSENTS_UPDATE_FAILED');
      expect(res.body.error.message).toBe('Failed to update consents.');
      expect(res.body.correlationId).toBe('pack10s1-gdpr-consents-write-fail');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_GDPR_CONSENTS_WRITE_FAILURE');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded 400 when export request already exists', async () => {
    dbGetMock.mockResolvedValueOnce({ id: 'existing-export-id' });

    const res = await request(app)
      .post('/api/gdpr/export-request')
      .set('X-Correlation-ID', 'pack10s1-gdpr-export-existing');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('GDPR_EXPORT_REQUEST_ALREADY_IN_PROGRESS');
    expect(res.body.error.message).toBe('An export request is already in progress.');
    expect(res.body.correlationId).toBe('pack10s1-gdpr-export-existing');
  });

  it('returns coded 404 for missing export download request', async () => {
    dbGetMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/gdpr/download-export/missing-request')
      .set('X-Correlation-ID', 'pack10s1-gdpr-download-missing');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('GDPR_EXPORT_NOT_READY');
    expect(res.body.error.message).toBe('Export was not found or is not ready.');
    expect(res.body.correlationId).toBe('pack10s1-gdpr-download-missing');
  });
});
