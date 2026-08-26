import type { Response } from 'express';
import { Router } from 'express';
import type { z } from 'zod';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { requireResultsInternalBetaVisibility } from '../../middleware/resultsInternalBetaVisibility.middleware.js';
import { validateQuery } from '../../middleware/validation.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { searchResults } from '../../services/resultsVnext/platform/resultsSearchRepository.js';
import {
  RESULTS_SEARCH_KINDS,
  ResultsVnextSearchQuerySchema,
} from '../../validators/resultsVnextSearch.validators.js';

const router = Router();
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireActiveMembership);
router.use(requireOrgAccess());
router.use(requireResultsInternalBetaVisibility);
router.use(demoContextMiddleware);

router.get(
  '/',
  validateQuery(ResultsVnextSearchQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    const query = req.query as unknown as z.infer<typeof ResultsVnextSearchQuerySchema>;
    const kinds = query.kinds ?? [...RESULTS_SEARCH_KINDS];
    if (query.q.length < 2) {
      res.status(200).json({
        query: query.q,
        kinds,
        results: [],
        nextCursor: null,
        scopeCompleteness: 'FULL',
        unavailableKinds: [],
      });
      return;
    }
    try {
      const page = await searchResults({
        userId,
        organizationId,
        query: query.q,
        kinds,
        limit: query.limit ?? 20,
        cursor: query.cursor,
      });
      res
        .status(200)
        .json({ query: query.q, kinds, ...page, scopeCompleteness: 'FULL', unavailableKinds: [] });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SEARCH_CURSOR') {
        res.status(400).json({ error: 'Invalid cursor', code: 'INVALID_CURSOR' });
        return;
      }
      res.status(500).json({ error: 'Search failed', code: 'SEARCH_FAILED' });
    }
  }
);

export default router;
