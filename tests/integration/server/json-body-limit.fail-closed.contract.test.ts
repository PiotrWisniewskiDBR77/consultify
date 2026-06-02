import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';

function buildBodyLimitApp() {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: '32b' }));
  app.post('/api/_probe', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandlerMiddleware);
  return app;
}

describe('json body limit fail-closed contract', () => {
  it('returns coded 413 without payload echo', async () => {
    const app = buildBodyLimitApp();
    const payload = JSON.stringify({ pad: 'x'.repeat(64) });

    const res = await request(app)
      .post('/api/_probe')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(413);
    expect(res.body?.error?.code).toBe('REQUEST_JSON_TOO_LARGE');
    expect(res.body?.correlationId).toBe(res.headers['x-correlation-id']);
    expect(typeof res.body?.error?.message).toBe('string');
    expect(res.body.error.message.length).toBeLessThan(200);
    expect(JSON.stringify(res.body)).not.toContain('xxxxxxxx');
  });
});

