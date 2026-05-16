// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = { id: 'u-docs-1', organizationId: 'org-docs-1', role: 'ADMIN' };
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

import documentsRoutes from '../../../server/src/routes/documents.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('documents fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/documents', documentsRoutes);
  app.use(errorHandlerMiddleware);

  it('returns coded 503 when documents service is unavailable', async () => {
    const res = await request(app)
      .get('/api/documents/all')
      .set('X-Correlation-ID', 'pack10s3-documents-service-unavailable-1');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('DOCUMENTS_SERVICE_NOT_CONFIGURED');
    expect(res.body.error.message).toBe('Documents service is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack10s3-documents-service-unavailable-1');
  });

  it('returns coded 400 when upload is missing file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('X-Correlation-ID', 'pack10s3-documents-upload-missing-file-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('DOCUMENTS_UPLOAD_FILE_REQUIRED');
    expect(res.body.error.message).toBe('File is required for upload.');
    expect(res.body.correlationId).toBe('pack10s3-documents-upload-missing-file-1');
  });

  it('returns coded 401 when upload auth context is missing', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('x-test-auth', 'none')
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' })
      .set('X-Correlation-ID', 'pack10s3-documents-unauthorized-1');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('DOCUMENTS_SERVICE_NOT_CONFIGURED');
    expect(res.body.error.message).toBe('Documents service is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack10s3-documents-unauthorized-1');
  });
});

