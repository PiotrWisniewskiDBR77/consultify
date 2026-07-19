/**
 * ODBIÓR — AI Operations REMAINING 7 endpoints RED→GREEN (continuation of W7).
 *
 * W7 fixed 6/13 ai-operations endpoints; these 7 carried the same SQLite-isms
 * and 500'd on parity Postgres (:5443):
 *   - performance/trends
 *   - costs/trends
 *   - costs/by-user
 *   - sla/history
 *   - analytics/usage
 *   - analytics/llm-observatory
 *   - mission-control/alerts/:id/resolve
 *
 * Fix (server/src/routes/ai/ai-operations.routes.ts), 1:1 with the W7 pattern:
 *   - ai_request_log            → ai_usage_logs (the real usage table)
 *   - cost_usd                  → estimated_cost_usd
 *   - datetime('now','-Nx')     → now() - interval 'N x'
 *   - strftime('%Y-%m-%d', …)   → to_char(created_at, 'YYYY-MM-DD') (+ HH24)
 *   - GROUP BY strictness (costs/by-user: user_id, name, email all in GROUP BY)
 *   - llm_health_events.timestamp (text) cast ::timestamptz for range compares
 *   - llm_providers phantom column avg_latency_ms removed from SELECT
 *   - analytics/usage `feature` column → `action` (real column on ai_usage_logs)
 *   - Number() coercion (PG returns bigint/numeric aggregates as strings)
 *   - alerts/resolve: datetime('now') → now(); missing ai_health_alerts relation
 *     degrades to an honest empty-state 200 {degraded:true} instead of 500.
 *
 * Real router + real verifyToken + real parity Postgres. Zero mocks.
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

// GET endpoints: data is an array unless a shapeKey is given (then data is an object).
const GET_ENDPOINTS: Array<{ path: string; shapeKey?: string }> = [
  { path: '/performance/trends' },
  { path: '/costs/trends' },
  { path: '/costs/by-user' },
  { path: '/sla/history' },
  { path: '/analytics/usage', shapeKey: 'byFeature' },
  { path: '/analytics/llm-observatory', shapeKey: 'summary' },
];

describe('ODBIÓR AI Operations — remaining 7 endpoints RED→GREEN (parity PG)', () => {
  for (const ep of GET_ENDPOINTS) {
    it(`GET ${ep.path} → 200 with sensible shape`, async () => {
      const app = await buildAiOpsApp();
      const res = await request(app)
        .get(`/api/ai/operations${ep.path}`)
        .set('Authorization', `Bearer ${token}`);

      // Core assertion: no longer a 500.
      expect(res.status, `${ep.path} body: ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();

      if (ep.shapeKey) {
        expect(
          res.body.data,
          `${ep.path} missing shape key ${ep.shapeKey}`
        ).toHaveProperty(ep.shapeKey);
      } else {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    }, 20_000);
  }

  it('POST /mission-control/alerts/:id/resolve → 200 (honest empty-state when store absent)', async () => {
    const app = await buildAiOpsApp();
    const res = await request(app)
      .post('/api/ai/operations/mission-control/alerts/nonexistent-alert-id/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution: 'acceptance-check' });

    // Core assertion: no longer a 500.
    expect(res.status, `resolve body: ${JSON.stringify(res.body)}`).toBe(200);
    expect(res.body?.success).toBe(true);
  }, 20_000);

  it('analytics/usage honours ?period= and coerces PG string aggregates to numbers', async () => {
    const app = await buildAiOpsApp();
    const res = await request(app)
      .get('/api/ai/operations/analytics/usage?period=quarter')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('quarter');
    for (const row of res.body.data.byModel ?? []) {
      expect(typeof row.requests).toBe('number');
      expect(typeof row.tokens).toBe('number');
    }
    for (const row of res.body.data.byFeature ?? []) {
      expect(typeof row.requests).toBe('number');
    }
  }, 20_000);

  it('llm-observatory summary numbers are coerced (not string bigints)', async () => {
    const app = await buildAiOpsApp();
    const res = await request(app)
      .get('/api/ai/operations/analytics/llm-observatory?period=90d')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const s = res.body.data.summary;
    expect(typeof s.totalRequests).toBe('number');
    expect(typeof s.totalTokens).toBe('number');
    expect(Array.isArray(res.body.data.timeline)).toBe(true);
    expect(Array.isArray(res.body.data.providers)).toBe(true);
  }, 20_000);
});
