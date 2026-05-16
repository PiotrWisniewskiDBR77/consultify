import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { sendApiGatewayRateLimitedResponse } from '../../../server/src/utils/apiContractResponses.js';

function buildRateLimitedApp() {
  const app = express();
  app.use(correlationMiddleware);
  app.use(
    '/api/',
    rateLimit({
      windowMs: 60_000,
      limit: 1,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => false,
      handler: (req, res) => sendApiGatewayRateLimitedResponse(req, res),
    })
  );
  app.get('/api/_pack08_rl_probe', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('api gateway rate limit fail-closed contract', () => {
  it('returns coded 429 contract with correlation and rate-limit headers', async () => {
    const app = buildRateLimitedApp();
    const res1 = await request(app)
      .get('/api/_pack08_rl_probe')
      .set('X-Correlation-ID', 'pack08s4-corr-rl-1');
    const res2 = await request(app)
      .get('/api/_pack08_rl_probe')
      .set('X-Correlation-ID', 'pack08s4-corr-rl-1');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(429);
    expect(res2.body.status).toBe('fail');
    expect(res2.body.error.code).toBe('API_RATE_LIMIT_EXCEEDED');
    expect(res2.body.error.message).toBe('Too many requests. Please retry later.');
    expect(Number.isNaN(Date.parse(res2.body.error.timestamp))).toBe(false);
    expect(res2.body.correlationId).toBe('pack08s4-corr-rl-1');
    expect(res2.headers['x-correlation-id']).toBe('pack08s4-corr-rl-1');
    expect(res2.headers['ratelimit-remaining']).toBeDefined();
    expect(JSON.stringify(res2.body)).not.toMatch(/redis|ioredis|key/i);
  });
});

