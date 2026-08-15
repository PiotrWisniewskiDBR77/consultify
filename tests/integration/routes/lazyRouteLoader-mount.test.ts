// @vitest-environment node
/**
 * E-LAZY-01 — mount proof for the 5 routers that used to go through
 * server/src/utils/lazyRouteLoader.ts (`createLazyRoute`).
 *
 * BACKGROUND: `createLazyRoute(routePath)` does `await import(routePath)` with a
 * RELATIVE specifier. Under ES module semantics a relative specifier in a dynamic
 * import() resolves against the URL of the module where the import() call is
 * lexically located — i.e. against utils/lazyRouteLoader.ts's own directory, NOT
 * against the directory of whichever routes/*.routes.ts file called
 * createLazyRoute(). So `createLazyRoute('./aiLearning.js')` called from
 * routes/ai/aiLearning.routes.ts tried to load utils/aiLearning.js (doesn't
 * exist) instead of routes/ai/aiLearning.js (the real 192-line router). Every
 * request to a route mounted this way returned HTTP 500 "Failed to load route".
 *
 * Reproduced directly (tsx runtime, i.e. same runtime as `npm run dev`) against
 * the current `createLazyRoute('./aiLearning.js')` call: it still 500s today —
 * the utility itself is still bugged, see repro log referenced in the finding.
 *
 * FINDING: all 5 real callers of createLazyRoute have ALREADY been migrated off
 * it (RECOVERY comments in each file, present on origin/demo before this branch
 * was cut) — aiLearning.routes.ts now does a static `export { default } from
 * './aiLearning.js'` (resolves correctly, static specifiers are rewritten by the
 * bundler/resolved relative to the *file*, not a shared loader), and the other 4
 * (ai-infrastructure, ai-preferences-extended, ai-security, aiActions) now return
 * an honest 503 "not configured" since no real implementation exists for them.
 *
 * `createLazyRoute` itself remains exported from lazyRouteLoader.ts with the
 * defect intact, but has ZERO real callers left in server/src — so no live route
 * is broken by it today. This test proves that with a live mount, not a grep.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.unmock('../../../server/src/middleware/auth.middleware.js');

import aiInfrastructureRoutes from '../../../server/src/routes/ai/ai-infrastructure.routes.js';
import aiPreferencesExtendedRoutes from '../../../server/src/routes/ai/ai-preferences-extended.routes.js';
import aiSecurityRoutes from '../../../server/src/routes/ai/ai-security.routes.js';
import aiActionsRoutes from '../../../server/src/routes/ai/aiActions.routes.js';
import aiLearningRoutes from '../../../server/src/routes/ai/aiLearning.routes.js';

function mount(router: express.Router) {
  const app = express();
  app.use('/mounted', router);
  return app;
}

describe('E-LAZY-01: former createLazyRoute callers mount correctly (not 404/500)', () => {
  it('aiLearning.routes: auth-protected router loads and returns 401 (not 404/500) with no token', async () => {
    const app = mount(aiLearningRoutes);
    const res = await request(app).get('/mounted/patterns');
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(401);
  });

  it('ai-infrastructure.routes: returns honest 503 not_configured (not 404/500)', async () => {
    const app = mount(aiInfrastructureRoutes);
    const res = await request(app).get('/mounted/anything');
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
    expect(res.body?.type).toBe('not_configured');
  });

  it('ai-preferences-extended.routes: returns honest 503 not_configured (not 404/500)', async () => {
    const app = mount(aiPreferencesExtendedRoutes);
    const res = await request(app).get('/mounted/anything');
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
    expect(res.body?.type).toBe('not_configured');
  });

  it('ai-security.routes: returns honest 503 not_configured (not 404/500)', async () => {
    const app = mount(aiSecurityRoutes);
    const res = await request(app).get('/mounted/anything');
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
    expect(res.body?.type).toBe('not_configured');
  });

  it('aiActions.routes: returns honest 503 not_configured (not 404/500)', async () => {
    const app = mount(aiActionsRoutes);
    const res = await request(app).get('/mounted/anything');
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
    expect(res.body?.type).toBe('not_configured');
  });
});
