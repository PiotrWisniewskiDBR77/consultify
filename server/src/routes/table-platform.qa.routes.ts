/**
 * Table Platform — QA Engine Routes (Block C · EPIC-T11 · Sprint C-S4)
 *
 * Single additive router that exposes `TableQaService` on top of the existing
 * `tablePlatformRoutes`. Lives in its own file so we never touch
 * `table-platform.routes.ts` (out of scope per Block C packet).
 *
 * Mount: app.use('/api/table-platform', tablePlatformQaRoutes)
 * AFTER `tablePlatformRoutes`, parallel to `tablePlatformAiEditorRoutes`.
 *
 * Endpoints (all require auth + organization context):
 *
 *   POST /tables/:tableId/qa/recompute
 *     Body: { triggerKind?: 'on_demand' | 'scheduled' | 'record_write' }
 *     Returns the freshly computed `QaReport`.
 *
 *   GET  /tables/:tableId/qa/latest
 *     Returns the most recent persisted report or 204 No Content if none.
 *
 *   POST /tables/:tableId/qa/suggestions/:suggestionId/inapplicable
 *     Body: { fingerprint: string, reason?: string }
 *     Persists a durable dismissal so subsequent recomputes hide the suggestion.
 *
 * Cross-tenant safety: every route resolves the table's organization through
 * `tp_bases` and refuses requests whose actor org does not match. The service
 * layer additionally re-checks the tenant before any read/write.
 *
 * Feature flag: `ENABLE_TABLE_QA_ENGINE` (gated alongside the AI Editor
 * pipeline; defaults to off until C-S5 frontend lands).
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import tableQaService, {
  type QaTriggerKind,
  TableQaError,
} from '../services/tablePlatform/TableQaService.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

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

function requireQaEnabled(req: Request, res: Response, next: NextFunction) {
  const flag = (featureFlags as unknown as Record<string, boolean | undefined>)
    .ENABLE_TABLE_QA_ENGINE;
  if (flag === false) {
    res.status(404).json({ error: 'QA engine is not enabled', code: 'QA_DISABLED' });
    return;
  }
  next();
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function mapServiceError(e: unknown, res: Response): boolean {
  if (e instanceof TableQaError) {
    res.status(e.status).json({ ...mapAppErrorResponse(e, undefined, 'error'), code: e.code });
    return true;
  }
  return false;
}

const VALID_TRIGGERS: ReadonlyArray<QaTriggerKind> = ['on_demand', 'scheduled', 'record_write'];

router.post(
  '/tables/:tableId/qa/recompute',
  requireQaEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const actorUserId = String(authReq.userId ?? authReq.user?.id ?? '');

    if (!tableId) return res.status(400).json({ error: 'tableId is required' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const requestedTrigger = asString(body.triggerKind) as QaTriggerKind | null;
    const triggerKind: QaTriggerKind =
      requestedTrigger && VALID_TRIGGERS.includes(requestedTrigger)
        ? requestedTrigger
        : 'on_demand';

    try {
      const report = await tableQaService.computeReport({
        tableId,
        organizationId: orgId,
        computedBy: actorUserId,
        triggerKind,
      });
      return res.status(200).json({ data: report });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[TableQaRoutes] recompute failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get('/tables/:tableId/qa/latest', requireQaEnabled, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tableId = String(req.params.tableId ?? '');
  const orgId = String(authReq.organizationId ?? '');
  if (!tableId) return res.status(400).json({ error: 'tableId is required' });

  try {
    const report = await tableQaService.getLatestReport(tableId, orgId);
    if (!report) return res.status(204).end();
    return res.status(200).json({ data: report });
  } catch (e) {
    if (mapServiceError(e, res)) return;
    logger.error('[TableQaRoutes] latest failed', {
      tableId,
      error: (e as Error)?.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.post(
  '/tables/:tableId/qa/suggestions/:suggestionId/inapplicable',
  requireQaEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const suggestionId = String(req.params.suggestionId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const actorUserId = String(authReq.userId ?? authReq.user?.id ?? '');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const fingerprint = asString(body.fingerprint);
    const reason = asString(body.reason) ?? undefined;

    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    if (!suggestionId) return res.status(400).json({ error: 'suggestionId is required' });
    if (!fingerprint)
      return res
        .status(400)
        .json({ error: 'fingerprint is required', code: 'FINGERPRINT_REQUIRED' });

    try {
      const out = await tableQaService.markSuggestionInapplicable({
        tableId,
        organizationId: orgId,
        suggestionId,
        fingerprint,
        reason,
        dismissedBy: actorUserId,
      });
      return res.status(200).json({ data: out });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[TableQaRoutes] inapplicable failed', {
        tableId,
        suggestionId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
