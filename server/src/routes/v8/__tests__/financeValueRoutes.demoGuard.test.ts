/**
 * FIN-005 — root cause of `Value engine temporarily unavailable`.
 *
 * The staging probe reported the Finance → Models cockpit rendering
 * "Value engine temporarily unavailable — the cockpit works normally". That
 * copy comes from `ValueOfficePanel`'s `failed` branch, which is entered when
 * either of its two calls rejects:
 *
 *   POST /api/v8/finance/value/value-bridge
 *   POST /api/v8/finance/value/portfolio/prioritize
 *
 * Both are **pure compute** — `financeValueRoutes.ts` says so in its header and
 * the handlers touch no database: they take initiatives in the request body,
 * run a deterministic service, and return the result.
 *
 * But they are POSTs. `demoWriteProtection` (mounted in `Gateway.ts` before
 * every route, with an allowlist of only `/api/demo/` and `/api/auth/`) rejects
 * ANY non-GET/HEAD/OPTIONS request in demo mode with 403 `DEMO_READ_ONLY`.
 * So in the Atelier demo workspace the value engine can never answer — not
 * because it is broken, but because a read-only guard is classifying a
 * calculation as a write.
 *
 * This test pins that mechanism with the REAL middleware and the REAL router,
 * so the blocker in the FIN-005 handoff rests on executable evidence rather
 * than on reading the code. It also pins the intended post-fix behaviour as a
 * skipped expectation, so whoever changes the allowlist has the assertion ready.
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { demoWriteProtection } from '../../../middleware/demoGuard.middleware.js';
import financeValueRoutes from '../financeValueRoutes.js';

/**
 * Mirrors the Gateway wiring for these routes: the demo write guard runs first
 * (Gateway.ts mounts it immediately after request logging, long before
 * `/api/v8`), then auth attaches the org context, then the router.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(demoWriteProtection({ allowedRoutes: ['/api/demo/', '/api/auth/'] }));
  app.use((req, _res, next) => {
    (req as any).user = { id: 'demo-user', organizationId: 'demo-org' };
    next();
  });
  app.use('/api/v8/finance/value', financeValueRoutes);
  return app;
}

const INITIATIVES = [
  { id: 'i1', name: 'Line 3 Digital Twin Rollout', value: 1_200_000, stage: 'realized', npv: 800_000, risk: 0.3, effort: 4 },
  { id: 'i2', name: 'Procurement Control Tower', value: 600_000, stage: 'identified', npv: 300_000, risk: 0.6, effort: 2 },
];

describe('FIN-005 — value engine in demo mode', () => {
  it('value-bridge is rejected by the demo read-only guard (403 DEMO_READ_ONLY)', async () => {
    const response = await request(buildApp())
      .post('/api/v8/finance/value/value-bridge')
      .set('X-Demo-Mode', 'true')
      .send({ initiatives: INITIATIVES });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('DEMO_READ_ONLY');
    // This is what the panel sees; it has no way to tell it apart from a real
    // engine failure, so it renders "temporarily unavailable".
    expect(response.body.error).toBe('Demo mode is read-only');
  });

  it('portfolio/prioritize is rejected the same way', async () => {
    const response = await request(buildApp())
      .post('/api/v8/finance/value/portfolio/prioritize')
      .set('X-Demo-Mode', 'true')
      .send({ initiatives: INITIATIVES });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('DEMO_READ_ONLY');
  });

  it('the same call succeeds outside demo mode — the engine itself is healthy', async () => {
    const response = await request(buildApp())
      .post('/api/v8/finance/value/value-bridge')
      .send({ initiatives: INITIATIVES });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.data?.steps)).toBe(true);
    expect(response.body?.data?.steps.length).toBeGreaterThan(0);
  });

  it('prioritization computes a real portfolio outside demo mode', async () => {
    const response = await request(buildApp())
      .post('/api/v8/finance/value/portfolio/prioritize')
      .send({ initiatives: INITIATIVES });

    expect(response.status).toBe(200);
    expect(response.body?.data).toHaveLength(INITIATIVES.length);
    for (const item of response.body.data) {
      expect(typeof item.quadrant).toBe('string');
    }
  });

  it('the guard blocks these routes purely because they use POST', async () => {
    // Proof that the classification is about the HTTP verb, not about the
    // handler doing anything persistent: a GET on the same prefix is let
    // through by the guard (the router then 404s, which is the router's answer,
    // not the guard's 403).
    const response = await request(buildApp())
      .get('/api/v8/finance/value/value-bridge')
      .set('X-Demo-Mode', 'true');

    expect(response.status).not.toBe(403);
  });

  /**
   * BLOCKER FIN-005/VALUE-ENGINE — the fix is one entry in the Gateway
   * allowlist, which is global demo orchestration and therefore OUTSIDE the
   * Finance ownership boundary this packet grants. Enable this test together
   * with that change.
   */
  it.skip('post-fix: pure-compute value routes are exempt from the write guard', async () => {
    const app = express();
    app.use(express.json());
    app.use(
      demoWriteProtection({
        allowedRoutes: ['/api/demo/', '/api/auth/', '/api/v8/finance/value/'],
      })
    );
    app.use((req, _res, next) => {
      (req as any).user = { id: 'demo-user', organizationId: 'demo-org' };
      next();
    });
    app.use('/api/v8/finance/value', financeValueRoutes);

    const response = await request(app)
      .post('/api/v8/finance/value/value-bridge')
      .set('X-Demo-Mode', 'true')
      .send({ initiatives: INITIATIVES });

    expect(response.status).toBe(200);
  });
});
