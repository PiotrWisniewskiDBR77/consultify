/**
 * ODBIOR — /api/agents metadata (RED-F W6, 2026-07-19).
 *
 * RED: GET /api/agents crashed with a synchronous
 *   "_AIAgents.getAllAgentMetadata is not a function" (aiOrchestrator.ts:~906).
 * Root cause: server/src/services/ai/agents/index.ts had been collapsed into a
 * self-import lazy wrapper (`export default loadIndex()` → an unresolved Promise
 * pointing at itself), so `_AIAgents` was a Promise with no agent methods.
 *
 * FIX:
 *   1. index.ts restored to a real, self-contained metadata module exporting
 *      getAllAgentMetadata() + the 5-domain AGENT_REGISTRY (values reproduced
 *      from the pre-migration agent classes @ f7f1ed745d). getCoordinator()
 *      throws a typed "not configured" error (live LLM coordinator was gutted).
 *   2. agents.routes.ts now `await`s the async orchestrator getters so the real
 *      metadata reaches the response body (was returning a bare Promise).
 *
 * Pattern: 1:1 with red-ai-500s — REAL router + REAL verifyToken + REAL local
 * Postgres (parity :5443). Seed prefix odbior--agents-- (nothing new persisted).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

let token: string;

async function mountAgents(): Promise<Express> {
  const router = (await import('../../server/src/routes/agents.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // agents.routes applies verifyToken per-route; mount at the real prefix.
  app.use('/api/agents', router);
  return app;
}

beforeAll(async () => {
  await seed();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  // Nothing persisted — metadata is static.
}, 30_000);

describe('RED-F W6: GET /api/agents no longer crashes', () => {
  it('GET /api/agents → 200 with real agent metadata (was 500 crash)', async () => {
    const app = await mountAgents();
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${token}`);

    // Primary red→green assertion: not a 5xx crash.
    expect(res.status, `body=${JSON.stringify(res.body)}`).toBeLessThan(500);
    expect(res.status).toBe(200);

    // The fix must surface the REAL registry, not an empty Promise placeholder.
    const agents = res.body?.agents;
    expect(Array.isArray(agents), `agents not an array: ${JSON.stringify(res.body)}`).toBe(true);
    expect(agents.length).toBe(5);

    const domains = agents.map((a: any) => a.domain).sort();
    expect(domains).toEqual(
      ['change_management', 'finance', 'project_management', 'risk_management', 'strategy'].sort()
    );

    // Metadata shape reproduced from the pre-migration BaseAgent.getMetadata().
    for (const a of agents) {
      expect(typeof a.name).toBe('string');
      expect(Array.isArray(a.expertise)).toBe(true);
      expect(a.expertise.length).toBeGreaterThan(0);
      expect(typeof a.confidenceThreshold).toBe('number');
    }
  }, 30_000);

  it('POST /api/agents/query/strategy → graceful 503, NOT the old 500 crash', async () => {
    // Coordinator-backed path: the live agent coordinator was gutted during the
    // migration, so this must degrade to the route's honest featureUnavailable
    // (503 not_configured), NOT surface the old opaque 500
    // "_AIAgents.getAllAgentMetadata/getCoordinator is not a function" crash.
    const app = await mountAgents();
    const res = await request(app)
      .post('/api/agents/query/strategy')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'odbior--agents-- smoke' });

    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBe(503);
    expect(res.body?.type).toBe('not_configured');
  }, 30_000);
});
