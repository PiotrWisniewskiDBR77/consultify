/**
 * Table Platform — AI Editor Routes (Block C · EPIC-T10 · Sprint C-S1)
 *
 * Single additive router that exposes the 8-level AI Editor on top of the
 * `TableAiEditorService`. Lives in its own file so we never edit
 * `table-platform.routes.ts` (which is OUT OF SCOPE per Block C packet).
 *
 * Mount: app.use('/api/table-platform', tablePlatformAiEditorRoutes)
 * AFTER the existing `tablePlatformRoutes` mount.
 *
 * Endpoints (all require auth + organization context):
 *
 *   POST /tables/:tableId/ai-editor/propose
 *     Body: {
 *       level: 'cell' | 'record' | 'column' | 'structure'
 *            | 'view' | 'relational' | 'methodological' | 'source',
 *       prompt: string,
 *       context?: object,
 *       estimatedTokensInput?: number,
 *       estimatedTokensOutput?: number,
 *       model?: string,
 *     }
 *
 *   POST /ai-editor/proposals/:proposalId/apply
 *     Body: { workspaceId: string, idempotent?: boolean }
 *
 *   POST /ai-editor/proposals/:proposalId/reject
 *     Body: { workspaceId: string, note?: string }
 *
 *   GET  /ai-editor/budget?workspaceId=...
 *     Returns BudgetSnapshot.
 *
 * Cross-tenant safety: every route resolves workspaceId from URL/body and
 * cross-checks it belongs to the actor's organization via `tp_bases`.
 *
 * Feature flag: ENABLE_TABLE_AI_EDITOR (Q14 — disabled by default until C-S2
 * lands real handlers). Stub responses still flow when flag is on, which is
 * intentional so QA can exercise the audit/budget pipeline before C-S2.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import aiUsageService from '../services/tablePlatform/AiUsageService.js';
import tableAiEditorService, {
  AI_EDITOR_LEVELS,
  AiBudgetExhaustedError,
  TableAiEditorError,
} from '../services/tablePlatform/TableAiEditorService.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

// ── Middleware ───────────────────────────────────────────────────────────────

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

// Feature-flag gate. C-S1 ships the gate but stubs still respond when flag
// is on so QA can exercise the audit/budget pipeline before C-S2.
function requireAiEditorEnabled(req: Request, res: Response, next: NextFunction) {
  const flag = (featureFlags as unknown as Record<string, boolean | undefined>)
    .ENABLE_TABLE_AI_EDITOR;
  if (flag === false) {
    res.status(404).json({ error: 'AI Editor is not enabled', code: 'AI_EDITOR_DISABLED' });
    return;
  }
  next();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ResolvedWorkspace {
  workspaceId: string;
  organizationId: string;
}

async function resolveWorkspaceFromTable(
  tableId: string,
  organizationId: string
): Promise<ResolvedWorkspace | null> {
  const db = (await import('../database/Database.js')).getDatabase();
  const result = await db.query(
    `SELECT b.workspace_id, b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = result.rows?.[0] as { workspace_id?: string; organization_id?: string } | undefined;
  if (!row?.workspace_id || !row?.organization_id) return null;
  if (String(row.organization_id) !== String(organizationId)) return null;
  return { workspaceId: String(row.workspace_id), organizationId: String(row.organization_id) };
}

async function workspaceBelongsToOrganization(
  workspaceId: string,
  organizationId: string
): Promise<boolean> {
  const db = (await import('../database/Database.js')).getDatabase();
  const result = await db.query(
    'SELECT 1 FROM tp_bases WHERE workspace_id = $1 AND organization_id = $2 LIMIT 1',
    [workspaceId, organizationId]
  );
  return result.rows.length > 0;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asPositiveInt(v: unknown, def: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return def;
  const i = Math.floor(v);
  return Math.min(i, max);
}

function mapServiceError(e: unknown, res: Response): boolean {
  if (e instanceof AiBudgetExhaustedError) {
    res.set('Retry-After', String(e.retryAfterSeconds)).status(e.status).json({
      ...mapAppErrorResponse(e, undefined, 'error'),
      code: e.code,
      retryAfterSeconds: e.retryAfterSeconds,
    });
    return true;
  }
  if (e instanceof TableAiEditorError) {
    res.status(e.status).json({ ...mapAppErrorResponse(e, undefined, 'error'), code: e.code });
    return true;
  }
  return false;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.post(
  '/tables/:tableId/ai-editor/propose',
  requireAiEditorEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tableId = String(req.params.tableId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const actorUserId = String(authReq.userId ?? authReq.user?.id ?? '');

    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required' });
    }
    if (!orgId || !actorUserId) {
      return res.status(403).json({ error: 'Organization or user context missing' });
    }

    const resolved = await resolveWorkspaceFromTable(tableId, orgId);
    if (!resolved) {
      return res.status(404).json({ error: 'Table not found in this organization' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const level = body.level;
    const prompt = asString(body.prompt);
    if (typeof level !== 'string' || !(AI_EDITOR_LEVELS as readonly string[]).includes(level)) {
      return res.status(400).json({
        error: `level must be one of ${AI_EDITOR_LEVELS.join(', ')}`,
        code: 'INVALID_LEVEL',
      });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required', code: 'PROMPT_REQUIRED' });
    }

    const estimatedTokensInput = asPositiveInt(body.estimatedTokensInput, 500, 200_000);
    const estimatedTokensOutput = asPositiveInt(body.estimatedTokensOutput, 1_000, 200_000);
    const model = asString(body.model) ?? 'gpt-default';
    const context = (body.context as Record<string, unknown> | undefined) ?? {};

    try {
      const result = await tableAiEditorService.proposeEdit({
        tableId,
        level: level as (typeof AI_EDITOR_LEVELS)[number],
        prompt,
        context,
        workspaceId: resolved.workspaceId,
        organizationId: resolved.organizationId,
        actorUserId,
        actorIsSuperAdmin: Boolean(authReq.user?.isSuperAdmin),
        estimatedTokensInput,
        estimatedTokensOutput,
        model,
      });
      return res.status(202).json({ data: result });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[TableAiEditorRoutes] propose failed', {
        tableId,
        level,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.post(
  '/ai-editor/proposals/:proposalId/apply',
  requireAiEditorEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const proposalId = String(req.params.proposalId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const actorUserId = String(authReq.userId ?? authReq.user?.id ?? '');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const workspaceId = asString(body.workspaceId);
    const idempotent = body.idempotent === true;

    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId is required' });
    }
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    if (!(await workspaceBelongsToOrganization(workspaceId, orgId))) {
      return res.status(403).json({ error: 'Forbidden', code: 'TENANT_VIOLATION' });
    }

    try {
      const result = await tableAiEditorService.applyProposal({
        proposalId,
        workspaceId,
        organizationId: orgId,
        actorUserId,
        idempotent,
      });
      return res.status(200).json({ data: result });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[TableAiEditorRoutes] apply failed', {
        proposalId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.post(
  '/ai-editor/proposals/:proposalId/reject',
  requireAiEditorEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const proposalId = String(req.params.proposalId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    const actorUserId = String(authReq.userId ?? authReq.user?.id ?? '');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const workspaceId = asString(body.workspaceId);
    const note = asString(body.note) ?? undefined;

    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId is required' });
    }
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    if (!(await workspaceBelongsToOrganization(workspaceId, orgId))) {
      return res.status(403).json({ error: 'Forbidden', code: 'TENANT_VIOLATION' });
    }

    try {
      const result = await tableAiEditorService.rejectProposal({
        proposalId,
        workspaceId,
        actorUserId,
        note,
      });
      return res.status(200).json({ data: result });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[TableAiEditorRoutes] reject failed', {
        proposalId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.get('/ai-editor/budget', requireAiEditorEnabled, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const orgId = String(authReq.organizationId ?? '');
  const workspaceId = asString(req.query.workspaceId);
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }
  if (!(await workspaceBelongsToOrganization(workspaceId, orgId))) {
    return res.status(403).json({ error: 'Forbidden', code: 'TENANT_VIOLATION' });
  }

  try {
    const snapshot = await aiUsageService.getSnapshot(workspaceId);
    return res.status(200).json({ data: snapshot });
  } catch (e) {
    logger.error('[TableAiEditorRoutes] budget snapshot failed', {
      workspaceId,
      error: (e as Error)?.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
