import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

function buildMultipartProbe() {
  const app = express();
  app.use(correlationMiddleware);
  app.post('/api/_pack09_multer_probe', (_req, _res, next) => {
    const err = new Error('multipart file exceeds size limit');
    (err as Error & { name: string; code: string }).name = 'MulterError';
    (err as Error & { name: string; code: string }).code = 'LIMIT_FILE_SIZE';
    next(err);
  });
  app.use(errorHandlerMiddleware);
  return app;
}

describe('multipart multer fail-closed contract', () => {
  it('returns coded 413 envelope for oversized multipart file without internal leak', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const app = buildMultipartProbe();
    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/_pack09_multer_probe')
        .set('X-Correlation-ID', 'pack09s1-multipart-1');

      expect(res.status).toBe(413);
      expect(res.body.status).toBe('fail');
      expect(res.body.error.code).toBe('REQUEST_MULTIPART_FILE_TOO_LARGE');
      expect(res.body.error.message).toBe('Uploaded file exceeds the allowed size.');
      expect(res.body.correlationId).toBe('pack09s1-multipart-1');
      expect(res.headers['x-correlation-id']).toBe('pack09s1-multipart-1');
      const payload = JSON.stringify(res.body);
      expect(payload).not.toContain('MulterError');
      expect(payload).not.toContain('LIMIT_FILE_SIZE');
      expect(payload).not.toContain('oversized.txt');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});

