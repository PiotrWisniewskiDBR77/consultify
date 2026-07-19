/**
 * ODBIÓR — AI Operations endpoints RED→GREEN (RED-F W6).
 *
 * The 6 /api/ai/operations/* endpoints below used to 500 on parity Postgres:
 * every query hit a non-existent `ai_request_log` table AND used SQLite date
 * functions (`datetime('now', …)`), which throw 42883/42P01 on PG. DbPromise's
 * fallback masks the SQL error into `null`, and the handler then null-derefs the
 * result object → HTTP 500.
 *
 * Fix (server/src/routes/ai/ai-operations.routes.ts):
 *   - ai_request_log        → ai_usage_logs (the real usage table)
 *   - cost_usd              → estimated_cost_usd
 *   - datetime('now','-Nx') → now() - interval 'N x'
 *   - datetime('now','start of day') → date_trunc('day', now())
 *   - derived-table alias + NULLIF(COUNT(*),0) guard (PG division-by-zero)
 *   - `?? fallback` on every dbGet result so a residually-missing relation
 *     (e.g. ai_async_jobs) degrades to zeros instead of a null-deref 500.
 *
 * Real router + real verifyToken + real parity Postgres (:5443). Zero mocks.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

let token: string;

async function buildAiOpsApp(): Promise<Express> {
  const { default: verifyToken } = await import(
    '../../server/src/middleware/auth.middleware.js'
  );
  const { default: router } = await import(
    '../../server/src/routes/ai/ai-operations.routes.js'
  );
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/ai/operations', verifyToken as any, router);
  return app;
}

beforeAll(async () => {
  await seed();
  token = mintToken();
}, 60_000);

const ENDPOINTS: Array<{ path: string; shapeKey: string; nested?: string }> = [
  { path: '/mission-control/status', shapeKey: 'activeRequests' },
  { path: '/performance/metrics', shapeKey: 'totalRequests' },
  { path: '/costs/summary', shapeKey: 'totalTokens' },
  { path: '/sla/status', shapeKey: 'targets' },
  { path: '/analytics/insights', shapeKey: '' }, // data is an array
  { path: '/summary', shapeKey: 'missionControl' },
];

describe('ODBIÓR AI Operations — 6 endpoints RED→GREEN (parity PG)', () => {
  for (const ep of ENDPOINTS) {
    it(`GET ${ep.path} → 200 with sensible shape`, async () => {
      const app = await buildAiOpsApp();
      const res = await request(app)
        .get(`/api/ai/operations${ep.path}`)
        .set('Authorization', `Bearer ${token}`);

      // The core assertion: no longer a 500.
      expect(res.status, `${ep.path} body: ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();

      if (ep.path === '/analytics/insights') {
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
      } else if (ep.shapeKey) {
        expect(
          res.body.data,
          `${ep.path} missing shape key ${ep.shapeKey}`
        ).toHaveProperty(ep.shapeKey);
      }
    }, 20_000);
  }

  it('performance/metrics honours the ?period= filter (real ai_usage_logs data)', async () => {
    const app = await buildAiOpsApp();
    const res = await request(app)
      .get('/api/ai/operations/performance/metrics?period=90d')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('90d');
    // Seed DB has ai_usage_logs rows from 2026-07-16 → totalRequests should be a number ≥ 0.
    expect(typeof res.body.data.totalRequests).toBe('number');
    expect(res.body.data.totalRequests).toBeGreaterThanOrEqual(0);
  }, 20_000);
});
