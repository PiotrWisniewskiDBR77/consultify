/**
 * Case Workspace HTTP routes — aggregator.
 *
 * Composes all 11 domain-service route files in this directory into a
 * single router, mounted once at /api/v8/case-workspace by
 * server/src/routes/v8/index.ts (the existing router-mounting convention
 * this server already uses for every other v8/* domain — see how
 * `myWorkRoutes` is mounted there for the pattern this follows).
 *
 * Every sub-router below defines its own fully-qualified paths (e.g.
 * `/cases/:caseId/proposals`, `/plan-versions/:planVersionId`) rather than
 * being mounted under a resource-name prefix here, because several domains
 * share the same `/cases/:caseId/...` and `/runs/:runId/...` path families
 * (a Case's plan versions, proposals, waits, history events, artifact links,
 * gateway evaluations, etc. all nest under one Case) — mounting each router
 * at root here, with each router owning its own distinctive top-level path
 * segment(s) internally, is what keeps that nesting possible without 11
 * separate prefixes colliding or requiring one giant file.
 *
 * waitSubscriptionService's claimTimerWait/renewTimerWaitClaimLease/
 * expireWait/listDueTimerWaitsForClaim are internal scheduler-only per the
 * task brief and are never routed here (see waitSubscriptions.routes.ts's
 * own header comment).
 */

import { Router } from 'express';

import actionProposalsRoutes from './actionProposals.routes.js';
import artifactLinksRoutes from './artifactLinks.routes.js';
import capabilitiesRoutes from './capabilities.routes.js';
import casesRoutes from './cases.routes.js';
import casePlanVersionsRoutes from './casePlanVersions.routes.js';
import caseHistoryRoutes from './caseHistory.routes.js';
import executionGraphRoutes from './executionGraph.routes.js';
import lightStartRoutes from './lightStart.routes.js';
import intakeRoutes from './intake.routes.js';
import migrationReadinessRoutes from './migrationReadiness.routes.js';
import playRoutes from './play.routes.js';
import runBindingsRoutes from './runBindings.routes.js';
import waitSubscriptionsRoutes from './waitSubscriptions.routes.js';

const router = Router();

router.use(casesRoutes);
router.use(casePlanVersionsRoutes);
router.use(capabilitiesRoutes);
router.use(runBindingsRoutes);
router.use(actionProposalsRoutes);
router.use(waitSubscriptionsRoutes);
router.use(caseHistoryRoutes);
router.use(playRoutes);
router.use(artifactLinksRoutes);
router.use(executionGraphRoutes);
router.use(migrationReadinessRoutes);
// Chat/Teresa -> Case intake (`/case-intake/*`). Mounted last; it shares no
// path prefix with any router above, so ordering is not load-bearing.
router.use(lightStartRoutes);
router.use(intakeRoutes);

export default router;
