/**
 * Finance v3 canonical adapter surface — `/api/v8/finance-v2/*`.
 *
 * Gate C, WP-C02 "compatibility services". Mounted in `server/src/routes/v8/index.ts`
 * under the shared `v8Router`, so it inherits the same auth/context middleware
 * chain (`verifyToken` -> `requireV8OrgContext` -> `v8OrgGate` ->
 * `attachV8Context` -> `v8MetricsMiddleware` -> `mutationAbortCanary`) as
 * every other `/api/v8/*` router, matching fixture F4's documented `auth`
 * array in `docs/validation/finance-v3/generated/gate-a/WP-A02_api_fixtures.json`.
 *
 * This router only ever calls into `server/src/services/finance/canonical/*`
 * (the new canonical storage) — it does not import or touch any legacy
 * Finance route/service file, per this work package's scope boundary.
 */

import { Router } from 'express';

import artifactsRoutes from './artifacts.routes.js';
import computeRoutes from './compute.routes.js';
import modelsRoutes from './models.routes.js';
import versionsRoutes from './versions.routes.js';

const financeV2Router = Router();

financeV2Router.use(modelsRoutes);
// Pakiet B (API & Runtime Integration) — artifact lifecycle + compute job
// queue surface. Mounted after `modelsRoutes` so `/models/:modelId/*`
// (WP-C02, frozen fixture contract) keeps first-match priority; no path
// overlap in practice (`/artifacts`, `/versions`, `/compute` prefixes).
financeV2Router.use(artifactsRoutes);
financeV2Router.use(versionsRoutes);
financeV2Router.use(computeRoutes);

export default financeV2Router;
