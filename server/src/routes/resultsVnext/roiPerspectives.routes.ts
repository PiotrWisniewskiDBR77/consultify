/**
 * ROI-E005 Benefits Realization — Organization perspective HTTP layer.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §4. Mirrors
 * `kpiPerspectives.routes.ts`'s dedicated-router pattern (thin HTTP layer
 * over `services/resultsVnext/roi/roiOrgPerspectiveRepository.ts`, own
 * `handle*Error` mapper + local `requireAuth` helper — same structural
 * precedent every sibling `*.routes.ts` in this directory follows).
 *
 * -- ONE ROUTE, SAME PREFIX AS `roi.routes.ts`. `GET /org/benefits-realization`
 * mounts at the SAME `/api/vnext/results/roi` prefix `roi.routes.ts` owns
 * (design §4). MOUNT-ORDER CHECK (design §4's own instruction — verified,
 * not assumed): every route `roi.routes.ts` itself owns starts with the
 * literal segment `/cases` (`POST /cases`, `GET /cases/:caseId`, ...  —
 * grepped the full route table, zero bare top-level dynamic segments exist
 * there, unlike `kpi.routes.ts`'s own `GET /:kpiId`, which is EXACTLY why
 * `kpiPerspectives.routes.ts` had to be registered before it). `/org/...`
 * therefore can never collide with `/cases/...` regardless of which router
 * Gateway.ts registers first — mounted before `roi.routes.ts` anyway, purely
 * for consistency with the KPI precedent's ordering convention, not because
 * correctness depends on it here.
 *
 * -- managerId derivation: `listOrganizationRoiBenefitsRealization` reads the
 * AUTHENTICATED actor's own id (`auth.userId`) as "whose management chain" —
 * never a client-supplied id (same "server derives identity" split every
 * other perspective/attention endpoint in this program follows).
 *
 * -- Error mapping: this router calls only ONE repository function, a pure
 * read with no typed error classes of its own (it can 500 on infrastructure
 * failure only) — no `AtomicWriteConflictError`/`AtomicWriteAggregateNotFoundError`
 * branch is needed (unlike `roi.routes.ts`'s own `handleRoiRouteError`,
 * which fronts many write commands).
 */
import type { Response } from 'express';
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { listOrganizationRoiBenefitsRealization } from '../../services/resultsVnext/roi/roiOrgPerspectiveRepository.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';

interface RouteAuth {
  organizationId: string;
  userId: string;
  role: string;
}

/** Defense-in-depth re-check on top of `verifyToken`/`requireOrgAccess()` —
 * same pattern as every sibling `requireAuth` in this directory. */
function requireAuth(req: AuthenticatedRequest, res: Response): RouteAuth | null {
  const organizationId = req.user?.organizationId || req.user?.organization_id;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
  return { organizationId, userId, role: req.user?.role ? String(req.user.role) : 'member' };
}

function handleRoiPerspectivesRouteError(res: Response, err: unknown, op: string): void {
  logger.error(`[resultsVnext/roiPerspectives.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'ROI_PERSPECTIVES_INTERNAL_ERROR' });
}

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// GET /api/vnext/results/roi/org/benefits-realization —
// listOrganizationRoiBenefitsRealization
// ==========================================

router.get('/org/benefits-realization', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const attention = await listOrganizationRoiBenefitsRealization({
      managerId: auth.userId,
      organizationId: auth.organizationId,
    });
    res.status(200).json({ attention });
  } catch (err) {
    handleRoiPerspectivesRouteError(res, err, 'listOrganizationRoiBenefitsRealization');
  }
});

export default router;
