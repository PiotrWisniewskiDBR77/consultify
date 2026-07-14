/**
 * Initiative backbone routes (F0 audit→initiative + F4 portfolio-health).
 *
 * Standalone, additive router mounted at /api/initiatives (Gateway.ts). Mirrors the
 * auth/permission chain of initiatives-additive.routes.ts. Strictly org-scoped.
 *
 *   POST /initiatives/from-audit        { auditId, projectId?, finding? }   → DRAFT z audytu
 *   GET  /initiatives/portfolio-health                                       → zdrowie portfela (MECE/dedup/balans)
 *
 * UWAGA mount: zarejestruj PRZED initiativesRoutes nie jest konieczne (oba to konkretne
 * ścieżki, nie kolidują z GET /:id), ale trzymaj przy innych additive routerach.
 */
import { type Response, Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { createInitiativeFromAudit } from '../services/initiative/auditInitiativeService.js';
import { getPortfolioHealth } from '../services/initiative/portfolioAnalysisService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();
router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string | null {
  const orgId = req.user?.organizationId || req.organizationId;
  return orgId ? String(orgId) : null;
}
function getUserId(req: any): string {
  return req.user?.id || req.userId || 'system';
}

const FromAuditSchema = z.object({
  auditId: z.string().min(1),
  projectId: z.string().optional(),
  finding: z.unknown().optional(),
});

// POST /initiatives/from-audit — utwórz inicjatywę (DRAFT) z findingu audytu (F0/H).
router.post(
  '/from-audit',
  validateBody(FromAuditSchema),
  asyncHandler(async (req: any, res: Response) => {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const result = await createInitiativeFromAudit({
        auditId: req.body.auditId,
        organizationId,
        userId: getUserId(req),
        projectId: req.body.projectId,
        finding: req.body.finding,
      } as never);
      return res.status(201).json(result);
    } catch (err: any) {
      const code = Number(err?.statusCode) || 500;
      logger.warn('[initiativeBackbone] from-audit failed', { code, msg: err?.message });
      return res.status(code >= 400 && code < 600 ? code : 500).json({
        error: 'from_audit_failed',
        message: err?.message || 'Nie udało się utworzyć inicjatywy z audytu.',
      });
    }
  })
);

// GET /initiatives/portfolio-health — zdrowie portfela (MECE/luki/duplikaty/balans) (F4).
router.get(
  '/portfolio-health',
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    // getPortfolioHealth jest fail-safe (degraduje do pustego portfela, nigdy nie rzuca).
    const health = await getPortfolioHealth(queryHelpers as never, orgId);
    return res.status(200).json(health);
  })
);

export default router;
