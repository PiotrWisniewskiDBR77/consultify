/**
 * Table Platform — Relation Explainability Route
 *
 * Single additive router for the genuinely-missing capability identified in
 * Sprint 0 preflight (D2). Lives in its own file so we never edit
 * `table-platform.routes.ts` (which is OUT OF SCOPE per packet §4).
 *
 * Mount: app.use('/api/table-platform', tablePlatformRelationsExplainRoutes)
 * AFTER the existing `tablePlatformRoutes` mount (T6 mitigation).
 *
 * See:
 *  - epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md (US-3.2)
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import relationExplainabilityService, {
  TenantViolationError,
} from '../services/tablePlatform/RelationExplainabilityService.js';
import logger from '../utils/Logger.js';

const router = Router();

// All routes require auth + organization context (== tenant). The tenant id
// is resolved from the JWT/session via verifyToken; NEVER from the body.
router.use(verifyToken as any);

router.use((req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!authReq.organizationId) {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }
  next();
});

router.get(
  '/tables/:tableId/records/:recordId/relations/explain',
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const recordId = String(req.params.recordId ?? '');
    const tenantId = String(authReq.organizationId ?? '');
    const actorId = String(authReq.userId ?? authReq.user?.id ?? '');

    if (!tableId || !recordId) {
      return res.status(400).json({ error: 'tableId and recordId are required' });
    }
    if (!tenantId || !actorId) {
      return res.status(403).json({ error: 'Organization or user context missing' });
    }

    const rawMax = req.query.max;
    const parsedMax = typeof rawMax === 'string' ? Number(rawMax) : 12;
    const maxRelations =
      Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(Math.floor(parsedMax), 100) : 12;

    try {
      const result = await relationExplainabilityService.explain({
        tableId,
        recordId,
        tenantId,
        actorId,
        maxRelations,
      });
      return res.status(200).json({ data: result });
    } catch (e) {
      if (e instanceof TenantViolationError || (e as { code?: string })?.code === 'TENANT_VIOLATION') {
        return res.status(403).json({ error: 'Forbidden', code: 'TENANT_VIOLATION' });
      }
      logger.error('[RelationExplainRoute] failed', {
        tableId,
        recordId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
