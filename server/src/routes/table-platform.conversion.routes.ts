/**
 * Table Platform — Artifact Conversion Routes (Block D · EPIC-T13 · Sprint D-S1)
 *
 * Additive router that exposes `TableArtifactConversionService`. Mounted
 * alongside the AI Editor / QA / Source Pack routers under
 * `/api/table-platform`. Stays in its own file so we never touch
 * `table-platform.routes.ts` (out-of-scope per the Block D packet).
 *
 * Mount: app.use('/api/table-platform', tablePlatformConversionRoutes)
 *
 * Endpoints (all require auth + organization context, gated by
 * `ENABLE_TABLE_ARTIFACT_CONVERSION`):
 *
 *   POST /tables/:tableId/convert
 *     Body: { target: 'document'|'presentation', workspaceId,
 *             sourcePackId?, title?, outline?, liveRecordCap? }
 *     Triggers a conversion run; returns `{ conversionId, status, artifactRunId, ... }`.
 *
 *   GET  /table-conversions/:conversionId
 *     Returns a single conversion scoped to the actor's org.
 *
 *   GET  /tables/:tableId/conversions
 *     Lists conversions for the table.
 *
 *   GET  /workspaces/:workspaceId/conversions
 *     Lists conversions in a workspace (irrespective of table).
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import tableArtifactConversionService, {
  type ConversionStatus,
  type ConversionTarget,
  TableConversionError,
} from '../services/tablePlatform/TableArtifactConversionService.js';
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

function requireConversionEnabled(req: Request, res: Response, next: NextFunction) {
  const flag = (featureFlags as unknown as Record<string, boolean | undefined>)
    .ENABLE_TABLE_ARTIFACT_CONVERSION;
  if (flag !== true) {
    res.status(404).json({
      error: 'Table artifact conversion is not enabled',
      code: 'TABLE_ARTIFACT_CONVERSION_DISABLED',
    });
    return;
  }
  next();
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asPositiveInt(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function mapServiceError(e: unknown, res: Response): boolean {
  if (e instanceof TableConversionError) {
    res.status(e.status).json({ ...mapAppErrorResponse(e, undefined, 'error'), code: e.code });
    return true;
  }
  return false;
}

router.post(
  '/tables/:tableId/convert',
  requireConversionEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const userId = String(authReq.userId ?? authReq.user?.id ?? '');
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const target = body.target as ConversionTarget;
    const workspaceId = asString(body.workspaceId) ?? asString((authReq as any).workspaceId) ?? '';
    const sourcePackId = asString(body.sourcePackId) ?? undefined;
    const title = asString(body.title) ?? undefined;
    const liveRecordCap = asPositiveInt(body.liveRecordCap) ?? undefined;
    const outline = Array.isArray(body.outline)
      ? (body.outline as Array<{ heading: string; bodyHint?: string }>)
      : undefined;

    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    try {
      const result = await tableArtifactConversionService.convertTable({
        tableId,
        organizationId: orgId,
        workspaceId,
        initiatedBy: userId,
        target,
        sourcePackId,
        title,
        outline,
        liveRecordCap,
      });
      // 202 because the materialize step is asynchronous in spirit even though
      // the current stub completes synchronously. Once D-S3 wires the real
      // materializer the lifecycle may genuinely run in the background.
      const statusCode = result.status === 'failed' ? 502 : 202;
      return res.status(statusCode).json({ data: result });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[ConversionRoutes] convert failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get(
  '/table-conversions/:conversionId',
  requireConversionEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const conversionId = String(req.params.conversionId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!conversionId) return res.status(400).json({ error: 'conversionId is required' });

    try {
      const row = await tableArtifactConversionService.getConversion(conversionId, orgId);
      if (!row) return res.status(404).json({ error: 'Conversion not found' });
      return res.status(200).json({ data: row });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[ConversionRoutes] get failed', {
        conversionId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get(
  '/tables/:tableId/conversions',
  requireConversionEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const status = asString(req.query.status) as ConversionStatus | null;
    const limit = asPositiveInt(req.query.limit) ?? undefined;

    try {
      const rows = await tableArtifactConversionService.listConversions({
        organizationId: orgId,
        tableId,
        status: status ?? undefined,
        limit,
      });
      return res.status(200).json({ data: rows });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[ConversionRoutes] list-by-table failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get(
  '/workspaces/:workspaceId/conversions',
  requireConversionEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workspaceId = String(req.params.workspaceId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    const status = asString(req.query.status) as ConversionStatus | null;
    const limit = asPositiveInt(req.query.limit) ?? undefined;

    try {
      const rows = await tableArtifactConversionService.listConversions({
        organizationId: orgId,
        workspaceId,
        status: status ?? undefined,
        limit,
      });
      return res.status(200).json({ data: rows });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[ConversionRoutes] list-by-workspace failed', {
        workspaceId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
