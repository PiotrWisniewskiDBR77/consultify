import { Router, type RequestHandler } from 'express';

import verifyToken from '../../middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../middleware/mutationGuard.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../middleware/v8Auth.middleware.js';
import { v8MetricsMiddleware } from '../../middleware/v8Metrics.middleware.js';
import featureFlagRoutes from './admin/feature-flags.routes.js';
import financeRoutes from './finance.routes.js';

type Method = 'GET' | 'POST' | 'PUT';

const EXACT_ROUTES = new Set<string>([
  'GET /admin/flags',
  'GET /finance/canonical-lines',
  'GET /finance/statement-packs',
  'GET /finance/statements',
  'POST /finance/statements/upload-and-analyze',
]);

const PARAMETERIZED_ROUTES: Array<{ method: Method; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/finance\/statement-packs\/[^/]+$/ },
  { method: 'GET', pattern: /^\/finance\/statements\/[^/]+$/ },
  { method: 'GET', pattern: /^\/finance\/statements\/[^/]+\/(analytics|ratios|source-receipt)$/ },
  {
    method: 'GET',
    pattern: /^\/finance\/statements\/[^/]+\/document-intelligence\/search$/,
  },
  { method: 'POST', pattern: /^\/finance\/statements\/[^/]+\/(detect|extract|map|confirm)$/ },
  {
    method: 'POST',
    pattern: /^\/finance\/statements\/[^/]+\/manual-mapping-decisions$/,
  },
  { method: 'PUT', pattern: /^\/finance\/statements\/[^/]+\/values$/ },
];

/**
 * The mounted Finance UI is not an experimental V8 surface. It must keep its
 * authenticated Statement workflow available when the unrelated global V8
 * rollout toggle is off. This allowlist is intentionally method-and-path exact:
 * all other V8 traffic still reaches the global gate.
 */
export function isMountedFinanceStatementSurface(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase() as Method;
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (EXACT_ROUTES.has(`${normalizedMethod} ${normalizedPath}`)) return true;
  return PARAMETERIZED_ROUTES.some(
    (route) => route.method === normalizedMethod && route.pattern.test(normalizedPath)
  );
}

type MountedSurfaceDependencies = {
  verifyToken: RequestHandler;
  requireOrgContext: RequestHandler;
  attachContext: RequestHandler;
  metrics: RequestHandler;
  mutationCanary: RequestHandler;
  flagsRouter: RequestHandler;
  financeRouter: RequestHandler;
};

const defaults: MountedSurfaceDependencies = {
  verifyToken,
  requireOrgContext: requireV8OrgContext,
  attachContext: attachV8Context,
  metrics: v8MetricsMiddleware,
  mutationCanary: mutationAbortCanary,
  flagsRouter: featureFlagRoutes,
  financeRouter: financeRoutes,
};

/**
 * A deliberately independent pre-rollout router. Reusing `v8Router` here is
 * incorrect because that router contains `v8OrgGate` before `/finance`.
 * Exact path selection happens before auth and exits this router for every
 * sibling V8 surface; selected requests retain the canonical auth, tenant
 * context, metrics, membership/editor walls inside financeRoutes, and the
 * mutation abort canary.
 */
export function createMountedFinanceStatementRouter(
  overrides: Partial<MountedSurfaceDependencies> = {}
): Router {
  const dependencies = { ...defaults, ...overrides };
  const router = Router();
  router.use((req, _res, next) => {
    if (!isMountedFinanceStatementSurface(req.method, req.path)) return next('router');
    return next();
  });
  router.use(
    dependencies.verifyToken,
    dependencies.requireOrgContext,
    dependencies.attachContext,
    dependencies.metrics,
    dependencies.mutationCanary
  );
  router.use('/admin/flags', dependencies.flagsRouter);
  router.use('/finance', dependencies.financeRouter);
  return router;
}

export const mountedFinanceStatementRouter = createMountedFinanceStatementRouter();
