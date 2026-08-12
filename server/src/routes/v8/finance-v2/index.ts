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

import analysisRoutes from './analysis.routes.js';
import artifactsRoutes from './artifacts.routes.js';
import baselineRoutes from './baseline.routes.js';
import commentsRoutes from './comments.routes.js';
import compareRoutes from './compare.routes.js';
import computeRoutes from './compute.routes.js';
import crosscuttingRoutes from './crosscutting.routes.js';
import lineageNavigatorRoutes from './lineage-navigator.routes.js';
import modelsRoutes from './models.routes.js';
import predictionRoutes from './prediction.routes.js';
import savedViewsRoutes from './saved-views.routes.js';
import statementsRoutes from './statements.routes.js';
import valuationRoutes from './valuation.routes.js';
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
// Pakiet B2 (Domain HTTP Surface) — Statements/Analysis/Baseline/Prediction
// domain endpoints, plus cross-cutting lineage/freshness/exception reads.
// `crosscuttingRoutes` adds routes under the SAME `/versions` prefix
// `versionsRoutes` already owns (`/versions/:businessVersionId/lineage`,
// `/versions/:businessVersionId/freshness-events`) — no path collision with
// `versionsRoutes`'s own `/versions/:businessVersionId` (exact match) or
// `/versions/:businessVersionId/transitions|compute-snapshot` (different
// literal suffixes), Express matches the most specific full path per router
// regardless of mount order for these non-overlapping suffixes.
financeV2Router.use(statementsRoutes);
financeV2Router.use(analysisRoutes);
financeV2Router.use(baselineRoutes);
financeV2Router.use(predictionRoutes);
financeV2Router.use(crosscuttingRoutes);
// Pakiet B3 (Valuation HTTP Surface) — the last zero-coverage domain (Pakiet B2 report §2.6):
// Cases/Variants, Methods/basket weights, WACC inputs, DCF/FCFF compute, full results, EV->Equity
// bridge, Terminal/Sensitivity (method-scoped), Advisor. Own `/valuation/*` + `/valuation/methods/
// :methodId/*` prefixes — no path overlap with any router above.
financeV2Router.use(valuationRoutes);
// Pakiet ROUTES_EXPOSURE — Lineage Navigator presentation surface (OWN-FIN-007/
// OWN-FIN-022). Own path `/versions/:businessVersionId/lineage-navigator`,
// distinct from `crosscuttingRoutes`'s raw-edges `/versions/:businessVersionId/
// lineage` — no collision, both stay mounted.
financeV2Router.use(lineageNavigatorRoutes);
// Pakiet ROUTES_EXPOSURE — Compare engine (period/period, actual/forecast,
// version/version, scenario/baseline, entity/entity, method/method). Own
// `/compare/*` prefix, no collision with any router above.
financeV2Router.use(compareRoutes);
// Pakiet ROUTES_EXPOSURE — Comments/review-checklist (real, migrated tables).
// Own `/comments/*` + `/review-checklist/*` prefixes, plus one read under the
// existing `/versions/:businessVersionId` prefix (`has-unresolved-blocking-
// comments`) that does not collide with any suffix versionsRoutes/
// crosscuttingRoutes/lineageNavigatorRoutes already own.
financeV2Router.use(commentsRoutes);
// Pakiet ROUTES_EXPOSURE — Saved views (personal/team, shareable token). Own
// `/saved-views/*` prefix, no collision.
financeV2Router.use(savedViewsRoutes);

export default financeV2Router;
