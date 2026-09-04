/**
 * Table Platform — Source Pack Routes (Block C · EPIC-T12 · Sprint C-S6)
 *
 * Additive router that exposes `SourcePackBuilderService`. Mounted alongside
 * the AI Editor and QA routers under `/api/table-platform`. Stays in its own
 * file so we never touch `table-platform.routes.ts` (out-of-scope per the
 * Block C packet).
 *
 * Mount: app.use('/api/table-platform', tablePlatformSourcePackRoutes)
 *
 * Endpoints (all require auth + organization context, gated by
 * `ENABLE_TABLE_SOURCE_PACK`):
 *
 *   POST /tables/:tableId/source-pack/find-candidates
 *     Body: { query?: string, verifiedOnly?: boolean,
 *             recencyDays?: number|null, limit?: number }
 *     Returns ranked candidate records (max 100).
 *
 *   POST /tables/:tableId/source-pack/create
 *     Body: { name, description?, candidateRecordIds[] }
 *     Persists a new pack with a V8 snapshot.
 *
 *   GET  /source-packs/:packId
 *     Returns a single pack scoped to the actor's org.
 *
 *   GET  /tables/:tableId/source-packs
 *     Query: ?includeArchived=true&limit=50
 *     Lists packs scoped to the table.
 *
 *   GET  /workspaces/:workspaceId/source-packs
 *     Lists packs in a workspace (irrespective of table).
 *
 *   POST /source-packs/:packId/used
 *     Bumps `used_count` for analytics. AI Editor calls this when a proposal
 *     ultimately consumes the pack.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import sourcePackBuilderService, {
  SourcePackError,
} from '../services/tablePlatform/SourcePackBuilderService.js';
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

function requirePackEnabled(req: Request, res: Response, next: NextFunction) {
  const flag = (featureFlags as unknown as Record<string, boolean | undefined>)
    .ENABLE_TABLE_SOURCE_PACK;
  if (flag === false) {
    res
      .status(404)
      .json({ error: 'Source pack builder is not enabled', code: 'SOURCE_PACK_DISABLED' });
    return;
  }
  next();
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}

function asPositiveInt(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function mapServiceError(e: unknown, res: Response): boolean {
  if (e instanceof SourcePackError) {
    res.status(e.status).json({ ...mapAppErrorResponse(e, undefined, 'error'), code: e.code });
    return true;
  }
  return false;
}

router.post(
  '/tables/:tableId/source-pack/find-candidates',
  requirePackEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = asString(body.query) ?? undefined;
    const verifiedOnly = asBoolean(body.verifiedOnly);
    const recencyDays = body.recencyDays === null ? null : asPositiveInt(body.recencyDays);
    const limit = asPositiveInt(body.limit) ?? undefined;

    try {
      const candidates = await sourcePackBuilderService.findCandidates({
        tableId,
        organizationId: orgId,
        query,
        verifiedOnly,
        recencyDays,
        limit,
      });
      return res.status(200).json({ data: candidates });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[SourcePackRoutes] find-candidates failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.post(
  '/tables/:tableId/source-pack/create',
  requirePackEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const userId = String(authReq.userId ?? authReq.user?.id ?? '');
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    const description = asString(body.description) ?? undefined;
    const workspaceId = asString(body.workspaceId) ?? asString((authReq as any).workspaceId) ?? '';

    const rawIds = body.candidateRecordIds;
    const candidateRecordIds = Array.isArray(rawIds)
      ? (rawIds.filter((v) => typeof v === 'string' && v.length > 0) as string[])
      : [];

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (candidateRecordIds.length === 0)
      return res.status(400).json({ error: 'candidateRecordIds is required' });

    try {
      const pack = await sourcePackBuilderService.createPack({
        tableId,
        organizationId: orgId,
        workspaceId,
        ownerUserId: userId,
        name,
        description,
        candidateRecordIds,
      });
      return res.status(201).json({ data: pack });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[SourcePackRoutes] create failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get('/source-packs/:packId', requirePackEnabled, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const packId = String(req.params.packId ?? '');
  const orgId = String(authReq.organizationId ?? '');
  if (!packId) return res.status(400).json({ error: 'packId is required' });

  try {
    const pack = await sourcePackBuilderService.getPack(packId, orgId);
    if (!pack) return res.status(404).json({ error: 'Pack not found' });
    return res.status(200).json({ data: pack });
  } catch (e) {
    if (mapServiceError(e, res)) return;
    logger.error('[SourcePackRoutes] get failed', {
      packId,
      error: (e as Error)?.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.get(
  '/tables/:tableId/source-packs',
  requirePackEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const includeArchived = asBoolean(req.query.includeArchived);
    const limit = asPositiveInt(req.query.limit) ?? undefined;

    try {
      const packs = await sourcePackBuilderService.listPacks({
        organizationId: orgId,
        tableId,
        includeArchived,
        limit,
      });
      return res.status(200).json({ data: packs });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[SourcePackRoutes] list-by-table failed', {
        tableId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get(
  '/workspaces/:workspaceId/source-packs',
  requirePackEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workspaceId = String(req.params.workspaceId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    const includeArchived = asBoolean(req.query.includeArchived);
    const limit = asPositiveInt(req.query.limit) ?? undefined;

    try {
      const packs = await sourcePackBuilderService.listPacks({
        organizationId: orgId,
        workspaceId,
        includeArchived,
        limit,
      });
      return res.status(200).json({ data: packs });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[SourcePackRoutes] list-by-workspace failed', {
        workspaceId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.post(
  '/source-packs/:packId/used',
  requirePackEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const packId = String(req.params.packId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!packId) return res.status(400).json({ error: 'packId is required' });

    try {
      const out = await sourcePackBuilderService.markPackUsed(packId, orgId);
      return res.status(200).json({ data: out });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[SourcePackRoutes] mark-used failed', {
        packId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
