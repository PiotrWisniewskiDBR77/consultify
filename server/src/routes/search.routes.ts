/**
 * Global search route — HARVARD H6.12.
 *
 * GET /api/search?q=<term>
 *   Org-scoped name/title search across key entities (initiatives, tasks,
 *   decisions, ideas, notes, M17 artifacts, assessments). Powers Cmd+K.
 *
 * Auth: mounted behind gatewayVerifyToken in Gateway.ts, so req.user is set.
 */

import { type Request, type Response, Router } from 'express';

import { getDatabaseAsync } from '../database/Database.js';
import { runGlobalSearch } from '../services/globalSearchService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = String((req as any).user?.organizationId || '').trim();
    if (!orgId) {
      res.status(401).json({ error: 'unauthorized', query: '', total: 0, groups: {} });
      return;
    }

    const rawQuery = (req.query?.q ?? req.query?.query ?? '') as unknown;

    try {
      const db = await getDatabaseAsync();
      const result = await runGlobalSearch(db as any, orgId, rawQuery);
      res.json(result);
    } catch (err) {
      logger.error('[search] global search failed', {
        error: (err as Error)?.message,
        orgId,
      });
      // Fail soft: an empty result keeps Cmd+K usable instead of erroring.
      res.json({
        query: typeof rawQuery === 'string' ? rawQuery.trim() : '',
        total: 0,
        groups: {},
      });
    }
  })
);

export default router;
