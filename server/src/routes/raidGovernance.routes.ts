/**
 * RAID Governance Routes — Module 14 Wdrożenie (ExecutionHub) — F8 + F6.
 *
 * Thin HTTP layer over three M14 governance services. No SQL lives here; every
 * handler delegates to a service and every service call is org-scoped via
 * `req.user.organizationId` for tenant isolation.
 *
 *  F8 (8.2) RAID governance — raidGovernanceService:
 *    POST /raid/issues/:issueId/link/:riskId  link an ISSUE → RISK
 *    POST /raid/risks/:riskId/materialize     promote a RISK → tracked ISSUE
 *    POST /raid/governance/signals            pure: {assumptions,issues} → signals
 *
 *  F8 (8.5) Post-Implementation Review — pirService:
 *    GET  /pir/:initiativeId                   list PIRs for an initiative
 *    POST /pir/:initiativeId                   create a DRAFT PIR
 *    POST /pir/:id/finalize                    finalize a DRAFT PIR
 *
 *  F6 (6.6) Change Champions — changeChampionsService:
 *    GET    /champions                         org-wide champion list (optional ?initiativeId=)
 *    GET    /champions/coverage                Kotter ~15% coalition-coverage vs affected population
 *    GET    /champions/:initiativeId           list champions for an initiative
 *    POST   /champions                         add a champion
 *    DELETE /champions/:id                     remove a champion
 *
 * Auth pattern mirrors rollout.routes.ts: verifyToken + isAuthenticated, then a
 * per-handler `requireOrg` guard that 401s when no org is attached.
 *
 * Mounted in Gateway.ts at /api/raid-governance.
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  requireInitiativeCapability,
  requireProjectCapability,
} from '../middleware/effectiveCapability.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  addChampion,
  coalitionCoverage,
  listChampions,
  removeChampion,
} from '../services/changeChampionsService.js';
import { createPir, finalizePir, getPir } from '../services/pirService.js';
import {
  assumptionSignals,
  issueSignals,
  linkIssueToRisk,
  materializeRiskToIssue,
} from '../services/raidGovernanceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';

const router = Router();

// All routes require an authenticated org member.
router.use(verifyToken, isAuthenticated);

/** Resolve the caller's org or emit 401; null means the handler must return. */
const requireOrg = (req: AuthRequest, res: Response): string | null => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
};

// ================================================================
// F8 (8.2) — RAID governance
// ================================================================

/**
 * Link an ISSUE to a RISK (typed `linked_items` merge). Org-scoped on the issue.
 */
router.post(
  '/raid/issues/:issueId/link/:riskId',
  requireProjectCapability('risk.manage', undefined, { shadow: true, allowWithoutProject: true }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await linkIssueToRisk(orgId, req.params.issueId, req.params.riskId);
    if (!result.success) {
      const status = result.error === 'issue_not_found' ? 404 : 500;
      return res.status(status).json({ error: result.error || 'link_failed' });
    }
    return res.json({ success: true, linkedItems: result.linkedItems });
  })
);

/**
 * Materialize a RISK into a tracked ISSUE. Org-scoped on the source risk.
 */
router.post(
  '/raid/risks/:riskId/materialize',
  requireProjectCapability('risk.manage', undefined, { shadow: true, allowWithoutProject: true }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await materializeRiskToIssue(orgId, req.params.riskId);
    if (!result.success) {
      const status = result.error === 'risk_not_found' ? 404 : 500;
      return res.status(status).json({ error: result.error || 'materialize_failed' });
    }
    return res.status(201).json({ success: true, issueId: result.issueId });
  })
);

const SignalsSchema = z.object({
  assumptions: z.array(z.any()).optional(),
  issues: z.array(z.any()).optional(),
});

/**
 * Pure signal computation. No DB writes — runs the request's own assumptions and
 * issues through the deterministic pure analyzers. Still org-gated (401 w/o org)
 * so it cannot be hit anonymously, but it reads nothing tenant-specific from DB.
 */
router.post(
  '/raid/governance/signals',
  validateBody(SignalsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof SignalsSchema>;
    const now = Date.now();
    const assumption = assumptionSignals(b.assumptions ?? [], now);
    const issue = issueSignals(b.issues ?? [], now);
    return res.json({ assumptionSignals: assumption, issueSignals: issue });
  })
);

// ================================================================
// F8 (8.5) — Post-Implementation Review (PIR)
// ================================================================

const PirCreateSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  went_well: z.string().nullable().optional(),
  went_wrong: z.string().nullable().optional(),
  do_better: z.string().nullable().optional(),
  recommendations: z.string().nullable().optional(),
});

router.get(
  '/pir/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const reviews = await getPir(orgId, req.params.initiativeId);
    return res.json({ reviews, count: reviews.length });
  })
);

router.post(
  '/pir/:initiativeId',
  requireInitiativeCapability('initiative.pir.manage', { shadow: true }),
  validateBody(PirCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const review = await createPir(
      orgId,
      req.params.initiativeId,
      req.body as z.infer<typeof PirCreateSchema>
    );
    return res.status(201).json({ review });
  })
);

router.post(
  '/pir/:id/finalize',
  // :id is the PIR id (not an initiative) — project resolution may miss, so
  // allowWithoutProject keeps the shadow verdict evaluable at org level.
  requireInitiativeCapability('initiative.pir.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const reviewedBy = req.user?.id || '';
    const review = await finalizePir(orgId, req.params.id, reviewedBy);
    if (!review) return res.status(404).json({ error: 'PIR not found' });
    return res.json({ review });
  })
);

// ================================================================
// F6 (6.6) — Change Champions
// ================================================================

const ChampionCreateSchema = z.object({
  initiativeId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  role: z.string().max(64).optional(),
  influence: z.string().max(64).nullable().optional(),
  status: z.string().max(32).optional(),
});

/**
 * Org-wide champion list (no initiative filter) — powers the ExecutionHub
 * cockpit panel, which runs org/portfolio-scoped rather than per-initiative.
 * Declared BEFORE /champions/:initiativeId so '/champions' and
 * '/champions/coverage' are not swallowed by the param route.
 */
router.get(
  '/champions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const initiativeId =
      typeof req.query.initiativeId === 'string' ? req.query.initiativeId : undefined;
    const champions = await listChampions(orgId, initiativeId);
    return res.json({ champions, count: champions.length });
  })
);

/**
 * Coalition coverage vs Kotter's ~15% guiding-coalition target (pure analytics
 * in changeChampionsService.coalitionCoverage). championCount comes from a
 * real org-scoped DB read; affectedPopulation is caller-supplied via query
 * (e.g. unique task assignees for the current scope) and falls back to the
 * org's active user count when omitted.
 */
router.get(
  '/champions/coverage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const initiativeId =
      typeof req.query.initiativeId === 'string' ? req.query.initiativeId : undefined;
    const champions = await listChampions(orgId, initiativeId);
    const activeChampionCount = champions.filter((c) => c.status === 'active').length;

    let affectedPopulation = Number(req.query.affectedPopulation);
    if (!Number.isFinite(affectedPopulation) || affectedPopulation <= 0) {
      const row = await dbGet<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM users WHERE organization_id = ? AND status = 'active'`,
        [orgId]
      );
      affectedPopulation = Number(row?.cnt) || 0;
    }

    const coverage = coalitionCoverage(activeChampionCount, affectedPopulation);
    return res.json({ championCount: activeChampionCount, affectedPopulation, ...coverage });
  })
);

router.get(
  '/champions/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const champions = await listChampions(orgId, req.params.initiativeId);
    return res.json({ champions, count: champions.length });
  })
);

router.post(
  '/champions',
  requireInitiativeCapability('change.champion.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  validateBody(ChampionCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const id = await addChampion(orgId, req.body as z.infer<typeof ChampionCreateSchema>);
    return res.status(201).json({ id });
  })
);

router.delete(
  '/champions/:id',
  requireInitiativeCapability('change.champion.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    await removeChampion(orgId, req.params.id);
    return res.json({ success: true });
  })
);

export default router;
