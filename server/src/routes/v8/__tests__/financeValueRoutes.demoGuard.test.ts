/**
 * FIN-005 — root cause of `Value engine temporarily unavailable`, and the
 * executable proof for the PROPOSED allowlist that fixes it.
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
 * This file has two halves:
 *
 *   1. `current wiring` — pins the blocker with the REAL middleware and the
 *      REAL router, so the FIN-005 handoff rests on executable evidence rather
 *      than on reading the code.
 *   2. `proposed allowlist` — mounts the SAME real middleware with
 *      `STATELESS_COMPUTE_DEMO_ALLOWLIST` and proves both halves of the
 *      proposal: the compute endpoints answer with real computed results, and
 *      genuinely writing endpoints (`POST /api/v8/finance/models`,
 *      `POST /api/v8/finance/analyses`, `POST /api/finance-statements/upload`)
 *      are STILL rejected with 403 `DEMO_READ_ONLY` under that same allowlist.
 *
 * Nothing here modifies `Gateway.ts` or `demoGuard.middleware.ts`. The allowlist
 * is a proposal awaiting security review; the one-step Gateway diff lives in
 * `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-006_CROSS_MODULE_CURRENCY_AND_VALUE_ENGINE.md` (§B.3).
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { demoWriteProtection } from '../../../middleware/demoGuard.middleware.js';
import financeStatementsRoutes from '../../finance-statements.routes.js';
import financeRoutes from '../finance.routes.js';
import {
  AUDITED_VALUE_ROUTES,
  isStatelessComputeDemoRoute,
  STATELESS_COMPUTE_DEMO_ALLOWLIST,
} from '../financeValueDemoAllowlist.js';
import financeValueRoutes from '../financeValueRoutes.js';

const GATEWAY_ALLOWLIST_TODAY = ['/api/demo/', '/api/auth/'];

/**
 * Mirrors the Gateway wiring: the demo write guard runs first (Gateway.ts
 * mounts it immediately after request logging, long before `/api/v8`), then
 * auth attaches the org context, then the routers.
 *
 * The REAL v8 finance router and the REAL finance-statements router are mounted
 * alongside the value router so the "writes stay blocked" assertions run
 * against production route tables, not against stand-ins. The guard answers 403
 * before any handler runs, so no database is touched; if the guard ever stopped
 * blocking them the request would reach the real handler and the status would
 * stop being 403 — which is exactly what those tests assert.
 *
 * NOTE: auth is deliberately mounted AFTER the guard, as in the Gateway. The
 * guard therefore sees no `req.user`, so its `isDemoOrg` branch never fires and
 * demo mode is driven purely by the `X-Demo-Mode` header — the same asymmetry
 * production has.
 */
function buildApp(allowedRoutes: readonly string[]) {
  const app = express();
  app.use(express.json());
  app.use(demoWriteProtection({ allowedRoutes: [...allowedRoutes] }));
  app.use((req, _res, next) => {
    (req as any).user = { id: 'demo-user', organizationId: 'demo-org' };
    (req as any).organizationId = 'demo-org';
    next();
  });
  // Specific prefix before the catch-all, exactly as routes/v8/index.ts orders them.
  app.use('/api/v8/finance/value', financeValueRoutes);
  app.use('/api/v8/finance', financeRoutes);
  app.use('/api/finance-statements', financeStatementsRoutes);
  return app;
}

const INITIATIVES = [
  {
    id: 'i1',
    name: 'Line 3 Digital Twin Rollout',
    value: 1_200_000,
    stage: 'realized',
    npv: 800_000,
    risk: 0.3,
    effort: 4,
  },
  {
    id: 'i2',
    name: 'Procurement Control Tower',
    value: 600_000,
    stage: 'identified',
    npv: 300_000,
    risk: 0.6,
    effort: 2,
  },
];

/**
 * Real endpoints that persist. Used to prove the proposed allowlist does not
 * widen the write surface by even one route.
 *
 * `POST /models`                  — finance.routes.ts:271
 * `POST /models/:modelId/compute` — finance.routes.ts:450
 * `POST /analyses`                — finance.routes.ts:2109
 * `POST /upload`                  — finance-statements.routes.ts:292
 */
const WRITING_ENDPOINTS: ReadonlyArray<{ path: string; body: Record<string, unknown> }> = [
  { path: '/api/v8/finance/models', body: { name: 'Should never be created' } },
  { path: '/api/v8/finance/analyses', body: { title: 'Should never be created' } },
  { path: '/api/v8/finance/models/model-1/compute', body: {} },
  { path: '/api/finance-statements/upload', body: {} },
];

describe('FIN-005 — value engine in demo mode', () => {
  describe('current wiring — the blocker', () => {
    it('value-bridge is rejected by the demo read-only guard (403 DEMO_READ_ONLY)', async () => {
      const response = await request(buildApp(GATEWAY_ALLOWLIST_TODAY))
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
      const response = await request(buildApp(GATEWAY_ALLOWLIST_TODAY))
        .post('/api/v8/finance/value/portfolio/prioritize')
        .set('X-Demo-Mode', 'true')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('DEMO_READ_ONLY');
    });

    it('the same call succeeds outside demo mode — the engine itself is healthy', async () => {
      const response = await request(buildApp(GATEWAY_ALLOWLIST_TODAY))
        .post('/api/v8/finance/value/value-bridge')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body?.data?.steps)).toBe(true);
      expect(response.body?.data?.steps.length).toBeGreaterThan(0);
    });

    it('prioritization computes a real portfolio outside demo mode', async () => {
      const response = await request(buildApp(GATEWAY_ALLOWLIST_TODAY))
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
      // through by the guard (the router then 404s, which is the router's
      // answer, not the guard's 403).
      const response = await request(buildApp(GATEWAY_ALLOWLIST_TODAY))
        .get('/api/v8/finance/value/value-bridge')
        .set('X-Demo-Mode', 'true');

      expect(response.status).not.toBe(403);
    });
  });

  /**
   * PROPOSAL — not wired into `Gateway.ts`. These tests mount the REAL
   * `demoWriteProtection` with `STATELESS_COMPUTE_DEMO_ALLOWLIST` so a reviewer
   * can see the exact behaviour the Gateway change would produce before
   * approving it.
   */
  describe('proposed allowlist — stateless compute exempt, writes untouched', () => {
    const proposedApp = () => buildApp(STATELESS_COMPUTE_DEMO_ALLOWLIST);

    it('value-bridge computes a real bridge in demo mode', async () => {
      const response = await request(proposedApp())
        .post('/api/v8/finance/value/value-bridge')
        .set('X-Demo-Mode', 'true')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(200);
      expect(response.body?.meta?.contract).toBe('finance_value_compute_v1');
      const steps = response.body?.data?.steps;
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      // A real computation, not an empty envelope.
      expect(steps.some((step: any) => Number.isFinite(Number(step.value)))).toBe(true);
    });

    it('portfolio/prioritize computes a real portfolio in demo mode', async () => {
      const response = await request(proposedApp())
        .post('/api/v8/finance/value/portfolio/prioritize')
        .set('X-Demo-Mode', 'true')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(200);
      expect(response.body?.data).toHaveLength(INITIATIVES.length);
      for (const item of response.body.data) {
        expect(typeof item.quadrant).toBe('string');
        expect(item.quadrant.length).toBeGreaterThan(0);
      }
    });

    it('appraise computes real NPV/verdict in demo mode', async () => {
      const response = await request(proposedApp())
        .post('/api/v8/finance/value/appraise')
        .set('X-Demo-Mode', 'true')
        .send({
          initialInvestment: 800_000,
          cashFlows: [400_000, 400_000, 400_000, 400_000],
          discountRatePct: 10,
        });

      expect(response.status).toBe(200);
      const data = response.body?.data;
      expect(typeof data?.npv).toBe('number');
      expect(typeof data?.pi).toBe('number');
      expect(['go', 'conditional', 'no-go']).toContain(data?.verdict);
      // 0.8M in, 1.6M out over four years at 10% is unambiguously value-creating.
      expect(data.npv).toBeGreaterThan(0);
      expect(data.verdict).toBe('go');
    });

    it('variance-bridge computes a real waterfall in demo mode', async () => {
      const response = await request(proposedApp())
        .post('/api/v8/finance/value/variance-bridge')
        .set('X-Demo-Mode', 'true')
        .send({
          lines: [
            { label: 'Revenue', plan: 6_200_000, actual: 6_500_000 },
            { label: 'OpEx', plan: 2_000_000, actual: 2_150_000, isCost: true },
          ],
        });

      expect(response.status).toBe(200);
      const steps = response.body?.data?.steps;
      expect(Array.isArray(steps)).toBe(true);
      expect(steps[0]?.kind).toBe('start');
      expect(steps[0]?.value).toBe(8_200_000);
      expect(steps.length).toBeGreaterThan(1);
    });

    it.each(WRITING_ENDPOINTS)(
      'POST $path is STILL rejected 403 DEMO_READ_ONLY under the proposed allowlist',
      async ({ path, body }) => {
        const response = await request(proposedApp())
          .post(path)
          .set('X-Demo-Mode', 'true')
          .send(body);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('DEMO_READ_ONLY');
        expect(response.body.error).toBe('Demo mode is read-only');
      }
    );

    it('compute routes without a production caller stay blocked (minimality)', async () => {
      // Equally DB-free, but nothing in src/ calls them. An exemption has to be
      // earned by a demo path the client actually walks.
      for (const path of [
        '/api/v8/finance/value/capital/ration',
        '/api/v8/finance/value/value-assurance',
      ]) {
        const response = await request(proposedApp())
          .post(path)
          .set('X-Demo-Mode', 'true')
          .send({ projects: [], budget: 0, items: [] });

        expect(response.status, path).toBe(403);
        expect(response.body.code, path).toBe('DEMO_READ_ONLY');
      }
    });

    it('the legacy /finance-value alias mount is NOT exempt', async () => {
      // routes/v8/index.ts:85 mounts the same router a second time at
      // '/finance-value'. No frontend caller uses it, so it is deliberately
      // outside the allowlist — exempting an alias nobody calls would double
      // the exempted surface for nothing.
      const app = express();
      app.use(express.json());
      app.use(demoWriteProtection({ allowedRoutes: [...STATELESS_COMPUTE_DEMO_ALLOWLIST] }));
      app.use((req, _res, next) => {
        (req as any).user = { id: 'demo-user', organizationId: 'demo-org' };
        next();
      });
      app.use('/api/v8/finance-value', financeValueRoutes);

      const response = await request(app)
        .post('/api/v8/finance-value/value-bridge')
        .set('X-Demo-Mode', 'true')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('DEMO_READ_ONLY');
    });

    it('behaviour outside demo mode is unchanged by the allowlist', async () => {
      const response = await request(proposedApp())
        .post('/api/v8/finance/value/value-bridge')
        .send({ initiatives: INITIATIVES });

      expect(response.status).toBe(200);
    });
  });

  /**
   * The allowlist is fed to `demoWriteProtection` as PREFIXES (`startsWith`).
   * `isStatelessComputeDemoRoute` is the exact-match predicate the proposed
   * Gateway diff uses instead, so a future sibling route cannot inherit an
   * exemption by sharing a prefix.
   */
  describe('allowlist shape and exact-match predicate', () => {
    it('exempts only routes proven not to touch a database', () => {
      for (const route of AUDITED_VALUE_ROUTES) {
        if (route.proposedExempt) {
          expect(route.touchesDatabase, route.path).toBe(false);
        }
      }
    });

    it('every allowlist entry is an audited, exempt route — no free-floating strings', () => {
      const exempt = AUDITED_VALUE_ROUTES.filter((route) => route.proposedExempt).map(
        (route) => route.path
      );
      expect([...STATELESS_COMPUTE_DEMO_ALLOWLIST].sort()).toEqual([...exempt].sort());
      expect(STATELESS_COMPUTE_DEMO_ALLOWLIST.length).toBe(4);
    });

    it('contains no wildcard, no trailing slash and no bare mount prefix', () => {
      for (const path of STATELESS_COMPUTE_DEMO_ALLOWLIST) {
        expect(path.startsWith('/api/v8/finance/value/'), path).toBe(true);
        expect(path.includes('*'), path).toBe(false);
        expect(path.includes(':'), path).toBe(false);
        expect(path.endsWith('/'), path).toBe(false);
        // A bare mount prefix would cover every present and future route below it.
        expect(path, path).not.toBe('/api/v8/finance/value');
      }
    });

    it('accepts exactly the four proposed POST paths', () => {
      for (const path of STATELESS_COMPUTE_DEMO_ALLOWLIST) {
        expect(isStatelessComputeDemoRoute('POST', path), path).toBe(true);
        expect(isStatelessComputeDemoRoute('post', path), path).toBe(true);
      }
    });

    it('rejects paths that only share a prefix with an exempt route', () => {
      expect(isStatelessComputeDemoRoute('POST', '/api/v8/finance/value/appraise-and-save')).toBe(
        false
      );
      expect(isStatelessComputeDemoRoute('POST', '/api/v8/finance/value/value-bridge/save')).toBe(
        false
      );
      expect(isStatelessComputeDemoRoute('POST', '/api/v8/finance/value-tracking/baseline')).toBe(
        false
      );
      expect(isStatelessComputeDemoRoute('POST', '/api/v8/finance/models')).toBe(false);
      expect(isStatelessComputeDemoRoute('POST', '/api/v8/finance-value/value-bridge')).toBe(false);
    });

    it('rejects every method other than POST on an exempt path', () => {
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        expect(
          isStatelessComputeDemoRoute(method, '/api/v8/finance/value/value-bridge'),
          method
        ).toBe(false);
      }
    });
  });
});
