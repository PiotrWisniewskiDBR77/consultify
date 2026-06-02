/**
 * Table Platform — Record Sources (Provenance) Routes (Block B · EPIC-T8)
 *
 * Standalone router so we don't bloat `table-platform.routes.ts`. Mount sits
 * alongside the relations-explain router; ordering is irrelevant because the
 * paths under this router are disjoint from any other table-platform routes.
 *
 * Endpoints:
 *   GET    /records/:recordId/sources           — list active sources
 *   POST   /records/:recordId/sources           — create source
 *   PATCH  /sources/:sourceId                   — update mutable fields
 *   POST   /sources/:sourceId/verify            — bump last_verified_at/by
 *   DELETE /sources/:sourceId                   — soft-delete (archive)
 *
 * AuthN: `verifyToken` (consistent with the rest of table-platform routes).
 * AuthZ: `PermissionsService.requireRecordAccess` for record-scoped routes;
 *        for source-scoped routes the service itself enforces tenant scoping
 *        via `organization_id` in every WHERE clause, and we additionally
 *        resolve source → record → table → base for role checks.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import permissionsService from '../services/tablePlatform/PermissionsService.js';
import recordSourcesService, {
  type SourceType,
} from '../services/tablePlatform/RecordSourcesService.js';

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

// Helper: map service errors to HTTP responses consistently.
function mapServiceError(err: unknown, res: Response): void {
  const code = (err as { code?: string }).code;
  const message = (err as Error).message;
  switch (code) {
    case 'INVALID_INPUT':
      res.status(400).json({ error: message, code });
      return;
    case 'RECORD_NOT_FOUND':
    case 'SOURCE_NOT_FOUND':
      res.status(404).json({ error: message, code });
      return;
    case 'RECORD_SOURCES_CAP_EXCEEDED':
      res.status(409).json({ error: message, code });
      return;
    case 'SOURCE_ARCHIVED':
      res.status(409).json({ error: message, code });
      return;
    default:
      res.status(500).json({ error: message || 'Internal error' });
      return;
  }
}

const VALID_SOURCE_TYPES: readonly SourceType[] = [
  'manual',
  'document',
  'presentation',
  'external_api',
  'ai_generated',
  'imported',
];

function parseSourceType(raw: unknown): SourceType | null {
  if (typeof raw !== 'string') return null;
  return (VALID_SOURCE_TYPES as readonly string[]).includes(raw) ? (raw as SourceType) : null;
}

function parseConfidence(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined; // not present in patch
  if (raw === null) return null;
  const n = typeof raw === 'string' ? Number(raw) : (raw as number);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

// Resolve a source's record so PermissionsService.requireRecordAccess can run.
// Falls through with 404 when the source doesn't exist OR doesn't belong to
// the actor's tenant (do NOT leak existence cross-tenant).
async function attachSourceRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthRequest;
  const sourceId = String(req.params.sourceId ?? '');
  const orgId = String(authReq.organizationId ?? '');
  if (!sourceId) {
    res.status(400).json({ error: 'sourceId required' });
    return;
  }
  try {
    const source = await recordSourcesService.getSource(sourceId, orgId);
    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }
    authReq.params.recordId = source.record_id;
    permissionsService.requireRecordAccess(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ── Record-scoped routes ─────────────────────────────────────────────────────

router.get(
  '/records/:recordId/sources',
  permissionsService.requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const recordId = String(req.params.recordId ?? '');
      const orgId = String(authReq.organizationId ?? '');

      const includeArchived = String(req.query.includeArchived ?? '') === 'true';
      const sourceTypeQuery = req.query.sourceType;
      let sourceTypes: SourceType[] | undefined;
      if (typeof sourceTypeQuery === 'string' && sourceTypeQuery.trim() !== '') {
        const parts = sourceTypeQuery
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const parsed: SourceType[] = [];
        for (const p of parts) {
          const t = parseSourceType(p);
          if (!t) {
            return res.status(400).json({ error: `Invalid sourceType: ${p}` });
          }
          parsed.push(t);
        }
        sourceTypes = parsed;
      }

      const items = await recordSourcesService.listSourcesForRecord(recordId, orgId, {
        includeArchived,
        sourceTypes,
      });
      return res.status(200).json(items);
    } catch (err) {
      mapServiceError(err, res);
    }
  }
);

router.post(
  '/records/:recordId/sources',
  permissionsService.requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const recordId = String(req.params.recordId ?? '');
      const orgId = String(authReq.organizationId ?? '');
      const userId = String(authReq.userId ?? authReq.user?.id ?? '');

      const sourceType = parseSourceType(req.body?.sourceType);
      if (!sourceType) {
        return res.status(400).json({
          error: `sourceType is required and must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
        });
      }

      const sourceUri =
        typeof req.body?.sourceUri === 'string' ? req.body.sourceUri.trim() || null : null;

      const sourceMetadata =
        req.body?.sourceMetadata && typeof req.body.sourceMetadata === 'object'
          ? (req.body.sourceMetadata as Record<string, unknown>)
          : {};

      const confidence = parseConfidence(req.body?.confidenceContribution);

      const created = await recordSourcesService.createSource({
        recordId,
        sourceType,
        sourceUri,
        sourceMetadata,
        confidenceContribution: confidence === undefined ? null : confidence,
        createdBy: userId,
        organizationId: orgId,
      });
      return res.status(201).json(created);
    } catch (err) {
      mapServiceError(err, res);
    }
  }
);

// ── Source-scoped routes ─────────────────────────────────────────────────────

router.patch('/sources/:sourceId', attachSourceRecord, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const sourceId = String(req.params.sourceId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const userId = String(authReq.userId ?? authReq.user?.id ?? '');

    const patch: {
      sourceUri?: string | null;
      sourceMetadata?: Record<string, unknown>;
      confidenceContribution?: number | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'sourceUri')) {
      const v = req.body.sourceUri;
      patch.sourceUri = typeof v === 'string' ? v.trim() || null : v == null ? null : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'sourceMetadata')) {
      const v = req.body.sourceMetadata;
      if (v != null && typeof v !== 'object') {
        return res.status(400).json({ error: 'sourceMetadata must be an object or null' });
      }
      patch.sourceMetadata = (v as Record<string, unknown>) ?? {};
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'confidenceContribution')) {
      const parsed = parseConfidence(req.body.confidenceContribution);
      if (parsed === undefined) {
        return res
          .status(400)
          .json({ error: 'confidenceContribution must be a number between 0 and 1, or null' });
      }
      patch.confidenceContribution = parsed;
    }

    const updated = await recordSourcesService.updateSource(sourceId, orgId, userId, patch);
    return res.status(200).json(updated);
  } catch (err) {
    mapServiceError(err, res);
  }
});

router.post(
  '/sources/:sourceId/verify',
  attachSourceRecord,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const sourceId = String(req.params.sourceId ?? '');
      const orgId = String(authReq.organizationId ?? '');
      const userId = String(authReq.userId ?? authReq.user?.id ?? '');

      const verified = await recordSourcesService.markVerified(sourceId, orgId, userId);
      return res.status(200).json(verified);
    } catch (err) {
      mapServiceError(err, res);
    }
  }
);

router.delete('/sources/:sourceId', attachSourceRecord, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const sourceId = String(req.params.sourceId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const userId = String(authReq.userId ?? authReq.user?.id ?? '');

    const archived = await recordSourcesService.deleteSource(sourceId, orgId, userId);
    return res.status(200).json(archived);
  } catch (err) {
    mapServiceError(err, res);
  }
});

export default router;
