import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';

function buildRequestStoreProbe() {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.post('/api/_probe', (req, res) => {
    res.status(200).json({
      ok: true,
      correlationId: (req as any).correlationId,
    });
  });
  return app;
}

describe('requeststore correlation sanitization contract', () => {
  it('sanitizes unsafe inbound correlation id in response header and payload', async () => {
    const app = buildRequestStoreProbe();
    const res = await request(app)
      .post('/api/_probe')
      .set('X-Correlation-ID', 'acme/corp+probe@id')
      .send({ ok: true });

    expect(res.status).toBe(200);
    expect(res.body.correlationId).toBe('acmecorpprobeid');
    expect(res.headers['x-correlation-id']).toBe('acmecorpprobeid');
    expect(res.headers['x-correlation-id']).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    expect(res.headers['x-correlation-id']).not.toContain('+');
    expect(res.headers['x-correlation-id']).not.toContain('/');
    expect(res.headers['x-correlation-id']).not.toContain('@');
  });
});

