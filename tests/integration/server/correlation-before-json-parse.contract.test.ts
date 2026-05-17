import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

function buildJsonProbeApp() {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.post('/api/_probe', (req, res) => {
    res.status(200).json({
      ok: true,
      correlationId: (req as any).correlationId,
    });
  });
  app.use(errorHandlerMiddleware);
  return app;
}

describe('correlation before json parser contract', () => {
  it('returns coded 400 with correlation header for malformed json', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const app = buildJsonProbeApp();
      const res = await request(app)
        .post('/api/_probe')
        .set('Content-Type', 'application/json')
        .send('{ not json');

      expect(res.status).toBe(400);
      expect(res.headers['x-correlation-id']).toMatch(/^[a-zA-Z0-9._-]{1,128}$/);
      expect(res.body?.error?.code).toBe('REQUEST_JSON_INVALID');
      expect(res.body?.correlationId).toBe(res.headers['x-correlation-id']);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/position|column|line/i);
      expect(body).not.toMatch(/not json/i);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('preserves safe caller correlation id for valid json', async () => {
    const app = buildJsonProbeApp();
    const res = await request(app)
      .post('/api/_probe')
      .set('X-Correlation-ID', 'pack08s3-corr-ok-1')
      .send({ ok: true });

    expect(res.status).toBe(200);
    expect(res.body.correlationId).toBe('pack08s3-corr-ok-1');
    expect(res.headers['x-correlation-id']).toBe('pack08s3-corr-ok-1');
  });
});

