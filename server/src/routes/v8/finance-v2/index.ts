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

import modelsRoutes from './models.routes.js';

const financeV2Router = Router();

financeV2Router.use(modelsRoutes);

export default financeV2Router;
