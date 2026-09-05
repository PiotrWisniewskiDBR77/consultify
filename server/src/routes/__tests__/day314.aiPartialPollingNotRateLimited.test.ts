/**
 * Day 314 — mounted proof for the generative-quota exemption.
 *
 * The predicate test next door checks the routing decision. This one runs the
 * real `aiRateLimiter` (loaded with NODE_ENV=production so it takes its
 * production budget of 30 requests/minute) behind the exact `router.use`
 * composition ai.routes.ts installs, and drives real HTTP through it:
 *
 *   - 40 consecutive GET /stream/partial/:sessionId  -> never 429
 *   - 31 consecutive POST /chat/stream               -> the 31st is 429
 *
 * Before the fix both counted into the same bucket, so the 31st background poll
 * made the chat answer "AI request failed (RATE_LIMIT_EXCEEDED)".
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { isGenerativeQuotaExemptRead } from '../ai.routes.js';

const originalNodeEnv = process.env.NODE_ENV;

describe('Day 314 — background partial-response polling never spends the AI budget', () => {
  let app: Express;

  beforeAll(async () => {
    // aiRateLimiter reads `isProd` at module load; production is the only tier
    // where the 30/min budget that produced the bug is in force.
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const { aiRateLimiter } = await import('../../middleware/rateLimiting.middleware.js');

    app = express();
    app.use(express.json());
    // Identical composition to ai.routes.ts.
    app.use((req, res, next) => {
      if (isGenerativeQuotaExemptRead(req.method, req.path)) return next();
      return aiRateLimiter(req, res, next);
    });
    app.get('/stream/partial/:sessionId', (_req, res) => {
      res.json({ ok: true });
    });
    app.post('/chat/stream', (_req, res) => {
      res.json({ ok: true });
    });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('serves 40 consecutive partial-response polls without a 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const res = await request(app).get(`/stream/partial/session-${i}`);
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(40);
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('still cuts the generative stream off at the 31st request in the same window', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      const res = await request(app).post('/chat/stream').send({ message: 'hi' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
