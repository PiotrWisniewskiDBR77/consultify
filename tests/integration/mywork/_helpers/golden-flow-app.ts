/**
 * MW-CORE-001 golden-flow test app builder — REAL routers + REAL middleware,
 * REAL Postgres. No mocks of auth, capability, tenancy, or v8-gating logic.
 *
 * Mirrors two real production mount points, verbatim from server/src/Gateway.ts
 * and server/src/routes/v8/index.ts:
 *
 *   Step 1: app.use('/api/tasks', taskRoutes)
 *           — taskRoutes applies its OWN verifyToken/requireOrgAccess/
 *             demoContextMiddleware internally (server/src/routes/pmo/tasks.routes.ts),
 *             so mounting the router directly reproduces the real chain.
 *
 *   Step 2: app.use('/api/v8', v8FeatureGate, v8Router) where v8Router does
 *           verifyToken -> requireV8OrgContext -> v8OrgGate -> attachV8Context
 *           -> v8MetricsMiddleware -> mutationAbortCanary -> myWorkRoutes
 *           (server/src/routes/v8/index.ts). We replicate that EXACT chain
 *           here instead of importing the whole v8Router, because v8Router
 *           transitively imports ~30 unrelated sub-routers or a full server
 *           boot — the acceptance harness precedent (tests/acceptance/harness.ts,
 *           tests/acceptance/v8-mutation-canary.e2e.test.ts, red-v8-500s.e2e.test.ts)
 *           deliberately avoids that for the same reason (see MEMORY finding
 *           lazyloader_46_self_resolving_hang). None of the auth/gate/tenancy
 *           logic itself is mocked — only the unrelated sibling routers are
 *           left unmounted.
 */
import express, { type Express } from 'express';

export async function buildGoldenFlowApp(): Promise<Express> {
  const { default: verifyToken } = await import(
    '../../../../server/src/middleware/auth.middleware.js'
  );
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../../../server/src/middleware/v8Auth.middleware.js'
  );
  const v8FeatureGateMod = await import(
    '../../../../server/src/middleware/v8FeatureGate.middleware.js'
  );
  const v8FeatureGate = v8FeatureGateMod.default;
  const { v8OrgGate } = v8FeatureGateMod;
  const { v8MetricsMiddleware } = await import(
    '../../../../server/src/middleware/v8Metrics.middleware.js'
  );
  const { mutationAbortCanary } = await import(
    '../../../../server/src/middleware/mutationGuard.middleware.js'
  );
  const { default: taskRoutes } = await import('../../../../server/src/routes/pmo/tasks.routes.js');
  const { default: myWorkRoutes } = await import('../../../../server/src/routes/v8/my-work.routes.js');

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Step 1 — PUT /api/tasks/:id (TaskController.updateTask, canonical source
  // of truth transition). Real router, real internal middleware stack.
  app.use('/api/tasks', taskRoutes);

  // Step 2 — POST /api/v8/my-work/inbox/tasks/:taskId/close (+ every other
  // my-work v8 endpoint we exercise: GET inbox/canonical, GET calendar/unified,
  // POST inbox/canonical/materialize). Real gate chain, verbatim order.
  app.use(
    '/api/v8/my-work',
    v8FeatureGate as any,
    verifyToken as any,
    requireV8OrgContext as any,
    v8OrgGate as any,
    attachV8Context as any,
    v8MetricsMiddleware as any,
    mutationAbortCanary as any,
    myWorkRoutes
  );

  return app;
}
