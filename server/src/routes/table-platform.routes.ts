/**
 * Table Platform API Routes
 * Bases, tables, fields, views, and records CRUD
 */

import { NextFunction, Request as ExpressRequest, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';

import { featureFlags } from '../config/FeatureFlags.js';
import { getDatabase } from '../database/Database.js';
import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { automationService } from '../services/tablePlatform/AutomationService.js';
import { handleRouteError } from '../services/tablePlatform/ErrorHandling.js';
import { extensionService } from '../services/tablePlatform/ExtensionService.js';
import { interfaceService } from '../services/tablePlatform/InterfaceService.js';
import MetadataService from '../services/tablePlatform/MetadataService.js';
import PermissionsService from '../services/tablePlatform/PermissionsService.js';
import ProjectionService from '../services/tablePlatform/ProjectionService.js';
import RecordsService from '../services/tablePlatform/RecordsService.js';
import {
  scheduledAutomationExecutor,
  validateCronExpression,
} from '../services/tablePlatform/ScheduledAutomationExecutor.js';
import { scimService } from '../services/tablePlatform/SCIMService.js';
import { serviceAccountService } from '../services/tablePlatform/ServiceAccountService.js';
import { ssoService } from '../services/tablePlatform/SSOService.js';
import { webhookDispatcher } from '../services/tablePlatform/WebhookDispatcherService.js';
import { webhookRelayService } from '../services/tablePlatform/WebhookRelayService.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const {
  requireBaseAccess,
  requireTableAccess,
  requireFieldAccess,
  requireRecordAccess,
  requireViewAccess,
  requireGovernedModelAccess,
  requireRoles,
  requireRole,
  SCHEMA_ROLES,
  DATA_ROLES,
  VIEW_ROLES,
  INTERFACE_ROLES,
  ALL_ROLES,
} = PermissionsService;

const router = Router();
type Request = ExpressRequest<Record<string, string>>;

/**
 * SECURITY: resolve the caller's effective base role for a table, for
 * field-read masking on record-list/query routes. These routes intentionally
 * gate with requireTableAccess (any table member may read), not requireRoles,
 * so no middleware has resolved req.userRole yet — without this, ViewQueryEngine
 * and RecordsService's field-permission masking (both already implemented)
 * silently never fire, and role-restricted columns leak to every reader.
 * Resolution failure fails OPEN (returns undefined = no masking applied),
 * matching today's behavior — this only ADDS masking for callers where a role
 * resolves; it does not change access-denial semantics (requireTableAccess
 * already gated that).
 */
export async function resolveUserRoleForTable(
  tableId: string,
  userId: string,
  orgId: string
): Promise<string | undefined> {
  try {
    const db = getDatabase();
    const r = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
    const baseId = (r.rows[0] as { base_id?: string })?.base_id;
    if (!baseId) return undefined;
    // NOTE: call via the PermissionsService object (not the destructured
    // `requireRole` binding above) — requireRole's body calls
    // `this.getUserRole`/`this.canAccessBase`, and the destructuring at the
    // top of this file strips that `this` binding, which made every call
    // here throw "Cannot read properties of undefined (reading
    // 'getUserRole')" and fail open (see the catch block below).
    const { role } = await PermissionsService.requireRole(baseId, userId, orgId, ALL_ROLES);
    return role ?? undefined;
  } catch (e) {
    logger.warn('[TablePlatform] resolveUserRoleForTable failed', {
      tableId,
      error: (e as Error).message,
    });
    return undefined;
  }
}

// Cache schema readiness to avoid per-request DB check
let _schemaReady: boolean | null = null;
let _schemaCheckAt = 0;
const SCHEMA_CHECK_TTL_MS = 30_000; // recheck every 30s if not ready

async function checkSchemaReady(): Promise<boolean> {
  const now = Date.now();
  if (_schemaReady === true) return true; // once ready, stays ready
  if (_schemaReady !== null && now - _schemaCheckAt < SCHEMA_CHECK_TTL_MS) return _schemaReady;

  try {
    const db = (await import('../database/Database.js')).getDatabase();
    await db.query('SELECT 1 FROM tp_bases LIMIT 0');
    _schemaReady = true;
  } catch {
    _schemaReady = false;
  }
  _schemaCheckAt = now;
  return _schemaReady;
}

function requireTablePlatform(req: Request, res: Response, next: () => void) {
  if (!featureFlags.ENABLE_TABLE_PLATFORM_RECORDS_API) {
    return res.status(404).json({ error: 'Table platform is not enabled' });
  }
  // Check schema readiness (async but non-blocking for perf after first check)
  checkSchemaReady()
    .then((ready) => {
      if (!ready) {
        return res.status(503).json({
          error: 'Table platform schema is not initialized. Migrations may be pending.',
          code: 'SCHEMA_NOT_READY',
        });
      }
      next();
    })
    .catch((err: unknown) => {
      // Without this catch a rejected readiness check left the request hanging
      // forever (no response, no next()). Fail closed with a clear 503.
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[TablePlatform] schema readiness check failed: ${msg}`);
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Table platform schema readiness check failed.',
          code: 'SCHEMA_CHECK_FAILED',
        });
      }
    });
}

const tablePlatformLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', retryAfterMs: 1000 },
  keyGenerator: (req) => {
    const authReq = req as any;
    if (authReq.userId) return `u:${authReq.userId}`;
    return `ip:${ipKeyGenerator(String(req.ip || ''))}`;
  },
});

async function checkOrgQuota(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = (req as any).organizationId;
    if (!orgId) return next();

    const db = (await import('../database/Database.js')).getDatabase();

    const usage = await db.query(
      `
      SELECT COUNT(*) as record_count
      FROM tp_records r
      JOIN tp_tables t ON r.table_id = t.id
      JOIN tp_bases b ON t.base_id = b.id
      WHERE b.organization_id = $1
    `,
      [orgId]
    );

    const recordCount = parseInt((usage.rows[0] as any)?.record_count || '0', 10);

    let maxRecords = 100000;
    try {
      const orgPlan = await db.query('SELECT plan_config FROM organizations WHERE id = $1', [
        orgId,
      ]);
      const config = (orgPlan.rows[0] as any)?.plan_config;
      if (config?.maxTableRecords) {
        maxRecords = config.maxTableRecords;
      }
    } catch {
      // organizations table may not have plan_config — use default
    }

    if (recordCount >= maxRecords) {
      return res.status(429).json({
        error: 'Record limit reached for your organization plan',
        usage: recordCount,
        limit: maxRecords,
      });
    }

    next();
  } catch {
    next();
  }
}

function extractBaseIdFromSchemaProposalOperations(operations: unknown): string | null {
  const parsed = typeof operations === 'string' ? JSON.parse(operations) : operations;
  if (!Array.isArray(parsed)) return null;
  for (const op of parsed) {
    const target = (op as { target?: Record<string, unknown> } | null)?.target;
    const baseId = target?.base_id ?? target?.baseId;
    if (typeof baseId === 'string' && baseId && !baseId.startsWith('@ref:')) return baseId;
  }
  return null;
}

async function resolveSchemaProposalBaseId(proposalId: string): Promise<string | null> {
  const db = (await import('../database/Database.js')).getDatabase();
  const proposalResult = await db.query(
    'SELECT workspace_id, operations FROM tp_schema_proposals WHERE id = $1',
    [proposalId]
  );
  const proposal = proposalResult.rows[0] as
    | { workspace_id?: string; operations?: string | unknown[] }
    | undefined;
  if (!proposal) return null;

  const baseIdFromOperations = extractBaseIdFromSchemaProposalOperations(proposal.operations);
  if (baseIdFromOperations) return baseIdFromOperations;

  if (!proposal.workspace_id) return null;
  const baseResult = await db.query(
    'SELECT id FROM tp_bases WHERE workspace_id = $1 ORDER BY created_at ASC LIMIT 1',
    [proposal.workspace_id]
  );
  return (baseResult.rows[0] as { id?: string } | undefined)?.id ?? null;
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

function requireWorkspaceTenantAccess(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const workspaceId = authReq.params?.workspaceId ?? authReq.body?.workspaceId;
  const orgId = authReq.organizationId;
  if (!orgId) {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }
  if (!workspaceId || typeof workspaceId !== 'string') {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }
  workspaceBelongsToOrganization(workspaceId, orgId)
    .then((allowed) => {
      if (!allowed) {
        res.status(403).json({ error: 'Access denied to this workspace' });
        return;
      }
      next();
    })
    .catch(next);
}

function requireSchemaProposalAccess(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const orgId = authReq.organizationId;
  const proposalId = authReq.params?.proposalId;
  if (!userId || !orgId) {
    res.status(403).json({ error: 'Authentication and organization context required' });
    return;
  }
  if (!proposalId) {
    res.status(400).json({ error: 'proposalId is required' });
    return;
  }

  resolveSchemaProposalBaseId(proposalId)
    .then(async (baseId) => {
      if (!baseId) {
        res.status(404).json({ error: 'Proposal not found or base cannot be resolved' });
        return;
      }
      (authReq as any).resolvedBaseId = baseId;
      const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
      if (!allowed) {
        res.status(403).json({ error: 'Access denied to this schema proposal' });
        return;
      }
      next();
    })
    .catch(next);
}

// ==========================================
// HEALTH CHECK (no auth required)
// ==========================================
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = (await import('../database/Database.js')).getDatabase();
    const checks: Record<string, string> = {};

    // Check core tp_bases table
    await db.query('SELECT 1 FROM tp_bases LIMIT 0');
    checks.tp_bases = 'ok';

    // Check migration history
    const migResult = await db.query('SELECT COUNT(*) as cnt FROM tp_migration_history');
    checks.migrations_applied = String((migResult.rows[0] as any)?.cnt || 0);

    // Spot-check a few more critical tables
    for (const table of ['tp_tables', 'tp_fields', 'tp_views', 'tp_records']) {
      try {
        await db.query(`SELECT 1 FROM ${table} LIMIT 0`);
        checks[table] = 'ok';
      } catch {
        checks[table] = 'missing';
      }
    }

    const allOk = Object.values(checks).every((v) => v === 'ok' || /^\d+$/.test(v));
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'healthy' : 'degraded',
      platform: 'table-platform',
      checks,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unavailable',
      platform: 'table-platform',
      error: err?.message || 'Unknown error',
    });
  }
});

router.use(verifyToken as any);
router.use(requireTablePlatform);
router.use(tablePlatformLimiter);

// ==========================================
// GLOBAL SEARCH
// ==========================================

router.get('/search', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const orgId = authReq.organizationId;
    const q = req.query.q as string;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (!q || q.length < 2) return res.json({ results: [] });
    const db = (await import('../database/Database.js')).getDatabase();
    const results = await db.query(
      `
      SELECT r.id as record_id, r.data, t.id as table_id, t.name as table_name,
             b.id as base_id, b.name as base_name, b.workspace_id
      FROM tp_records r
      JOIN tp_tables t ON r.table_id = t.id
      JOIN tp_bases b ON t.base_id = b.id
      WHERE b.organization_id = $1 AND r.data::text ILIKE $2
      ORDER BY r.updated_at DESC LIMIT $3
    `,
      [orgId, `%${q}%`, limit]
    );
    res.json({
      results: results.rows.map((r: any) => ({
        recordId: r.record_id,
        data: r.data,
        tableId: r.table_id,
        tableName: r.table_name,
        baseId: r.base_id,
        baseName: r.base_name,
        workspaceId: r.workspace_id,
        deepLink: `/my-work/ideas/${encodeURIComponent(r.workspace_id)}/workspace/table?tpTable=${encodeURIComponent(r.table_id)}`,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ==========================================
// METADATA API
// ==========================================

router.post('/bases', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const organizationId = authReq.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'Organization context required' });
    }
    const { workspaceId, name: rawName } = req.body ?? {};
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
    // middleware escaped, before storing.
    const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;
    const base = await MetadataService.createBase(
      workspaceId,
      organizationId,
      name ?? 'Untitled base',
      userId
    );
    if (!base) {
      return res.status(500).json({ error: 'Failed to create base' });
    }
    return res.status(201).json(base);
  } catch (err) {
    handleRouteError(err, res, 'createBase');
  }
});

router.post(
  '/bases/:baseId/sync-members',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId } = req.params;
      const orgId = (req as any).organizationId;
      const OrgMemberSyncService = (
        await import('../services/tablePlatform/OrgMemberSyncService.js')
      ).default;
      const result = await OrgMemberSyncService.syncOrgMembersToBase(baseId, orgId);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get('/bases/:baseId', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    if (!baseId) {
      return res.status(400).json({ error: 'baseId is required' });
    }
    const base = await MetadataService.getBase(baseId);
    if (!base) {
      return res.status(404).json({ error: 'Base not found' });
    }
    return res.status(200).json(base);
  } catch (err) {
    handleRouteError(err, res, 'getBase');
  }
});

router.patch('/bases/:baseId', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    const { name: rawName } = req.body ?? {};
    if (!baseId) {
      return res.status(400).json({ error: 'baseId is required' });
    }
    // T5 (Z139 follow-up): decode HTML entities before storing — see createBase.
    const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;
    const base = await MetadataService.updateBase(baseId, { name }, authReq.userId);
    if (!base) {
      return res.status(404).json({ error: 'Base not found' });
    }
    return res.status(200).json(base);
  } catch (err) {
    handleRouteError(err, res, 'updateBase');
  }
});

router.delete('/bases/:baseId', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    if (!baseId) {
      return res.status(400).json({ error: 'baseId is required' });
    }
    const ok = await MetadataService.deleteBase(baseId, authReq.userId);
    if (!ok) {
      return res.status(404).json({ error: 'Base not found' });
    }
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteBase');
  }
});

// ── Global Base Search ────────────────────────────────────────────────────────

router.get('/bases/:baseId/search', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      return res.status(400).json({ error: 'q (search query) is required' });
    }
    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10), 200) : 50;
    const results = await RecordsService.searchAcrossBase(baseId, q, limit);
    return res.status(200).json({ results });
  } catch (err) {
    handleRouteError(err, res, 'searchAcrossBase');
  }
});

router.post('/bases/:baseId/duplicate', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    const { name } = req.body ?? {};
    if (!baseId) {
      return res.status(400).json({ error: 'baseId is required' });
    }
    const newBase = await MetadataService.duplicateBase(baseId, name ?? 'Copy', authReq.userId);
    if (!newBase) {
      return res.status(404).json({ error: 'Base not found' });
    }
    return res.status(201).json(newBase);
  } catch (err) {
    handleRouteError(err, res, 'duplicateBase');
  }
});

router.post(
  '/tables/:tableId/duplicate',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { name } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      const newTable = await MetadataService.duplicateTable(
        tableId,
        name ?? 'Copy',
        authReq.userId
      );
      if (!newTable) {
        return res.status(404).json({ error: 'Table not found' });
      }
      return res.status(201).json(newTable);
    } catch (err) {
      handleRouteError(err, res, 'duplicateTable');
    }
  }
);

router.get('/workspaces/:workspaceId/bases', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    const organizationId = (req as any).organizationId as string | undefined;
    const bases = await MetadataService.listBases(workspaceId, organizationId);
    return res.status(200).json(bases);
  } catch (err) {
    handleRouteError(err, res, 'listBases');
  }
});

router.post(
  '/bases/:baseId/tables',
  requireBaseAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { baseId } = req.params;
      const { name: rawName, description: rawDescription } = req.body ?? {};
      if (!baseId) {
        return res.status(400).json({ error: 'baseId is required' });
      }
      if (!rawName || typeof rawName !== 'string') {
        return res.status(400).json({ error: 'name is required' });
      }
      // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
      // middleware escaped, before storing.
      const name = decodeHtmlEntities(rawName);
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
      const table = await MetadataService.createTable(baseId, name, description, userId);
      if (!table) {
        return res.status(500).json({ error: 'Failed to create table' });
      }
      return res.status(201).json(table);
    } catch (err) {
      handleRouteError(err, res, 'createTable');
    }
  }
);

router.patch(
  '/tables/:tableId',
  requireTableAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { name: rawName, description: rawDescription } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      // T5 (Z139 follow-up): decode HTML entities before storing — see createTable.
      const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
      const table = await MetadataService.updateTable(
        tableId,
        { name, description },
        authReq.userId
      );
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      return res.status(200).json(table);
    } catch (err) {
      handleRouteError(err, res, 'updateTable');
    }
  }
);

router.delete(
  '/tables/:tableId',
  requireTableAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      const ok = await MetadataService.deleteTable(tableId, authReq.userId);
      if (!ok) {
        return res.status(404).json({ error: 'Table not found' });
      }
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'deleteTable');
    }
  }
);

router.get('/tables/:tableId', requireTableAccess, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required' });
    }
    const table = await MetadataService.getTable(tableId);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    return res.status(200).json(table);
  } catch (err) {
    handleRouteError(err, res, 'getTable');
  }
});

router.post(
  '/tables/:tableId/fields',
  requireTableAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      const { name, fieldType, options } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
      }
      if (!fieldType || typeof fieldType !== 'string') {
        return res.status(400).json({ error: 'fieldType is required' });
      }
      const field = await MetadataService.createField(
        tableId,
        name,
        fieldType,
        options ?? undefined,
        userId
      );
      if (!field) {
        return res.status(500).json({ error: 'Failed to create field' });
      }
      return res.status(201).json(field);
    } catch (err) {
      handleRouteError(err, res, 'createField');
    }
  }
);

router.delete(
  '/fields/:fieldId',
  requireFieldAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { fieldId } = req.params;
      if (!fieldId) {
        return res.status(400).json({ error: 'fieldId is required' });
      }
      const ok = await MetadataService.deleteField(fieldId, authReq.userId);
      if (!ok) {
        return res.status(404).json({ error: 'Field not found' });
      }
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'deleteField');
    }
  }
);

router.patch(
  '/fields/:fieldId',
  requireFieldAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { fieldId } = req.params;
      const { name, options } = req.body ?? {};
      if (!fieldId) {
        return res.status(400).json({ error: 'fieldId is required' });
      }
      const field = await MetadataService.updateField(fieldId, { name, options });
      if (!field) {
        return res.status(404).json({ error: 'Field not found' });
      }
      return res.status(200).json(field);
    } catch (err) {
      handleRouteError(err, res, 'updateField');
    }
  }
);

router.post(
  '/fields/:fieldId/change-type',
  requireFieldAccess,
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { fieldId } = req.params;
      const { newType, options, preview } = req.body ?? {};
      if (!fieldId) return res.status(400).json({ error: 'fieldId is required' });
      if (!newType || typeof newType !== 'string') {
        return res.status(400).json({ error: 'newType is required' });
      }
      const result = await MetadataService.changeFieldType(
        fieldId,
        newType,
        authReq.userId!,
        options,
        preview
      );
      return res.status(200).json(result);
    } catch (err) {
      handleRouteError(err, res, 'changeFieldType');
    }
  }
);

router.patch(
  '/fields/:fieldId/permissions',
  requireFieldAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { fieldId } = req.params;
      const { readRoles, writeRoles } = req.body ?? {};
      if (!fieldId) {
        return res.status(400).json({ error: 'fieldId is required' });
      }
      if (!Array.isArray(readRoles) && !Array.isArray(writeRoles)) {
        return res.status(400).json({ error: 'readRoles or writeRoles array is required' });
      }

      const db = (await import('../database/Database.js')).getDatabase();
      const existing = await db.query('SELECT id, options FROM tp_fields WHERE id = $1', [fieldId]);
      if (!existing.rows[0]) {
        return res.status(404).json({ error: 'Field not found' });
      }

      const permissions: Record<string, string[]> = {};
      if (Array.isArray(readRoles)) permissions.readRoles = readRoles;
      if (Array.isArray(writeRoles)) permissions.writeRoles = writeRoles;

      await db.query(
        `UPDATE tp_fields SET options = jsonb_set(
        COALESCE(options, '{}'),
        '{permissions}',
        $2::jsonb
      ), updated_at = NOW() WHERE id = $1`,
        [fieldId, JSON.stringify(permissions)]
      );

      const AuditService = (await import('../services/tablePlatform/AuditService.js')).default;
      await AuditService.logEvent(
        'permissions_changed',
        'field',
        fieldId,
        authReq.userId,
        (existing.rows[0] as any)?.options?.permissions ?? null,
        permissions,
        { readRoles, writeRoles }
      );

      const updated = await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId]);
      return res.status(200).json(updated.rows[0]);
    } catch (err) {
      handleRouteError(err, res, 'setFieldPermissions');
    }
  }
);

router.post(
  '/tables/:tableId/views',
  requireTableAccess,
  requireRoles(...VIEW_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      const { name, viewType, config, isPersonal } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
      }
      const view = await MetadataService.createView(
        tableId,
        name,
        viewType ?? 'grid',
        config,
        userId,
        !!isPersonal,
        isPersonal ? userId : undefined
      );
      if (!view) {
        return res.status(500).json({ error: 'Failed to create view' });
      }
      return res.status(201).json(view);
    } catch (err) {
      handleRouteError(err, res, 'createView');
    }
  }
);

router.patch(
  '/views/:viewId',
  requireViewAccess,
  requireRoles(...VIEW_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { viewId } = req.params;
      const { name, config, visibleFieldIds } = req.body ?? {};
      if (!viewId) {
        return res.status(400).json({ error: 'viewId is required' });
      }
      const view = await MetadataService.updateView(viewId, { name, config, visibleFieldIds });
      if (!view) {
        return res.status(404).json({ error: 'View not found' });
      }
      return res.status(200).json(view);
    } catch (err) {
      handleRouteError(err, res, 'updateView');
    }
  }
);

router.delete(
  '/views/:viewId',
  requireViewAccess,
  requireRoles(...VIEW_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { viewId } = req.params;
      if (!viewId) {
        return res.status(400).json({ error: 'viewId is required' });
      }
      const ok = await MetadataService.deleteView(viewId, authReq.userId);
      if (!ok) {
        return res.status(404).json({ error: 'View not found' });
      }
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'deleteView');
    }
  }
);

// ==========================================
// WORKSPACE PROJECTION / RESOLVE
// ==========================================

router.get('/resolve/:ideaId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    const userId = authReq.userId;
    const { ideaId } = req.params;
    if (!ideaId) {
      return res.status(400).json({ error: 'ideaId is required' });
    }
    if (!organizationId) {
      return res.status(403).json({ error: 'Organization context required' });
    }
    if (!userId) {
      return res.status(401).json({ error: 'User context required' });
    }
    const resolved = await ProjectionService.resolveBaseId(ideaId, organizationId, userId);
    if (!resolved) {
      return res.status(404).json({ error: 'No table platform base found for this idea' });
    }
    return res.status(200).json(resolved);
  } catch (err) {
    handleRouteError(err, res, 'resolveIdeaId');
  }
});

// ==========================================
// FORMULA VALIDATION
// ==========================================

router.post(
  '/tables/:tableId/validate-formula',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableId } = req.params;
      const { formula } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!formula || typeof formula !== 'string') {
        return res.status(400).json({ error: 'formula string is required' });
      }
      const { validateFormula } = await import('../services/tablePlatform/formulaEngine.js');
      const result = await validateFormula(tableId, formula);
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[TablePlatform] validate-formula failed', { error: (e as Error).message });
      return res
        .status(500)
        .json({ error: 'Formula validation failed', details: (e as Error).message });
    }
  }
);

// ==========================================
// RECORDS API
// ==========================================

router.get('/tables/:tableId/records', requireTableAccess, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const { viewId, pageSize, cursor, filters, sorts, fields, filterByFormula } = req.query;
    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required' });
    }
    const authReq = req as AuthRequest;
    const userRole = await resolveUserRoleForTable(
      tableId,
      authReq.userId!,
      authReq.organizationId!
    );

    if (typeof filterByFormula === 'string' && filterByFormula.trim()) {
      const ViewQueryEngine = (await import('../services/tablePlatform/ViewQueryEngine.js'))
        .default;
      const result = await ViewQueryEngine.executeQuery({
        tableId,
        viewId: typeof viewId === 'string' ? viewId : undefined,
        filterByFormula,
        pageSize: pageSize !== undefined ? parseInt(String(pageSize), 10) : undefined,
        cursor: typeof cursor === 'string' ? cursor : undefined,
        userRole,
      });
      return res.status(200).json(result);
    }

    const options: NonNullable<Parameters<typeof RecordsService.listRecords>[1]> = {};
    if (typeof viewId === 'string') options.viewId = viewId;
    if (pageSize !== undefined) options.pageSize = parseInt(String(pageSize), 10);
    if (typeof cursor === 'string') options.cursor = cursor;
    options.userRole = userRole;
    if (typeof filters === 'string') {
      try {
        options.filters = JSON.parse(filters);
      } catch {
        /* ignore */
      }
    }
    if (typeof sorts === 'string') {
      try {
        options.sorts = JSON.parse(sorts);
      } catch {
        /* ignore */
      }
    }
    if (typeof fields === 'string') {
      try {
        options.fields = JSON.parse(fields);
      } catch {
        options.fields = fields
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }
    }
    const result = await RecordsService.listRecords(tableId, options);
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'listRecords');
  }
});

router.post(
  '/tables/:tableId/records',
  requireTableAccess,
  requireRoles(...DATA_ROLES),
  checkOrgQuota as any,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      const { data } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'data is required' });
      }
      const record = await RecordsService.createRecord(tableId, data, userId);
      if (!record) {
        return res.status(500).json({ error: 'Failed to create record' });
      }
      return res.status(201).json(record);
    } catch (err) {
      handleRouteError(err, res, 'createRecord');
    }
  }
);

router.get('/records/:recordId', requireRecordAccess, async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    if (!recordId) {
      return res.status(400).json({ error: 'recordId is required' });
    }
    const record = await RecordsService.getRecord(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(200).json(record);
  } catch (err) {
    handleRouteError(err, res, 'getRecord');
  }
});

router.patch(
  '/records/:recordId',
  requireRecordAccess,
  requireRoles(...DATA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { recordId } = req.params;
      const { data } = req.body ?? {};
      if (!recordId) {
        return res.status(400).json({ error: 'recordId is required' });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'data is required' });
      }
      const record = await RecordsService.updateRecord(recordId, data, userId);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }
      return res.status(200).json(record);
    } catch (err) {
      handleRouteError(err, res, 'updateRecord');
    }
  }
);

router.delete(
  '/records/:recordId',
  requireRecordAccess,
  requireRoles(...DATA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { recordId } = req.params;
      if (!recordId) {
        return res.status(400).json({ error: 'recordId is required' });
      }
      const ok = await RecordsService.deleteRecord(recordId, userId);
      if (!ok) {
        return res.status(404).json({ error: 'Record not found' });
      }
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'deleteRecord');
    }
  }
);

// ==========================================
// VALIDATION STATUS (Block B · EPIC-T9)
// ==========================================
//
// Flips a record's validation_status with a state-machine guard. Audit
// trail is written by the service. Confidence recompute is triggered as a
// side-effect inside the service (best-effort).

router.post(
  '/records/:recordId/validation-status',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { recordId } = req.params;
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });

      const rawStatus = req.body?.status;
      if (rawStatus !== 'unverified' && rawStatus !== 'verified' && rawStatus !== 'flagged') {
        return res.status(400).json({
          error: "status must be one of 'unverified' | 'verified' | 'flagged'",
        });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const validationSvc = (await import('../services/tablePlatform/ValidationStatusService.js'))
        .default;
      const result = await validationSvc.setStatus(recordId, rawStatus, {
        actorUserId: String(authReq.userId ?? authReq.user?.id ?? ''),
        isSuperAdmin: Boolean(authReq.user?.isSuperAdmin),
        note,
      });
      return res.status(200).json(result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as Error).message;
      if (code === 'INVALID_INPUT') {
        return res.status(400).json({ error: message, code });
      }
      if (code === 'RECORD_NOT_FOUND') {
        return res.status(404).json({ error: message, code });
      }
      if (code === 'INVALID_VALIDATION_TRANSITION') {
        return res.status(409).json({ error: message, code });
      }
      if (code === 'TRANSITION_REQUIRES_SUPER_ADMIN') {
        return res.status(403).json({ error: message, code });
      }
      handleRouteError(err, res, 'setValidationStatus');
    }
  }
);

router.get(
  '/records/:recordId/validation-status/transitions',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      const validationSvc = (await import('../services/tablePlatform/ValidationStatusService.js'))
        .default;
      const current = await validationSvc.getStatus(recordId);
      if (current === null) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({
        current,
        allowed: validationSvc.getAllowedTransitions(current),
      });
    } catch (err) {
      handleRouteError(err, res, 'getValidationStatusTransitions');
    }
  }
);

// ==========================================
// RECORD COMMENTS
// ==========================================

router.post(
  '/records/:recordId/comments',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { recordId } = req.params;
      const { tableId, content, parentId, authorName, mentions } = req.body ?? {};
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'content is required' });
      }
      const mentionList = Array.isArray(mentions)
        ? mentions
            .filter((m: unknown) => typeof m === 'string' && m.trim().length > 0)
            .map((m: string) => m.trim())
        : [];
      const RecordCommentService = (
        await import('../services/tablePlatform/RecordCommentService.js')
      ).default;
      const comment = await RecordCommentService.addComment(
        recordId,
        tableId,
        userId!,
        authorName,
        content.trim(),
        parentId,
        mentionList.length ? mentionList : undefined
      );
      return res.status(201).json(comment);
    } catch (err) {
      handleRouteError(err, res, 'addComment');
    }
  }
);

router.get(
  '/records/:recordId/comments',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      const limit = parseInt(String(req.query.limit ?? '50'), 10);
      const offset = parseInt(String(req.query.offset ?? '0'), 10);
      const RecordCommentService = (
        await import('../services/tablePlatform/RecordCommentService.js')
      ).default;
      const result = await RecordCommentService.listComments(recordId, limit, offset);
      return res.status(200).json(result);
    } catch (err) {
      handleRouteError(err, res, 'listComments');
    }
  }
);

router.patch('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const { commentId } = req.params;
    const { content } = req.body ?? {};
    if (!commentId) return res.status(400).json({ error: 'commentId is required' });
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    const RecordCommentService = (await import('../services/tablePlatform/RecordCommentService.js'))
      .default;
    const comment = await RecordCommentService.updateComment(commentId, userId!, content.trim());
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    return res.status(200).json(comment);
  } catch (err) {
    handleRouteError(err, res, 'updateComment');
  }
});

router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const { commentId } = req.params;
    if (!commentId) return res.status(400).json({ error: 'commentId is required' });
    const RecordCommentService = (await import('../services/tablePlatform/RecordCommentService.js'))
      .default;
    const ok = await RecordCommentService.deleteComment(commentId, userId!);
    if (!ok) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteComment');
  }
});

// ==========================================
// RECORD UNDO
// ==========================================

router.post(
  '/tables/:tableId/undo',
  requireRoles(...DATA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const record = await RecordsService.undoLastEdit(tableId, userId);
      if (!record) {
        return res.status(404).json({ error: 'Nothing to undo' });
      }
      return res.status(200).json(record);
    } catch (err) {
      handleRouteError(err, res, 'undoLastEdit');
    }
  }
);

// ==========================================
// CELL HISTORY
// ==========================================

router.get(
  '/records/:recordId/cell-history',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      const fieldId = typeof req.query.fieldId === 'string' ? req.query.fieldId : undefined;
      const limit = parseInt(String(req.query.limit ?? '50'), 10);
      const offset = parseInt(String(req.query.offset ?? '0'), 10);
      const AuditService = (await import('../services/tablePlatform/AuditService.js')).default;
      if (fieldId) {
        const history = await AuditService.getCellHistory(recordId, fieldId, limit, offset);
        return res.status(200).json(history);
      }
      const history = await AuditService.getRecordCellHistory(recordId, limit);
      return res.status(200).json(history);
    } catch (err) {
      handleRouteError(err, res, 'getCellHistory');
    }
  }
);

// ==========================================
// RECORD WATCHES
// ==========================================

router.post(
  '/records/:recordId/watch',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { recordId } = req.params;
      const { tableId } = req.body ?? {};
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const RecordWatchService = (await import('../services/tablePlatform/RecordWatchService.js'))
        .default;
      const isWatching = await RecordWatchService.isWatching(recordId, userId);
      if (isWatching) {
        await RecordWatchService.unwatchRecord(recordId, userId);
        return res.status(200).json({ watching: false });
      } else {
        await RecordWatchService.watchRecord(recordId, tableId, userId);
        return res.status(200).json({ watching: true });
      }
    } catch (err) {
      handleRouteError(err, res, 'toggleWatch');
    }
  }
);

router.get(
  '/records/:recordId/watchers',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      if (!recordId) return res.status(400).json({ error: 'recordId is required' });
      const RecordWatchService = (await import('../services/tablePlatform/RecordWatchService.js'))
        .default;
      const watchers = await RecordWatchService.getWatchers(recordId);
      return res.status(200).json(watchers);
    } catch (err) {
      handleRouteError(err, res, 'getWatchers');
    }
  }
);

router.post(
  '/tables/:tableId/records/query',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableId } = req.params;
      const { filters, filterByFormula, sorts, groupBy, fields, pageSize, cursor, search, viewId } =
        req.body ?? {};
      const authReq = req as AuthRequest;
      const userRole = await resolveUserRoleForTable(
        tableId,
        authReq.userId!,
        authReq.organizationId!
      );
      const ViewQueryEngine = (await import('../services/tablePlatform/ViewQueryEngine.js'))
        .default;
      const result = await ViewQueryEngine.executeQuery({
        tableId,
        viewId,
        filters,
        filterByFormula,
        sorts,
        groupBy,
        fields,
        pageSize,
        cursor,
        search,
        userRole,
      });
      res.json(result);
    } catch (e) {
      handleRouteError(e, res, 'records/query');
    }
  }
);

router.post(
  '/tables/:tableId/records/batch',
  requireTableAccess,
  requireRoles(...DATA_ROLES),
  checkOrgQuota as any,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      const { operations } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations array is required' });
      }
      const results: { type: string; recordId?: string; data?: unknown; error?: string }[] = [];
      for (const op of operations) {
        const { type, recordId, data } = op ?? {};
        try {
          if (type === 'create') {
            if (!data || typeof data !== 'object') {
              results.push({ type: 'create', error: 'data required for create' });
              continue;
            }
            const created = await RecordsService.createRecord(tableId, data, userId);
            results.push({ type: 'create', recordId: (created as any)?.id, data: created });
          } else if (type === 'update') {
            if (!recordId || !data || typeof data !== 'object') {
              results.push({
                type: 'update',
                recordId,
                error: 'recordId and data required for update',
              });
              continue;
            }
            const updated = await RecordsService.updateRecord(recordId, data, userId);
            results.push({ type: 'update', recordId, data: updated });
          } else if (type === 'delete') {
            if (!recordId) {
              results.push({ type: 'delete', error: 'recordId required for delete' });
              continue;
            }
            const ok = await RecordsService.deleteRecord(recordId, userId);
            results.push({ type: 'delete', recordId, data: ok });
          } else {
            results.push({ type: type ?? 'unknown', error: 'Unknown operation type' });
          }
        } catch (opErr: any) {
          results.push({
            type: type ?? 'unknown',
            recordId,
            error: opErr?.message ?? 'Operation failed',
          });
        }
      }
      return res.status(200).json({ results });
    } catch (err: any) {
      logger.error('[TablePlatform] batchRecords failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Batch operation failed', code: 'TABLE_PLATFORM_BATCH_RECORDS_FAILED' });
    }
  }
);

// ==========================================
// BATCH UPSERT
// ==========================================

router.post(
  '/tables/:tableId/records/upsert',
  requireTableAccess,
  checkOrgQuota,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { tableId } = req.params;
      const { records, fieldsToMergeOn } = req.body ?? {};
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required' });
      }
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'records array is required and must not be empty' });
      }
      if (!Array.isArray(fieldsToMergeOn) || fieldsToMergeOn.length === 0) {
        return res
          .status(400)
          .json({ error: 'fieldsToMergeOn array is required and must not be empty' });
      }
      const result = await RecordsService.upsertRecords(tableId, records, fieldsToMergeOn, userId);
      return res.status(200).json(result);
    } catch (err) {
      handleRouteError(err, res, 'upsertRecords');
    }
  }
);

// ==========================================
// CSV IMPORT
// ==========================================

router.post(
  '/tables/:tableId/import/csv',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { csvContent, mapping } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!csvContent || typeof csvContent !== 'string')
        return res.status(400).json({ error: 'csvContent is required' });
      const CsvImportService = (await import('../services/tablePlatform/CsvImportService.js'))
        .default;
      const result = await CsvImportService.importToTable(
        tableId,
        csvContent,
        mapping ?? undefined,
        authReq.userId
      );
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[TablePlatform] import CSV failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Import failed', details: (e as Error).message });
    }
  }
);

router.post('/bases/:baseId/import/csv', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    const { csvContent, tableName, mapping } = req.body ?? {};
    if (!baseId) return res.status(400).json({ error: 'baseId is required' });
    if (!csvContent || typeof csvContent !== 'string')
      return res.status(400).json({ error: 'csvContent is required' });
    const CsvImportService = (await import('../services/tablePlatform/CsvImportService.js'))
      .default;
    const result = await CsvImportService.importToNewTable(
      baseId,
      tableName ?? 'Imported table',
      csvContent,
      authReq.userId
    );
    return res.status(201).json(result);
  } catch (e) {
    logger.error('[TablePlatform] import CSV as new table failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Import failed', details: (e as Error).message });
  }
});

// ==========================================
// GOOGLE SHEETS IMPORT
// ==========================================

router.post(
  '/bases/:baseId/import/google-sheets',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId } = req.params;
      const { url, tableName } = req.body ?? {};
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!url || typeof url !== 'string')
        return res.status(400).json({ error: 'url is required' });
      const CsvImportService = (await import('../services/tablePlatform/CsvImportService.js'))
        .default;
      if (!authReq.userId) {
        return res.status(401).json({ error: 'User context required' });
      }
      const result = await CsvImportService.importFromGoogleSheet(
        url,
        baseId,
        authReq.userId,
        tableName
      );
      return res.status(201).json(result);
    } catch (e) {
      logger.error('[TablePlatform] import Google Sheet failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Import failed', details: (e as Error).message });
    }
  }
);

// ==========================================
// XLSX IMPORT
// ==========================================

router.post(
  '/tables/:tableId/import/xlsx',
  requireTableAccess,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!file)
        return res
          .status(400)
          .json({ error: 'XLSX file required. Use multipart form field "file".' });
      const CsvImportService = (await import('../services/tablePlatform/CsvImportService.js'))
        .default;
      const { headers, rows } = CsvImportService.parseXlsx(file.buffer);
      if (headers.length === 0) return res.status(400).json({ error: 'No headers found in XLSX' });
      const csvContent = [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const mapping = req.body?.mapping ? JSON.parse(req.body.mapping) : undefined;
      const result = await CsvImportService.importToTable(
        tableId,
        csvContent,
        mapping,
        authReq.userId
      );
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[TablePlatform] import XLSX failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Import failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/bases/:baseId/import/xlsx',
  requireBaseAccess,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId } = req.params;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!file)
        return res
          .status(400)
          .json({ error: 'XLSX file required. Use multipart form field "file".' });
      const tableName = req.body?.tableName ?? 'Imported table';
      const CsvImportService = (await import('../services/tablePlatform/CsvImportService.js'))
        .default;
      const { headers, rows } = CsvImportService.parseXlsx(file.buffer);
      if (headers.length === 0) return res.status(400).json({ error: 'No headers found in XLSX' });
      const csvContent = [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const result = await CsvImportService.importToNewTable(
        baseId,
        tableName,
        csvContent,
        authReq.userId
      );
      return res.status(201).json(result);
    } catch (e) {
      logger.error('[TablePlatform] import XLSX as new table failed', {
        error: (e as Error).message,
      });
      return res.status(500).json({ error: 'Import failed', details: (e as Error).message });
    }
  }
);

// ==========================================
// CHAT-TO-SCHEMA API
// ==========================================

router.post(
  '/schema/propose',
  requireWorkspaceTenantAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { workspaceId, message, existingSchema, language, baseId, tableId } = req.body ?? {};
      if (!workspaceId || !message) {
        return res.status(400).json({ error: 'workspaceId and message required' });
      }

      const { checkRateLimit, validateProposalLimits } =
        await import('../services/chatToSchema/safetyGuardrails.js');

      const userId = authReq.userId ?? 'anonymous';
      const orgId = authReq.organizationId ?? workspaceId;
      const rateCheck = checkRateLimit(userId, orgId);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfterMs: rateCheck.retryAfterMs,
        });
      }

      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const proposal = await ChatToSchemaService.generateProposal(
        workspaceId,
        message,
        existingSchema,
        language ?? 'en',
        authReq.userId,
        { baseId, tableId }
      );

      if (
        proposal.operations &&
        Array.isArray(proposal.operations) &&
        proposal.operations.length > 0
      ) {
        const pipelineOps = proposal.operations.map((op: any) => ({
          id: op.id,
          operation_type: op.operationType ?? op.operation_type ?? '',
          target: op.target ?? {},
          payload: op.payload ?? {},
          dependencies: op.dependsOn ?? op.dependencies,
          reversible: true,
        }));
        const limitsCheck = validateProposalLimits({
          proposal_id: proposal.id,
          intent: proposal.intent,
          confidence: proposal.confidence,
          summary: proposal.summary,
          operations: pipelineOps,
          warnings: [],
          estimated_impact: {},
        });
        if (!limitsCheck.valid) {
          return res.status(400).json({
            error: 'Proposal exceeds safety limits',
            details: limitsCheck.errors,
          });
        }
      }

      return res.status(201).json(proposal);
    } catch (e) {
      logger.error('[TablePlatform] schema/propose failed', { error: (e as Error).message });
      return res
        .status(500)
        .json({ error: 'Proposal generation failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/schema/proposals/:proposalId/execute',
  requireRoles(...SCHEMA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { proposalId } = req.params;
      const { approvedOperationIds } = req.body ?? {};
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const result = await ChatToSchemaService.executeProposal(
        proposalId,
        approvedOperationIds,
        authReq.userId,
        { organizationId: authReq.organizationId }
      );
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[TablePlatform] schema/execute failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Execution failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/schema/proposals/:proposalId/reject',
  requireSchemaProposalAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { proposalId } = req.params;
      const { reason } = req.body ?? {};
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      await ChatToSchemaService.rejectProposal(proposalId, authReq.userId, reason);
      return res.status(204).send();
    } catch (e) {
      logger.error('[TablePlatform] schema/reject failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Rejection failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/schema/proposals/:proposalId/refine',
  requireSchemaProposalAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { proposalId } = req.params;
      const { message, refinementMessage } = req.body ?? {};
      const msg = message ?? refinementMessage;
      if (!msg) {
        return res.status(400).json({ error: 'message is required' });
      }
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const proposal = await ChatToSchemaService.refineProposal(proposalId, msg, authReq.userId);
      return res.status(201).json(proposal);
    } catch (e) {
      logger.error('[TablePlatform] schema/refine failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Refinement failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/schema/proposals/:proposalId/undo',
  requireSchemaProposalAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { proposalId } = req.params;
      const baseId = (authReq as any).resolvedBaseId as string | undefined;
      if (!baseId) {
        return res.status(400).json({ error: 'Cannot resolve baseId for proposal' });
      }
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const result = await ChatToSchemaService.undoProposal(proposalId, baseId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(200).json({ success: true, message: `Proposal ${proposalId} undone` });
    } catch (e) {
      logger.error('[TablePlatform] schema/undo failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Undo failed', details: (e as Error).message });
    }
  }
);

router.post(
  '/schema/proposals/:proposalId/redo',
  requireSchemaProposalAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { proposalId } = req.params;
      const baseId = (authReq as any).resolvedBaseId as string | undefined;
      if (!baseId) {
        return res.status(400).json({ error: 'Cannot resolve baseId for proposal' });
      }
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const result = await ChatToSchemaService.redoProposal(proposalId, baseId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(200).json({ success: true, message: `Proposal ${proposalId} redone` });
    } catch (e) {
      logger.error('[TablePlatform] schema/redo failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Redo failed', details: (e as Error).message });
    }
  }
);

router.get(
  '/bases/:baseId/schema-history',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId } = req.params;
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const history = ChatToSchemaService.getSchemaHistory(baseId);
      return res.status(200).json(history);
    } catch (e) {
      logger.error('[TablePlatform] schema-history failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'History fetch failed', details: (e as Error).message });
    }
  }
);

router.get(
  '/schema/proposals/:proposalId',
  requireSchemaProposalAccess,
  async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const proposal = await ChatToSchemaService.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
      return res.status(200).json(proposal);
    } catch (e) {
      logger.error('[TablePlatform] schema/get failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Fetch failed', details: (e as Error).message });
    }
  }
);

router.get(
  '/workspaces/:workspaceId/schema/proposals',
  requireWorkspaceTenantAccess,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const ChatToSchemaService = (await import('../services/tablePlatform/ChatToSchemaService.js'))
        .default;
      const proposals = await ChatToSchemaService.listProposals(workspaceId, status);
      return res.status(200).json(proposals);
    } catch (e) {
      logger.error('[TablePlatform] schema/proposals list failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'List failed', details: (e as Error).message });
    }
  }
);

// ==========================================
// AUDIT TRAIL
// ==========================================

router.get('/audit/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit, offset } = req.query;
    const db = (await import('../database/Database.js')).getDatabase();
    const pageLimit = Math.min(Number(limit) || 50, 200);
    const pageOffset = Number(offset) || 0;

    const result = await db.query(
      `SELECT * FROM tp_audit_events
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, pageLimit, pageOffset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM tp_audit_events
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId]
    );

    return res.status(200).json({
      events: result.rows,
      total: Number((countResult.rows[0] as any)?.total ?? 0),
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (e) {
    logger.error('[TablePlatform] audit trail failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Audit trail fetch failed' });
  }
});

router.get('/tables/:tableId/audit', requireTableAccess, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const { limit, offset, eventType } = req.query;
    const db = (await import('../database/Database.js')).getDatabase();
    const pageLimit = Math.min(Number(limit) || 50, 200);
    const pageOffset = Number(offset) || 0;

    let sql = `SELECT * FROM tp_audit_events
               WHERE entity_id = $1
               OR (metadata->>'tableId' = $1)
               OR entity_id IN (SELECT id FROM tp_records WHERE table_id = $1)
               OR entity_id IN (SELECT id FROM tp_fields WHERE table_id = $1)`;
    const params: unknown[] = [tableId];

    if (typeof eventType === 'string') {
      sql += ` AND event_type = $${params.length + 1}`;
      params.push(eventType);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageLimit, pageOffset);

    const result = await db.query(sql, params);

    const countSql = sql.replace(/ORDER BY.*$/, '').replace(/LIMIT \$\d+ OFFSET \$\d+$/, '');
    const countParams = params.slice(0, -2);
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM (${countSql}) sub`,
      countParams
    );
    const total = Number((countResult.rows[0] as any)?.total ?? 0);

    return res.status(200).json({
      events: result.rows,
      total,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (e) {
    logger.error('[TablePlatform] table audit trail failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Audit trail fetch failed' });
  }
});

// ==========================================
// BULK OPERATIONS
// ==========================================

router.post(
  '/tables/:tableId/records/bulk-delete',
  requireTableAccess,
  requireRoles(...DATA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { recordIds } = req.body ?? {};
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return res.status(400).json({ error: 'recordIds array is required' });
      }
      if (recordIds.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 records per bulk delete' });
      }

      const results: { id: string; deleted: boolean; error?: string }[] = [];
      for (const id of recordIds) {
        try {
          await RecordsService.deleteRecord(id, authReq.userId);
          results.push({ id, deleted: true });
        } catch (e) {
          results.push({ id, deleted: false, error: (e as Error).message });
        }
      }

      return res.status(200).json({
        deleted: results.filter((r) => r.deleted).length,
        failed: results.filter((r) => !r.deleted).length,
        results,
      });
    } catch (e) {
      logger.error('[TablePlatform] bulk delete failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }
);

router.post(
  '/tables/:tableId/records/bulk-update',
  requireTableAccess,
  requireRoles(...DATA_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { updates } = req.body ?? {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'updates array is required' });
      }
      if (updates.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 records per bulk update' });
      }

      const results: { id: string; updated: boolean; error?: string }[] = [];
      for (const { recordId, data } of updates) {
        try {
          await RecordsService.updateRecord(recordId, data, authReq.userId);
          results.push({ id: recordId, updated: true });
        } catch (e) {
          results.push({ id: recordId, updated: false, error: (e as Error).message });
        }
      }

      return res.status(200).json({
        updated: results.filter((r) => r.updated).length,
        failed: results.filter((r) => !r.updated).length,
        results,
      });
    } catch (e) {
      logger.error('[TablePlatform] bulk update failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Bulk update failed' });
    }
  }
);

// ==========================================
// EXPORT (CSV / XLSX)
// ==========================================

router.get(
  '/tables/:tableId/export/csv',
  requireTableAccess,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { tableId } = req.params;
    const viewId = typeof req.query.viewId === 'string' ? req.query.viewId : undefined;
    const fieldIds =
      typeof req.query.fields === 'string'
        ? req.query.fields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
        : undefined;
    let exportArtifactId: string | null = null;
    try {
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });

      const ExportService = (await import('../services/tablePlatform/ExportService.js')).default;
      const tableName = await ExportService.getTableName(tableId);
      const safeName = tableName.replace(/[^a-zA-Z0-9_-]/g, '_');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
      res.write('\uFEFF');

      await ExportService.streamCsvExport({ tableId, viewId, fieldIds }, res);
      if (authReq.organizationId && authReq.userId) {
        const artifact = await artifactRegistryService
          .getArtifactByOrigin({
            organizationId: authReq.organizationId,
            originRuntime: 'sheet',
            originRecordId: tableId,
            userId: authReq.userId,
            roleKey: null,
          })
          .catch(() => null);
        exportArtifactId = artifact?.artifactId || null;
      }
      if (exportArtifactId && authReq.organizationId) {
        await reportsPresModelService
          .recordCompletedExport(
            exportArtifactId,
            authReq.organizationId,
            'csv',
            authReq.userId || 'system'
          )
          .catch(() => null);
      }
    } catch (e) {
      if (!exportArtifactId && authReq.organizationId && authReq.userId && tableId) {
        const artifact = await artifactRegistryService
          .getArtifactByOrigin({
            organizationId: authReq.organizationId,
            originRuntime: 'sheet',
            originRecordId: tableId,
            userId: authReq.userId,
            roleKey: null,
          })
          .catch(() => null);
        exportArtifactId = artifact?.artifactId || null;
      }
      if (exportArtifactId && authReq.organizationId) {
        await reportsPresModelService
          .recordFailedExport(
            exportArtifactId,
            authReq.organizationId,
            'csv',
            authReq.userId || 'system'
          )
          .catch(() => null);
      }
      logger.error('[TablePlatform] CSV export failed', { error: (e as Error).message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'CSV export failed', details: (e as Error).message });
      }
    }
  }
);

router.get(
  '/tables/:tableId/export/xlsx',
  requireTableAccess,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { tableId } = req.params;
    const viewId = typeof req.query.viewId === 'string' ? req.query.viewId : undefined;
    const fieldIds =
      typeof req.query.fields === 'string'
        ? req.query.fields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
        : undefined;
    const wantRegister =
      req.query.registerArtifact === 'true' || req.query.registerArtifact === '1';
    let exportArtifactId: string | null = null;
    try {
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });

      let registeredArtifactId: string | null = null;
      if (wantRegister) {
        const organizationId = authReq.organizationId;
        const userId = authReq.userId;
        if (!organizationId || !userId) {
          return res
            .status(403)
            .json({ error: 'Authentication and organization context required' });
        }
        const db = (await import('../database/Database.js')).getDatabase();
        const gr = await db.query('SELECT name, governance_mode FROM tp_tables WHERE id = $1', [
          tableId,
        ]);
        const trow = gr.rows[0] as { name?: string; governance_mode?: string } | undefined;
        if (!trow || trow.governance_mode !== 'governed') {
          return res.status(400).json({
            error: 'registerArtifact requires a governed table (governance_mode=governed)',
          });
        }
        const reg = await artifactRegistryService.registerGovernedTableSheetArtifact({
          organizationId,
          userId,
          tableId,
          tableName: String(trow.name || 'Untitled table'),
        });
        registeredArtifactId = reg.artifactId;
      }

      const ExportService = (await import('../services/tablePlatform/ExportService.js')).default;
      const tableName = await ExportService.getTableName(tableId);
      const safeName = tableName.replace(/[^a-zA-Z0-9_-]/g, '_');

      const buffer = await ExportService.buildXlsxBuffer({ tableId, viewId, fieldIds });
      exportArtifactId = registeredArtifactId;
      if (!exportArtifactId && authReq.organizationId && authReq.userId) {
        const artifact = await artifactRegistryService
          .getArtifactByOrigin({
            organizationId: authReq.organizationId,
            originRuntime: 'sheet',
            originRecordId: tableId,
            userId: authReq.userId,
            roleKey: null,
          })
          .catch(() => null);
        exportArtifactId = artifact?.artifactId || null;
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);
      if (registeredArtifactId) {
        res.setHeader('X-Artifact-Id', registeredArtifactId);
      }
      if (exportArtifactId && authReq.organizationId) {
        await reportsPresModelService
          .recordCompletedExport(
            exportArtifactId,
            authReq.organizationId,
            'xlsx',
            authReq.userId || 'system'
          )
          .catch(() => null);
      }
      res.end(buffer);
    } catch (e) {
      if (!exportArtifactId && authReq.organizationId && authReq.userId && tableId) {
        const artifact = await artifactRegistryService
          .getArtifactByOrigin({
            organizationId: authReq.organizationId,
            originRuntime: 'sheet',
            originRecordId: tableId,
            userId: authReq.userId,
            roleKey: null,
          })
          .catch(() => null);
        exportArtifactId = artifact?.artifactId || null;
      }
      if (exportArtifactId && authReq.organizationId) {
        await reportsPresModelService
          .recordFailedExport(
            exportArtifactId,
            authReq.organizationId,
            'xlsx',
            authReq.userId || 'system'
          )
          .catch(() => null);
      }
      logger.error('[TablePlatform] XLSX export failed', { error: (e as Error).message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'XLSX export failed', details: (e as Error).message });
      }
    }
  }
);

router.post(
  '/tables/:tableId/register-sheet-artifact',
  requireTableAccess,
  requireAudit,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });

      const db = (await import('../database/Database.js')).getDatabase();
      const gr = await db.query('SELECT name, governance_mode FROM tp_tables WHERE id = $1', [
        tableId,
      ]);
      const trow = gr.rows[0] as { name?: string; governance_mode?: string } | undefined;
      if (!trow) return res.status(404).json({ error: 'Table not found' });
      if (trow.governance_mode !== 'governed') {
        return res.status(400).json({
          error: 'Table must be in governed mode to register a canonical sheet artifact',
        });
      }

      const organizationId = authReq.organizationId;
      const userId = authReq.userId;
      if (!organizationId || !userId) {
        return res.status(403).json({ error: 'Authentication and organization context required' });
      }

      const artifact = await artifactRegistryService.registerGovernedTableSheetArtifact({
        organizationId,
        userId,
        tableId,
        tableName: String(trow.name || 'Untitled table'),
      });
      return res.status(201).json({ data: artifact });
    } catch (e) {
      logger.error('[TablePlatform] register-sheet-artifact failed', {
        error: (e as Error).message,
      });
      return res
        .status(500)
        .json({ error: 'Failed to register sheet artifact', details: (e as Error).message });
    }
  }
);

// ==========================================
// GOVERNANCE
// ==========================================

router.patch(
  '/tables/:tableId/governance',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { mode } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (mode !== 'operational' && mode !== 'governed') {
        return res.status(400).json({ error: 'mode must be "operational" or "governed"' });
      }
      const table = await MetadataService.setGovernanceMode(tableId, mode, authReq.userId);
      if (!table) return res.status(404).json({ error: 'Table not found' });
      return res.status(200).json(table);
    } catch (err) {
      handleRouteError(err, res, 'setGovernanceMode');
    }
  }
);

// ==========================================
// FIELD REORDER
// ==========================================

router.put(
  '/tables/:tableId/fields/reorder',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableId } = req.params;
      const { order } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'order array is required' });
      }
      await MetadataService.reorderFields(tableId, order);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'reorderFields');
    }
  }
);

// ==========================================
// VIEW REORDER
// ==========================================

router.put(
  '/tables/:tableId/views/reorder',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableId } = req.params;
      const { order } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'order array is required' });
      }
      await MetadataService.reorderViews(tableId, order);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'reorderViews');
    }
  }
);

// ==========================================
// COLUMN CONFIG
// ==========================================

router.patch('/views/:viewId/columns', requireViewAccess, async (req: Request, res: Response) => {
  try {
    const { viewId } = req.params;
    const { columns } = req.body ?? {};
    if (!viewId) return res.status(400).json({ error: 'viewId is required' });
    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'columns array is required' });
    }
    const view = await MetadataService.updateViewColumnConfig(viewId, columns);
    if (!view) return res.status(404).json({ error: 'View not found' });
    return res.status(200).json(view);
  } catch (err) {
    handleRouteError(err, res, 'updateViewColumnConfig');
  }
});

// ==========================================
// MIGRATION
// ==========================================

router.post('/migrate/workspace', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { workspaceId, graph } = req.body ?? {};
    if (!workspaceId || !graph)
      return res.status(400).json({ error: 'workspaceId and graph required' });
    const orgId = authReq.organizationId;
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const MigrationService = (await import('../services/tablePlatform/MigrationService.js'))
      .default;
    const result = await MigrationService.migrateWorkspace(
      workspaceId,
      orgId,
      graph,
      authReq.userId
    );
    return res.status(201).json(result);
  } catch (e) {
    logger.error('[TablePlatform] migration failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Migration failed', details: (e as Error).message });
  }
});

router.post('/migrate/validate', async (req: Request, res: Response) => {
  try {
    const { workspaceId, baseId, graph } = req.body ?? {};
    if (!workspaceId || !baseId)
      return res.status(400).json({ error: 'workspaceId and baseId required' });
    const MigrationService = (await import('../services/tablePlatform/MigrationService.js'))
      .default;
    const result = await MigrationService.validateMigration(workspaceId, baseId, graph);
    return res.status(200).json(result);
  } catch (e) {
    logger.error('[TablePlatform] migration validation failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Validation failed' });
  }
});

router.post('/migrate/rollback', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.body ?? {};
    if (!baseId) return res.status(400).json({ error: 'baseId required' });
    const MigrationService = (await import('../services/tablePlatform/MigrationService.js'))
      .default;
    await MigrationService.rollbackMigration(baseId, authReq.userId);
    return res.status(204).send();
  } catch (e) {
    logger.error('[TablePlatform] migration rollback failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Rollback failed' });
  }
});

// ==========================================
// LINKED RECORDS / RELATIONS
// ==========================================

router.post(
  '/records/:recordId/links',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { recordId } = req.params;
      const { fromFieldId, toRecordIds } = req.body ?? {};
      if (!fromFieldId || !Array.isArray(toRecordIds)) {
        return res.status(400).json({ error: 'fromFieldId and toRecordIds required' });
      }
      const RelationService = (await import('../services/tablePlatform/RelationService.js'))
        .default;
      await RelationService.linkRecords(recordId, fromFieldId, toRecordIds, authReq.userId);
      return res.status(201).json({ linked: toRecordIds.length });
    } catch (e) {
      logger.error('[TablePlatform] link records failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Link failed', details: (e as Error).message });
    }
  }
);

router.delete(
  '/records/:recordId/links',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { recordId } = req.params;
      const { fromFieldId, toRecordIds } = req.body ?? {};
      if (!fromFieldId || !Array.isArray(toRecordIds)) {
        return res.status(400).json({ error: 'fromFieldId and toRecordIds required' });
      }
      const RelationService = (await import('../services/tablePlatform/RelationService.js'))
        .default;
      await RelationService.unlinkRecords(recordId, fromFieldId, toRecordIds, authReq.userId);
      return res.status(200).json({ unlinked: toRecordIds.length });
    } catch (e) {
      logger.error('[TablePlatform] unlink records failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Unlink failed', details: (e as Error).message });
    }
  }
);

router.get(
  '/records/:recordId/links/:fieldId',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId, fieldId } = req.params;
      const RelationService = (await import('../services/tablePlatform/RelationService.js'))
        .default;
      const linked = await RelationService.getLinkedRecords(recordId, fieldId);
      return res.status(200).json({ records: linked });
    } catch (e) {
      logger.error('[TablePlatform] get linked records failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Fetch failed', details: (e as Error).message });
    }
  }
);

router.get(
  '/records/:recordId/expand',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      if (!recordId) {
        return res.status(400).json({ error: 'recordId is required' });
      }
      const depth = Math.min(Math.max(parseInt(String(req.query.depth ?? '1'), 10) || 1, 0), 3);
      const RelationService = (await import('../services/tablePlatform/RelationService.js'))
        .default;
      const expanded = await RelationService.expandRecord(recordId, depth);
      if (!expanded) {
        return res.status(404).json({ error: 'Record not found' });
      }
      return res.status(200).json(expanded);
    } catch (e) {
      logger.error('[TablePlatform] expand record failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Expand failed', details: (e as Error).message });
    }
  }
);

router.post('/records/display-names', async (req: Request, res: Response) => {
  try {
    const { recordIds } = req.body ?? {};
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'recordIds array is required' });
    }
    if (recordIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 record IDs per request' });
    }
    const RelationService = (await import('../services/tablePlatform/RelationService.js')).default;
    const displayNames = await RelationService.getLinkedRecordDisplayNames(recordIds);
    return res.status(200).json(displayNames);
  } catch (e) {
    logger.error('[TablePlatform] display names failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Fetch failed', details: (e as Error).message });
  }
});

// ==========================================
// ATTACHMENTS
// ==========================================

router.post(
  '/records/:recordId/fields/:fieldId/attachments',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { recordId, fieldId } = req.params;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res
          .status(400)
          .json({ error: 'No file uploaded. Use multipart form field "file".' });
      }
      const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
        .default;
      const attachment = await AttachmentService.uploadFile(
        recordId,
        fieldId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        authReq.userId
      );
      return res.status(201).json(attachment);
    } catch (e: any) {
      if (e?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: e.message });
      }
      logger.error('[TablePlatform] upload attachment failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Upload attachment failed' });
    }
  }
);

router.post(
  '/records/:recordId/attachments',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { recordId } = req.params;
      const { fieldId, fileName, mimeType, sizeBytes, storageKey } = req.body ?? {};
      if (!fieldId || !fileName)
        return res.status(400).json({ error: 'fieldId and fileName required' });
      const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
        .default;
      const attachment = await AttachmentService.createAttachment(
        recordId,
        fieldId,
        fileName,
        mimeType ?? 'application/octet-stream',
        sizeBytes ?? 0,
        storageKey ?? '',
        authReq.userId
      );
      return res.status(201).json(attachment);
    } catch (e) {
      logger.error('[TablePlatform] create attachment failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'Create attachment failed' });
    }
  }
);

router.get('/attachments/:attachmentId/download', async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
      .default;
    const { stream, filename, mimetype, size } = await AttachmentService.downloadFile(attachmentId);
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    stream.pipe(res);
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    logger.error('[TablePlatform] download attachment failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Download attachment failed' });
  }
});

router.get('/attachments/:attachmentId/presigned-url', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { attachmentId } = req.params;
    if (!attachmentId) return res.status(400).json({ error: 'attachmentId is required' });
    const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
      .default;
    const result = await AttachmentService.getDownloadUrl(
      attachmentId,
      authReq.userId ?? 'anonymous'
    );
    return res.status(200).json(result);
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    logger.error('[TablePlatform] presigned URL failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Presigned URL generation failed' });
  }
});

router.get('/attachments/download/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
      .default;
    const payload = AttachmentService.verifyDownloadToken(token);
    if (!payload) {
      return res.status(403).json({ error: 'Invalid or expired download token' });
    }
    const { stream, filename, mimetype, size } = await AttachmentService.downloadFile(
      payload.attachmentId
    );
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    stream.pipe(res);
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    logger.error('[TablePlatform] token download failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Download failed' });
  }
});

router.get(
  '/records/:recordId/attachments',
  requireRecordAccess,
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      const fieldId = typeof req.query.fieldId === 'string' ? req.query.fieldId : undefined;
      const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
        .default;
      const attachments = await AttachmentService.getAttachments(recordId, fieldId);
      return res.status(200).json(attachments);
    } catch (e) {
      logger.error('[TablePlatform] list attachments failed', { error: (e as Error).message });
      return res.status(500).json({ error: 'List attachments failed' });
    }
  }
);

router.delete('/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { attachmentId } = req.params;
    const AttachmentService = (await import('../services/tablePlatform/AttachmentService.js'))
      .default;
    const ok = await AttachmentService.deleteAttachment(attachmentId, authReq.userId);
    if (!ok) return res.status(404).json({ error: 'Attachment not found' });
    return res.status(204).send();
  } catch (e) {
    logger.error('[TablePlatform] delete attachment failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Delete attachment failed' });
  }
});

// ==========================================
// FORMS API (authenticated)
// ==========================================

router.post(
  '/tables/:tableId/forms',
  requireTableAccess,
  requireRoles(...ALL_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { name, description, slug, config } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      const FormService = (await import('../services/tablePlatform/FormService.js')).default;
      const form = await FormService.createForm(
        tableId,
        { name, description, slug, config },
        authReq.userId
      );
      return res.status(201).json(form);
    } catch (err) {
      handleRouteError(err, res, 'createForm');
    }
  }
);

router.get('/tables/:tableId/forms', requireTableAccess, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const forms = await FormService.listForms(tableId);
    return res.status(200).json(forms);
  } catch (err) {
    handleRouteError(err, res, 'listForms');
  }
});

router.get('/forms/:formId', async (req: Request, res: Response) => {
  try {
    const { formId } = req.params;
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const form = await FormService.getForm(formId);
    return res.status(200).json(form);
  } catch (err) {
    handleRouteError(err, res, 'getForm');
  }
});

router.patch('/forms/:formId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { formId } = req.params;
    const { name, description, slug, is_published, config } = req.body ?? {};
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const form = await FormService.updateForm(
      formId,
      { name, description, slug, is_published, config },
      authReq.userId
    );
    return res.status(200).json(form);
  } catch (err) {
    handleRouteError(err, res, 'updateForm');
  }
});

router.delete('/forms/:formId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { formId } = req.params;
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    await FormService.deleteForm(formId, authReq.userId);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteForm');
  }
});

router.get('/forms/:formId/submissions', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { formId } = req.params;
    const { limit, offset } = req.query;
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const baseRow = await db.query(
      `SELECT b.id as base_id FROM tp_forms f
       JOIN tp_tables t ON t.id = f.table_id
       JOIN tp_bases b ON b.id = t.base_id
       WHERE f.id = $1`,
      [formId]
    );
    if (baseRow.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const baseId = (baseRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const result = await FormService.getSubmissions(formId, {
      limit: limit ? parseInt(String(limit), 10) : undefined,
      offset: offset ? parseInt(String(offset), 10) : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'getFormSubmissions');
  }
});

// ==========================================
// AUTOMATIONS API
// ==========================================

router.post(
  '/tables/:tableId/automations',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { tableId } = req.params;
      const { baseId, name, description, triggerType, triggerConfig, actions } = req.body ?? {};
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      if (!triggerType || typeof triggerType !== 'string')
        return res.status(400).json({ error: 'triggerType is required' });
      if (!Array.isArray(actions) || actions.length === 0)
        return res.status(400).json({ error: 'actions array is required' });

      const automation = await automationService.createAutomation(baseId, tableId, {
        name,
        description,
        triggerType,
        triggerConfig: triggerConfig ?? {},
        actions,
        createdBy: authReq.userId,
      });
      return res.status(201).json(automation);
    } catch (err) {
      handleRouteError(err, res, 'createAutomation');
    }
  }
);

router.get(
  '/tables/:tableId/automations',
  requireTableAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableId } = req.params;
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      const automations = await automationService.listAutomations(tableId);
      return res.status(200).json(automations);
    } catch (err) {
      handleRouteError(err, res, 'listAutomations');
    }
  }
);

router.patch('/automations/:automationId/toggle', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const { enabled } = req.body ?? {};
    if (!automationId) return res.status(400).json({ error: 'automationId is required' });
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    await automationService.toggleAutomation(automationId, enabled);
    return res.status(200).json({ success: true, enabled });
  } catch (err) {
    handleRouteError(err, res, 'toggleAutomation');
  }
});

router.delete('/automations/:automationId', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    if (!automationId) return res.status(400).json({ error: 'automationId is required' });
    await automationService.deleteAutomation(automationId);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteAutomation');
  }
});

router.get('/automations/:automationId/runs', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    if (!automationId) return res.status(400).json({ error: 'automationId is required' });
    const runs = await automationService.getRunHistory(automationId, Math.min(limit, 100));
    return res.status(200).json(runs);
  } catch (err) {
    handleRouteError(err, res, 'getAutomationRuns');
  }
});

router.get('/automations/:automationId/next-run', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    if (!automationId) return res.status(400).json({ error: 'automationId is required' });
    const automation = await scheduledAutomationExecutor.getAutomation(automationId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    if (automation.trigger_type !== 'scheduled') {
      return res.status(400).json({ error: 'Automation is not a scheduled type' });
    }
    const config = automation.trigger_config as {
      cron?: string;
      timezone?: string;
      lastRunAt?: string;
      nextRunAt?: string;
    };
    if (!config.cron) return res.status(400).json({ error: 'No cron expression configured' });

    const validation = validateCronExpression(config.cron);
    const nextRun = scheduledAutomationExecutor.calculateNextRun(config.cron, config.timezone);
    return res.status(200).json({
      automationId,
      cron: config.cron,
      timezone: config.timezone || 'UTC',
      cronDescription: validation.description,
      lastRunAt: config.lastRunAt ?? null,
      nextRunAt: nextRun.toISOString(),
    });
  } catch (err) {
    handleRouteError(err, res, 'getNextRun');
  }
});

router.post('/automations/:automationId/run-now', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    if (!automationId) return res.status(400).json({ error: 'automationId is required' });
    const result = await scheduledAutomationExecutor.runNow(automationId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.message === 'Automation not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err?.message === 'Automation is not a scheduled type') {
      return res.status(400).json({ error: err.message });
    }
    handleRouteError(err, res, 'runNow');
  }
});

router.post('/automations/validate-cron', async (req: Request, res: Response) => {
  try {
    const { cron } = req.body ?? {};
    if (!cron || typeof cron !== 'string') {
      return res.status(400).json({ error: 'cron string is required' });
    }
    const result = validateCronExpression(cron);
    if (result.valid) {
      const nextRun = scheduledAutomationExecutor.calculateNextRun(
        cron,
        (req.body as any).timezone
      );
      return res.status(200).json({ ...result, nextRunAt: nextRun.toISOString() });
    }
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'validateCron');
  }
});

// ==========================================
// WEBHOOK INCOMING TRIGGER
// ==========================================

router.post('/automations/:automationId/trigger', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    if (!automationId) {
      return res.status(400).json({ error: 'automationId is required' });
    }
    const payload = req.body ?? {};
    const result = await automationService.triggerWebhook(automationId, payload);
    if (!result.success) {
      const status =
        result.error === 'Automation not found'
          ? 404
          : result.error === 'Automation is not active'
            ? 409
            : result.error === 'Automation is not a webhook trigger type'
              ? 400
              : 500;
      return res.status(status).json({ error: result.error });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    handleRouteError(err, res, 'triggerWebhookAutomation');
  }
});

// ==========================================
// INTERFACE DESIGNER API
// ==========================================

router.post(
  '/bases/:baseId/interfaces',
  requireBaseAccess,
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId } = req.params;
      const { name, description } = req.body ?? {};
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      const iface = await interfaceService.createInterface(baseId, {
        name,
        description,
        createdBy: authReq.userId,
      });
      return res.status(201).json(iface);
    } catch (err) {
      handleRouteError(err, res, 'createInterface');
    }
  }
);

router.get('/bases/:baseId/interfaces', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    if (!baseId) return res.status(400).json({ error: 'baseId is required' });
    const interfaces = await interfaceService.listInterfaces(baseId);
    return res.status(200).json(interfaces);
  } catch (err) {
    handleRouteError(err, res, 'listInterfaces');
  }
});

router.get('/interfaces/:interfaceId', async (req: Request, res: Response) => {
  try {
    const { interfaceId } = req.params;
    if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
    const iface = await interfaceService.getInterface(interfaceId);
    if (!iface) return res.status(404).json({ error: 'Interface not found' });
    return res.status(200).json(iface);
  } catch (err) {
    handleRouteError(err, res, 'getInterface');
  }
});

router.put(
  '/interfaces/:interfaceId/layout',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { interfaceId } = req.params;
      const { blocks, theme } = req.body ?? {};
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      if (!Array.isArray(blocks))
        return res.status(400).json({ error: 'blocks array is required' });
      const iface = await interfaceService.updateLayout(interfaceId, { blocks, theme });
      if (!iface) return res.status(404).json({ error: 'Interface not found' });
      return res.status(200).json(iface);
    } catch (err) {
      handleRouteError(err, res, 'updateInterfaceLayout');
    }
  }
);

router.post(
  '/interfaces/:interfaceId/publish',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { interfaceId } = req.params;
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      const result = await interfaceService.publishInterface(interfaceId);
      return res.status(200).json(result);
    } catch (err) {
      handleRouteError(err, res, 'publishInterface');
    }
  }
);

router.post(
  '/interfaces/:interfaceId/unpublish',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { interfaceId } = req.params;
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      await interfaceService.unpublishInterface(interfaceId);
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'unpublishInterface');
    }
  }
);

router.delete(
  '/interfaces/:interfaceId',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { interfaceId } = req.params;
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      await interfaceService.deleteInterface(interfaceId);
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'deleteInterface');
    }
  }
);

router.patch(
  '/interfaces/:interfaceId/roles',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { interfaceId } = req.params;
      const { roles } = req.body ?? {};
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles array is required' });
      await interfaceService.updateAllowedRoles(interfaceId, roles);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'updateInterfaceRoles');
    }
  }
);

// ==========================================
// GOVERNED MODELS
// ==========================================

router.post(
  '/bases/:baseId/governed-models',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId } = req.params;
      const { name, description } = req.body ?? {};
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const model = await GovernedModelService.createModel(
        baseId,
        name,
        description,
        authReq.userId
      );
      return res.status(201).json(model);
    } catch (e) {
      handleRouteError(e, res, 'createGovernedModel');
    }
  }
);

router.get(
  '/bases/:baseId/governed-models',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId } = req.params;
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const models = await GovernedModelService.listModels(baseId);
      return res.status(200).json(models);
    } catch (e) {
      handleRouteError(e, res, 'listGovernedModels');
    }
  }
);

router.get(
  '/governed-models/:modelId',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const model = await GovernedModelService.getModel(modelId);
      if (!model) return res.status(404).json({ error: 'Governed model not found' });
      return res.status(200).json(model);
    } catch (e) {
      handleRouteError(e, res, 'getGovernedModel');
    }
  }
);

router.patch(
  '/governed-models/:modelId',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { name, description, status } = req.body ?? {};
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const model = await GovernedModelService.updateModel(modelId, { name, description, status });
      if (!model) return res.status(404).json({ error: 'Governed model not found' });
      return res.status(200).json(model);
    } catch (e) {
      handleRouteError(e, res, 'updateGovernedModel');
    }
  }
);

router.delete(
  '/governed-models/:modelId',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const ok = await GovernedModelService.deleteModel(modelId);
      if (!ok) return res.status(404).json({ error: 'Governed model not found' });
      return res.status(204).send();
    } catch (e) {
      handleRouteError(e, res, 'deleteGovernedModel');
    }
  }
);

router.post(
  '/governed-models/:modelId/kpis',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const {
        code,
        labelEn,
        labelPl,
        formulaType,
        formulaConfig,
        sourceTableId,
        sourceFieldId,
        unit,
        format,
      } = req.body ?? {};
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      if (!code || typeof code !== 'string')
        return res.status(400).json({ error: 'code is required' });
      if (!labelEn || typeof labelEn !== 'string')
        return res.status(400).json({ error: 'labelEn is required' });
      if (!formulaType || typeof formulaType !== 'string')
        return res.status(400).json({ error: 'formulaType is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const kpi = await GovernedModelService.addKpi(modelId, {
        code,
        labelEn,
        labelPl,
        formulaType,
        formulaConfig,
        sourceTableId,
        sourceFieldId,
        unit,
        format,
      } as Parameters<typeof GovernedModelService.addKpi>[1]);
      return res.status(201).json(kpi);
    } catch (e) {
      handleRouteError(e, res, 'addKpi');
    }
  }
);

router.get(
  '/governed-models/:modelId/kpis',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const kpis = await GovernedModelService.listKpis(modelId);
      return res.status(200).json(kpis);
    } catch (e) {
      handleRouteError(e, res, 'listKpis');
    }
  }
);

router.delete('/kpis/:kpiId', async (req: Request, res: Response) => {
  try {
    const { kpiId } = req.params;
    if (!kpiId) return res.status(400).json({ error: 'kpiId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const ok = await GovernedModelService.removeKpi(kpiId);
    if (!ok) return res.status(404).json({ error: 'KPI not found' });
    return res.status(204).send();
  } catch (e) {
    handleRouteError(e, res, 'removeKpi');
  }
});

router.post(
  '/governed-models/:modelId/dimensions',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { name, sourceTableId, sourceFieldId, dimensionType } = req.body ?? {};
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const dim = await GovernedModelService.addDimension(modelId, {
        name,
        sourceTableId,
        sourceFieldId,
        dimensionType,
      });
      return res.status(201).json(dim);
    } catch (e) {
      handleRouteError(e, res, 'addDimension');
    }
  }
);

router.get(
  '/governed-models/:modelId/dimensions',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const dims = await GovernedModelService.listDimensions(modelId);
      return res.status(200).json(dims);
    } catch (e) {
      handleRouteError(e, res, 'listDimensions');
    }
  }
);

router.delete('/dimensions/:dimensionId', async (req: Request, res: Response) => {
  try {
    const { dimensionId } = req.params;
    if (!dimensionId) return res.status(400).json({ error: 'dimensionId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const ok = await GovernedModelService.removeDimension(dimensionId);
    if (!ok) return res.status(404).json({ error: 'Dimension not found' });
    return res.status(204).send();
  } catch (e) {
    handleRouteError(e, res, 'removeDimension');
  }
});

router.post(
  '/governed-models/:modelId/sources',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { tableId, trusted, requiredProvenance } = req.body ?? {};
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      if (!tableId || typeof tableId !== 'string')
        return res.status(400).json({ error: 'tableId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const source = await GovernedModelService.addModelSource(
        modelId,
        tableId,
        trusted ?? false,
        requiredProvenance
      );
      return res.status(201).json(source);
    } catch (e) {
      handleRouteError(e, res, 'addModelSource');
    }
  }
);

router.get(
  '/governed-models/:modelId/sources',
  requireGovernedModelAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const sources = await GovernedModelService.listModelSources(modelId);
      return res.status(200).json(sources);
    } catch (e) {
      handleRouteError(e, res, 'listModelSources');
    }
  }
);

router.patch('/model-sources/:id/trust', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { trusted } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (typeof trusted !== 'boolean')
      return res.status(400).json({ error: 'trusted (boolean) is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const source = await GovernedModelService.setSourceTrust(id, trusted);
    if (!source) return res.status(404).json({ error: 'Model source not found' });
    return res.status(200).json(source);
  } catch (e) {
    handleRouteError(e, res, 'setSourceTrust');
  }
});

router.post('/kpis/:kpiId/compute', async (req: Request, res: Response) => {
  try {
    const { kpiId } = req.params;
    if (!kpiId) return res.status(400).json({ error: 'kpiId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const result = await GovernedModelService.computeKpi(kpiId);
    return res.status(200).json(result);
  } catch (e) {
    handleRouteError(e, res, 'computeKpi');
  }
});

// ==========================================
// MODULE LINKAGE (Consultify Integration)
// ==========================================

router.post('/governed-models/:modelId/publish-to-results', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { modelId } = req.params;
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const model = await GovernedModelService.getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Governed model not found' });
    const allowed = await PermissionsService.canAccessBase(userId, orgId, model.base_id as string);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const { kpiIds, fieldMapping } = req.body ?? {};
    if (!kpiIds || !Array.isArray(kpiIds))
      return res.status(400).json({ error: 'kpiIds array is required' });
    const { syncToModule } = await import('../services/tablePlatform/ModuleSyncService.js');
    const result = await syncToModule(modelId, 'results', {
      kpiIds,
      fieldMapping: fieldMapping ?? {},
    });
    return res.status(200).json({
      success: result.syncStatus === 'success',
      syncedRecords: result.syncedRecords,
      syncId: result.syncId,
      message: result.errorMessage,
    });
  } catch (e) {
    handleRouteError(e, res, 'publishToResults');
  }
});

router.post('/governed-models/:modelId/sync-to-finance', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { modelId } = req.params;
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const model = await GovernedModelService.getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Governed model not found' });
    const allowed = await PermissionsService.canAccessBase(userId, orgId, model.base_id as string);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const { fieldMappings, fieldMapping, tableId } = req.body ?? {};
    const mapping = fieldMappings ?? fieldMapping;
    if (!mapping || typeof mapping !== 'object')
      return res.status(400).json({ error: 'fieldMappings or fieldMapping is required' });
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const { syncToModule } = await import('../services/tablePlatform/ModuleSyncService.js');
    const result = await syncToModule(modelId, 'finance', {
      fieldMappings: mapping as Record<string, string>,
      tableId,
    });
    return res.status(200).json({
      success: result.syncStatus === 'success',
      syncedRecords: result.syncedRecords,
      syncId: result.syncId,
      message: result.errorMessage,
    });
  } catch (e) {
    handleRouteError(e, res, 'syncToFinance');
  }
});

router.post('/governed-models/:modelId/sync-to-execution', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { modelId } = req.params;
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const model = await GovernedModelService.getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Governed model not found' });
    const allowed = await PermissionsService.canAccessBase(userId, orgId, model.base_id as string);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const { fieldMappings, fieldMapping, tableId } = req.body ?? {};
    const mapping = fieldMappings ?? fieldMapping;
    if (!mapping || typeof mapping !== 'object')
      return res.status(400).json({ error: 'fieldMappings or fieldMapping is required' });
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const { syncToModule } = await import('../services/tablePlatform/ModuleSyncService.js');
    const result = await syncToModule(modelId, 'execution', {
      fieldMappings: mapping as Record<string, string>,
      tableId,
    });
    return res.status(200).json({
      success: result.syncStatus === 'success',
      syncedRecords: result.syncedRecords,
      syncId: result.syncId,
      message: result.errorMessage,
    });
  } catch (e) {
    handleRouteError(e, res, 'syncToExecution');
  }
});

router.post(
  '/governed-models/:modelId/sync-to-initiatives',
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      if (!modelId) return res.status(400).json({ error: 'modelId is required' });
      const GovernedModelService = (
        await import('../services/tablePlatform/GovernedModelService.js')
      ).default;
      const model = await GovernedModelService.getModel(modelId);
      if (!model) return res.status(404).json({ error: 'Governed model not found' });
      const { fieldMappings, fieldMapping, tableId } = req.body ?? {};
      const mapping = fieldMappings ?? fieldMapping;
      if (!mapping || typeof mapping !== 'object')
        return res.status(400).json({ error: 'fieldMappings or fieldMapping is required' });
      if (!tableId) return res.status(400).json({ error: 'tableId is required' });
      const { syncToModule } = await import('../services/tablePlatform/ModuleSyncService.js');
      const result = await syncToModule(modelId, 'initiatives', {
        fieldMappings: mapping as Record<string, string>,
        tableId,
      });
      return res.status(200).json({
        success: result.syncStatus === 'success',
        syncedRecords: result.syncedRecords,
        syncId: result.syncId,
        message: result.errorMessage,
      });
    } catch (e) {
      handleRouteError(e, res, 'syncToInitiatives');
    }
  }
);

router.get('/governed-models/:modelId/link-status', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    const GovernedModelService = (await import('../services/tablePlatform/GovernedModelService.js'))
      .default;
    const model = await GovernedModelService.getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Governed model not found' });
    const { getLinkStatus } = await import('../services/tablePlatform/ModuleSyncService.js');
    const status = await getLinkStatus(modelId);
    return res.status(200).json(status);
  } catch (e) {
    handleRouteError(e, res, 'getModuleLinkStatus');
  }
});

// ==========================================
// EXTENSIONS / MARKETPLACE API
// ==========================================

router.get('/extensions/marketplace', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const extensions = await extensionService.listPublishedExtensions(category);
    return res.status(200).json(extensions);
  } catch (err) {
    handleRouteError(err, res, 'listMarketplaceExtensions');
  }
});

router.post('/extensions', async (req: Request, res: Response) => {
  try {
    const { name, description, version, author, sourceUrl, scopes, category } = req.body ?? {};
    if (!name || typeof name !== 'string')
      return res.status(400).json({ error: 'name is required' });
    if (!sourceUrl || typeof sourceUrl !== 'string')
      return res.status(400).json({ error: 'sourceUrl is required' });
    const ext = await extensionService.registerExtension({
      name,
      description,
      version,
      author,
      sourceUrl,
      scopes,
      category,
    });
    return res.status(201).json(ext);
  } catch (err) {
    handleRouteError(err, res, 'registerExtension');
  }
});

router.get('/extensions/:extensionId', async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    if (!extensionId) return res.status(400).json({ error: 'extensionId is required' });
    const ext = await extensionService.getExtension(extensionId);
    if (!ext) return res.status(404).json({ error: 'Extension not found' });
    return res.status(200).json(ext);
  } catch (err) {
    handleRouteError(err, res, 'getExtension');
  }
});

router.post('/extensions/:extensionId/submit', async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    if (!extensionId) return res.status(400).json({ error: 'extensionId is required' });
    await extensionService.submitForReview(extensionId);
    return res.status(200).json({ success: true });
  } catch (err) {
    handleRouteError(err, res, 'submitExtensionForReview');
  }
});

router.post('/extensions/:extensionId/publish', async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    if (!extensionId) return res.status(400).json({ error: 'extensionId is required' });
    await extensionService.publishExtension(extensionId);
    return res.status(200).json({ success: true });
  } catch (err) {
    handleRouteError(err, res, 'publishExtension');
  }
});

router.post(
  '/bases/:baseId/extensions/:extensionId/install',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId, extensionId } = req.params;
      if (!baseId || !extensionId)
        return res.status(400).json({ error: 'baseId and extensionId are required' });
      const install = await extensionService.installExtension(extensionId, baseId, authReq.userId);
      if (!install) return res.status(200).json({ message: 'Already installed' });
      return res.status(201).json(install);
    } catch (err) {
      handleRouteError(err, res, 'installExtension');
    }
  }
);

router.delete(
  '/bases/:baseId/extensions/:extensionId/uninstall',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId, extensionId } = req.params;
      if (!baseId || !extensionId)
        return res.status(400).json({ error: 'baseId and extensionId are required' });
      const ok = await extensionService.uninstallExtension(extensionId, baseId);
      if (!ok) return res.status(404).json({ error: 'Extension install not found' });
      return res.status(204).send();
    } catch (err) {
      handleRouteError(err, res, 'uninstallExtension');
    }
  }
);

router.get('/bases/:baseId/extensions', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    if (!baseId) return res.status(400).json({ error: 'baseId is required' });
    const extensions = await extensionService.getInstalledExtensions(baseId);
    return res.status(200).json(extensions);
  } catch (err) {
    handleRouteError(err, res, 'listInstalledExtensions');
  }
});

router.patch(
  '/bases/:baseId/extensions/:extensionId/config',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId, extensionId } = req.params;
      const { config } = req.body ?? {};
      if (!baseId || !extensionId)
        return res.status(400).json({ error: 'baseId and extensionId are required' });
      if (!config || typeof config !== 'object')
        return res.status(400).json({ error: 'config object is required' });
      await extensionService.updateExtensionConfig(extensionId, baseId, config);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'updateExtensionConfig');
    }
  }
);

// ==========================================
// TEMPLATES MARKETPLACE
// ==========================================

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const templateSvc = (await import('../services/tablePlatform/TemplateService.js')).default;
    const templates = await templateSvc.listTemplates(
      typeof category === 'string' ? category : undefined
    );
    return res.status(200).json(templates);
  } catch (err) {
    handleRouteError(err, res, 'listTemplates');
  }
});

// ── Template Lifecycle (Block A · EPIC-T6) ─────────────────────────────────
//
// MUST appear BEFORE the `/templates/:templateId` catch-all so Express does
// not interpret 'lifecycle' as a templateId.
//
// Read endpoint is open to any authenticated tenant member (read-only). Write
// endpoints (approve/deprecate) require super-admin because `tp_base_templates`
// is a system-owned catalog with no tenant column.

router.get('/templates/lifecycle', async (req: Request, res: Response) => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
    if (
      rawStatus !== undefined &&
      rawStatus !== 'draft' &&
      rawStatus !== 'approved' &&
      rawStatus !== 'deprecated'
    ) {
      return res.status(400).json({
        error: "status must be one of 'draft' | 'approved' | 'deprecated' (or omitted)",
      });
    }
    const lifecycleSvc = (await import('../services/tablePlatform/TemplateLifecycleService.js'))
      .default;
    const items = await lifecycleSvc.listTemplates({
      status: rawStatus as 'draft' | 'approved' | 'deprecated' | undefined,
      category: rawCategory,
    });
    return res.status(200).json(items);
  } catch (err) {
    handleRouteError(err, res, 'listLifecycleTemplates');
  }
});

router.post(
  '/templates/:templateId/approve',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { templateId } = req.params;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const lifecycleSvc = (await import('../services/tablePlatform/TemplateLifecycleService.js'))
        .default;
      const updated = await lifecycleSvc.approveTemplate(templateId, {
        actorUserId: String(authReq.userId ?? authReq.user?.id ?? ''),
        note,
      });
      return res.status(200).json(updated);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'INVALID_LIFECYCLE_TRANSITION') {
        return res.status(409).json({ error: (err as Error).message, code });
      }
      if (code === 'TEMPLATE_NOT_FOUND') {
        return res.status(404).json({ error: (err as Error).message, code });
      }
      handleRouteError(err, res, 'approveTemplate');
    }
  }
);

router.post(
  '/templates/:templateId/deprecate',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { templateId } = req.params;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const lifecycleSvc = (await import('../services/tablePlatform/TemplateLifecycleService.js'))
        .default;
      const updated = await lifecycleSvc.deprecateTemplate(templateId, {
        actorUserId: String(authReq.userId ?? authReq.user?.id ?? ''),
        note,
      });
      return res.status(200).json(updated);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'INVALID_LIFECYCLE_TRANSITION') {
        return res.status(409).json({ error: (err as Error).message, code });
      }
      if (code === 'TEMPLATE_NOT_FOUND') {
        return res.status(404).json({ error: (err as Error).message, code });
      }
      handleRouteError(err, res, 'deprecateTemplate');
    }
  }
);

router.get('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });
    const templateSvc = (await import('../services/tablePlatform/TemplateService.js')).default;
    const tpl = await templateSvc.getTemplate(templateId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    return res.status(200).json(tpl);
  } catch (err) {
    handleRouteError(err, res, 'getTemplate');
  }
});

router.post('/templates/:templateId/use', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { templateId } = req.params;
    const { workspaceId, name } = req.body ?? {};
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    const templateSvc = (await import('../services/tablePlatform/TemplateService.js')).default;
    const base = await templateSvc.createFromTemplate(
      templateId,
      workspaceId,
      name || 'Untitled base',
      userId!,
      organizationId
    );
    return res.status(201).json(base);
  } catch (err) {
    handleRouteError(err, res, 'useTemplate');
  }
});

router.post(
  '/bases/:baseId/publish-template',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { baseId } = req.params;
      const { name, description, category } = req.body ?? {};
      if (!baseId) return res.status(400).json({ error: 'baseId is required' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'name is required' });
      if (!category || typeof category !== 'string')
        return res.status(400).json({ error: 'category is required' });
      const templateSvc = (await import('../services/tablePlatform/TemplateService.js')).default;
      const tpl = await templateSvc.publishAsTemplate(
        baseId,
        name,
        description || '',
        category,
        authReq.userId!
      );
      return res.status(201).json(tpl);
    } catch (err) {
      handleRouteError(err, res, 'publishTemplate');
    }
  }
);

// ==========================================
// VIEW SHARING
// ==========================================

router.post('/views/:viewId/share', requireViewAccess, async (req: Request, res: Response) => {
  try {
    const { viewId } = req.params;
    if (!viewId) return res.status(400).json({ error: 'viewId is required' });
    const { password, expiresAt } = req.body ?? {};
    const result = await MetadataService.shareView(viewId, { password, expiresAt });
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'shareView');
  }
});

router.post('/views/:viewId/unshare', requireViewAccess, async (req: Request, res: Response) => {
  try {
    const { viewId } = req.params;
    if (!viewId) return res.status(400).json({ error: 'viewId is required' });
    await MetadataService.unshareView(viewId);
    return res.status(200).json({ success: true });
  } catch (err) {
    handleRouteError(err, res, 'unshareView');
  }
});

// ==========================================
// VIEW LOCKS
// ==========================================

router.post(
  '/views/:viewId/lock',
  requireViewAccess,
  requireRoles(...VIEW_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { viewId } = req.params;
      if (!viewId) return res.status(400).json({ error: 'viewId is required' });
      await MetadataService.lockView(viewId, authReq.userId!);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'lockView');
    }
  }
);

router.post(
  '/views/:viewId/unlock',
  requireViewAccess,
  requireRoles(...VIEW_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { viewId } = req.params;
      if (!viewId) return res.status(400).json({ error: 'viewId is required' });
      await MetadataService.unlockView(viewId, authReq.userId!);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'unlockView');
    }
  }
);

// ==========================================
// INTERFACE LOCKS
// ==========================================

router.post(
  '/interfaces/:interfaceId/lock',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { interfaceId } = req.params;
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      await MetadataService.lockInterface(interfaceId, authReq.userId!);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'lockInterface');
    }
  }
);

router.post(
  '/interfaces/:interfaceId/unlock',
  requireRoles(...INTERFACE_ROLES),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { interfaceId } = req.params;
      if (!interfaceId) return res.status(400).json({ error: 'interfaceId is required' });
      await MetadataService.unlockInterface(interfaceId, authReq.userId!);
      return res.status(200).json({ success: true });
    } catch (err) {
      handleRouteError(err, res, 'unlockInterface');
    }
  }
);

// ==========================================
// PUBLIC FORMS API (no auth required)
// ==========================================

export const publicFormRouter = Router();

publicFormRouter.get('/public/forms/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'slug is required' });
    }
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const form = await FormService.getFormBySlug(slug);

    const fieldsResult = await (await import('../database/Database.js'))
      .getDatabase()
      .query(
        'SELECT id, name, field_type, options FROM tp_fields WHERE table_id = $1 ORDER BY field_order ASC',
        [form.table_id]
      );

    return res.status(200).json({
      id: form.id,
      name: form.name,
      description: form.description,
      slug: form.slug,
      config: form.config,
      fields: fieldsResult.rows,
    });
  } catch (err) {
    handleRouteError(err, res, 'getPublicForm');
  }
});

publicFormRouter.post('/public/forms/:slug/submit', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'slug is required' });
    }
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object is required' });
    }
    const FormService = (await import('../services/tablePlatform/FormService.js')).default;
    const form = await FormService.getFormBySlug(slug);
    const result = await FormService.submitForm(form.id, data);
    return res.status(201).json(result);
  } catch (err) {
    handleRouteError(err, res, 'submitPublicForm');
  }
});

// ==========================================
// PUBLIC INTERFACES API (no auth required)
// ==========================================

publicFormRouter.get('/public/interfaces/:shareToken', async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    if (!shareToken || typeof shareToken !== 'string') {
      return res.status(400).json({ error: 'shareToken is required' });
    }
    const iface = await interfaceService.getPublicInterface(shareToken);
    if (!iface) {
      return res.status(404).json({ error: 'Interface not found or not published' });
    }
    return res.status(200).json(iface);
  } catch (err) {
    handleRouteError(err, res, 'getPublicInterface');
  }
});

// ==========================================
// PUBLIC VIEW SHARING (no auth required)
// ==========================================

publicFormRouter.get('/public/views/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    const result = (await MetadataService.getSharedView(token)) as any;
    if (!result) return res.status(404).json({ error: 'Shared view not found or expired' });
    if (result._sharePassword) {
      const provided = req.headers['x-share-password'] as string | undefined;
      const ok = await MetadataService.verifySharePassword(provided ?? '', result._sharePassword);
      if (!ok) {
        return res.status(401).json({
          error: 'Password required',
          code: 'VIEW_PASSWORD_REQUIRED',
          hasPassword: true,
        });
      }
    }
    const { _sharePassword: _pw, ...safeResult } = result;
    return res.status(200).json(safeResult);
  } catch (err) {
    handleRouteError(err, res, 'getPublicSharedView');
  }
});

publicFormRouter.get('/public/views/:token/records', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    const viewData = (await MetadataService.getSharedView(token)) as any;
    if (!viewData) return res.status(404).json({ error: 'Shared view not found or expired' });
    if (viewData._sharePassword) {
      const provided = req.headers['x-share-password'] as string | undefined;
      const ok = await MetadataService.verifySharePassword(provided ?? '', viewData._sharePassword);
      if (!ok) {
        return res.status(401).json({
          error: 'Password required',
          code: 'VIEW_PASSWORD_REQUIRED',
          hasPassword: true,
        });
      }
    }

    const { pageSize, cursor } = req.query;
    const ViewQueryEngine = (await import('../services/tablePlatform/ViewQueryEngine.js')).default;
    const result = await ViewQueryEngine.executeQuery({
      tableId: viewData.tableId,
      viewId: viewData.viewId,
      pageSize: pageSize !== undefined ? parseInt(String(pageSize), 10) : 100,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'getPublicSharedViewRecords');
  }
});

// ==========================================
// OUTBOUND WEBHOOKS API
// ==========================================

router.post('/bases/:baseId/webhooks', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    const { notificationUrl, specification } = req.body ?? {};
    if (!baseId) return res.status(400).json({ error: 'baseId is required' });
    if (!notificationUrl || typeof notificationUrl !== 'string') {
      return res.status(400).json({ error: 'notificationUrl is required' });
    }
    const result = await webhookDispatcher.createWebhook(
      baseId,
      notificationUrl,
      specification ?? { options: { filters: {} } },
      authReq.userId
    );
    return res.status(201).json(result);
  } catch (err) {
    handleRouteError(err, res, 'createWebhook');
  }
});

router.get('/bases/:baseId/webhooks', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    if (!baseId) return res.status(400).json({ error: 'baseId is required' });
    const webhooks = await webhookDispatcher.listWebhooks(baseId);
    return res.status(200).json({ webhooks });
  } catch (err) {
    handleRouteError(err, res, 'listWebhooks');
  }
});

router.delete('/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    if (!webhookId) return res.status(400).json({ error: 'webhookId is required' });
    await webhookDispatcher.deleteWebhook(webhookId);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteWebhook');
  }
});

router.post('/webhooks/:webhookId/refresh', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    if (!webhookId) return res.status(400).json({ error: 'webhookId is required' });
    const result = await webhookDispatcher.refreshWebhook(webhookId);
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'refreshWebhook');
  }
});

router.get('/webhooks/:webhookId/payloads', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    if (!webhookId) return res.status(400).json({ error: 'webhookId is required' });
    const cursor = req.query.cursor ? parseInt(String(req.query.cursor), 10) : undefined;
    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10), 100) : 50;
    const result = await webhookDispatcher.listPayloads(webhookId, cursor, limit);
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'listWebhookPayloads');
  }
});

// ==========================================
// WEBHOOK RELAYS (Zapier/Make)
// ==========================================

router.post('/bases/:baseId/relays', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { baseId } = req.params;
    const { name, targetUrl, secret, eventTypes } = req.body ?? {};
    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'name and targetUrl are required' });
    }
    const relay = await webhookRelayService.createRelay(
      baseId,
      name,
      targetUrl,
      secret,
      eventTypes,
      authReq.userId
    );
    return res.status(201).json(relay);
  } catch (err) {
    handleRouteError(err, res, 'createRelay');
  }
});

router.get('/bases/:baseId/relays', requireBaseAccess, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    const relays = await webhookRelayService.listRelays(baseId);
    return res.status(200).json({ relays });
  } catch (err) {
    handleRouteError(err, res, 'listRelays');
  }
});

router.get('/relays/:relayId', async (req: Request, res: Response) => {
  try {
    const relay = await webhookRelayService.getRelay(req.params.relayId);
    if (!relay) return res.status(404).json({ error: 'Relay not found' });
    return res.status(200).json(relay);
  } catch (err) {
    handleRouteError(err, res, 'getRelay');
  }
});

router.patch('/relays/:relayId', async (req: Request, res: Response) => {
  try {
    const { name, targetUrl, secret, eventTypes, isActive } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (targetUrl !== undefined) updates.target_url = targetUrl;
    if (secret !== undefined) updates.secret = secret;
    if (eventTypes !== undefined) updates.event_types = eventTypes;
    if (isActive !== undefined) updates.is_active = isActive;
    const relay = await webhookRelayService.updateRelay(req.params.relayId, updates as any);
    if (!relay) return res.status(404).json({ error: 'Relay not found' });
    return res.status(200).json(relay);
  } catch (err) {
    handleRouteError(err, res, 'updateRelay');
  }
});

router.delete('/relays/:relayId', async (req: Request, res: Response) => {
  try {
    await webhookRelayService.deleteRelay(req.params.relayId);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteRelay');
  }
});

router.post('/relays/:relayId/test', async (req: Request, res: Response) => {
  try {
    const result = await webhookRelayService.testRelay(req.params.relayId);
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'testRelay');
  }
});

// ==========================================
// SSO (SAML 2.0 / OIDC) ADMIN API
// ==========================================

router.post('/admin/sso/saml', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { entityId, ssoUrl, certificate, signatureAlgorithm, nameIdFormat } = req.body ?? {};
    if (!entityId || !ssoUrl || !certificate) {
      return res.status(400).json({ error: 'entityId, ssoUrl, and certificate are required' });
    }
    const config = await ssoService.configureSAML(organizationId, {
      entityId,
      ssoUrl,
      certificate,
      signatureAlgorithm,
      nameIdFormat,
    });
    return res.status(200).json(config);
  } catch (err) {
    handleRouteError(err, res, 'configureSAML');
  }
});

router.post('/admin/sso/oidc', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { issuer, clientId, clientSecret, authorizationUrl, tokenUrl, userInfoUrl, scopes } =
      req.body ?? {};
    if (!issuer || !clientId || !clientSecret || !authorizationUrl || !tokenUrl || !userInfoUrl) {
      return res.status(400).json({
        error:
          'issuer, clientId, clientSecret, authorizationUrl, tokenUrl, userInfoUrl are required',
      });
    }
    const config = await ssoService.configureOIDC(organizationId, {
      issuer,
      clientId,
      clientSecret,
      authorizationUrl,
      tokenUrl,
      userInfoUrl,
      scopes,
    });
    return res.status(200).json(config);
  } catch (err) {
    handleRouteError(err, res, 'configureOIDC');
  }
});

router.get('/admin/sso', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const config = await ssoService.getSSOConfig(organizationId);
    if (!config) return res.status(404).json({ error: 'No SSO configuration found' });
    return res.status(200).json(config);
  } catch (err) {
    handleRouteError(err, res, 'getSSOConfig');
  }
});

router.patch('/admin/sso/toggle', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    await ssoService.toggleSSO(organizationId, enabled);
    return res.status(200).json({ success: true, enabled });
  } catch (err) {
    handleRouteError(err, res, 'toggleSSO');
  }
});

router.get('/sso/login/:orgSlug', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const config = await ssoService.getSSOConfig(organizationId);
    if (!config || !config.enabled) {
      return res
        .status(404)
        .json({ error: 'SSO is not configured or not enabled for this organization' });
    }
    if (config.provider === 'saml') {
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/table-platform/sso/callback`;
      const authUrl = ssoService.generateSAMLAuthUrl(config.config as any, callbackUrl);
      return res.status(200).json({ redirectUrl: authUrl });
    }
    return res.status(400).json({
      error: `SSO provider '${config.provider}' login not yet implemented via this endpoint`,
    });
  } catch (err) {
    handleRouteError(err, res, 'ssoLogin');
  }
});

router.post('/sso/callback', async (req: Request, res: Response) => {
  try {
    const { SAMLResponse, RelayState } = req.body ?? {};
    if (!SAMLResponse) return res.status(400).json({ error: 'SAMLResponse is required' });
    const organizationId = RelayState || (req as AuthRequest).organizationId;
    if (!organizationId)
      return res.status(400).json({ error: 'Cannot determine organization from callback' });
    const result = await ssoService.validateSAMLResponse(organizationId, SAMLResponse);
    if (!result.valid) return res.status(401).json({ error: 'Invalid SAML response' });
    return res.status(200).json({
      email: result.email,
      nameId: result.nameId,
      attributes: result.attributes,
    });
  } catch (err) {
    handleRouteError(err, res, 'ssoCallback');
  }
});

// ==========================================
// SERVICE ACCOUNTS API
// ==========================================

router.post('/admin/service-accounts', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { name, description, scopes, expiresInDays } = req.body ?? {};
    if (!name || typeof name !== 'string')
      return res.status(400).json({ error: 'name is required' });
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ error: 'scopes array is required' });
    }
    const result = await serviceAccountService.createServiceAccount(organizationId, {
      name,
      description,
      scopes,
      expiresInDays,
      createdBy: authReq.userId,
    });
    return res.status(201).json(result);
  } catch (err) {
    handleRouteError(err, res, 'createServiceAccount');
  }
});

router.get('/admin/service-accounts', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const accounts = await serviceAccountService.listServiceAccounts(organizationId);
    return res.status(200).json(accounts);
  } catch (err) {
    handleRouteError(err, res, 'listServiceAccounts');
  }
});

router.delete('/admin/service-accounts/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const row = await db.query('SELECT organization_id FROM tp_service_accounts WHERE id = $1', [
      id,
    ]);
    if (
      row.rows.length === 0 ||
      String((row.rows[0] as any).organization_id) !== String(organizationId)
    ) {
      return res.status(404).json({ error: 'Service account not found' });
    }
    await serviceAccountService.revokeServiceAccount(id);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'revokeServiceAccount');
  }
});

// ==========================================
// ROW-LEVEL POLICIES
// ==========================================

router.post('/tables/:tableId/row-policies', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { tableId } = req.params;
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const tableRow = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
    if (tableRow.rows.length === 0) return res.status(404).json({ error: 'Table not found' });
    const baseId = (tableRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const { name, role, conditionFieldId, conditionOperator, conditionValue, permission } =
      req.body ?? {};
    if (!name || typeof name !== 'string')
      return res.status(400).json({ error: 'name is required' });
    if (!role || typeof role !== 'string')
      return res.status(400).json({ error: 'role is required' });
    const RowPolicyService = (await import('../services/tablePlatform/RowPolicyService.js'))
      .default;
    const policy = await RowPolicyService.createPolicy(
      tableId,
      name,
      role,
      conditionFieldId,
      conditionOperator ?? 'equals',
      conditionValue,
      permission ?? 'read'
    );
    return res.status(201).json(policy);
  } catch (err) {
    handleRouteError(err, res, 'createRowPolicy');
  }
});

router.get('/tables/:tableId/row-policies', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { tableId } = req.params;
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const tableRow = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
    if (tableRow.rows.length === 0) return res.status(404).json({ error: 'Table not found' });
    const baseId = (tableRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const RowPolicyService = (await import('../services/tablePlatform/RowPolicyService.js'))
      .default;
    const policies = await RowPolicyService.listPolicies(tableId);
    return res.status(200).json(policies);
  } catch (err) {
    handleRouteError(err, res, 'listRowPolicies');
  }
});

router.patch('/row-policies/:policyId', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { policyId } = req.params;
    if (!policyId) return res.status(400).json({ error: 'policyId is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const policyRow = await db.query(
      `SELECT t.base_id FROM tp_row_policies p JOIN tp_tables t ON t.id = p.table_id WHERE p.id = $1`,
      [policyId]
    );
    if (policyRow.rows.length === 0) return res.status(404).json({ error: 'Policy not found' });
    const baseId = (policyRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const updates = req.body ?? {};
    const RowPolicyService = (await import('../services/tablePlatform/RowPolicyService.js'))
      .default;
    const policy = await RowPolicyService.updatePolicy(policyId, updates);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    return res.status(200).json(policy);
  } catch (err) {
    handleRouteError(err, res, 'updateRowPolicy');
  }
});

router.delete('/row-policies/:policyId', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const { policyId } = req.params;
    if (!policyId) return res.status(400).json({ error: 'policyId is required' });
    const db = (await import('../database/Database.js')).getDatabase();
    const policyRow = await db.query(
      `SELECT t.base_id FROM tp_row_policies p JOIN tp_tables t ON t.id = p.table_id WHERE p.id = $1`,
      [policyId]
    );
    if (policyRow.rows.length === 0) return res.status(404).json({ error: 'Policy not found' });
    const baseId = (policyRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const RowPolicyService = (await import('../services/tablePlatform/RowPolicyService.js'))
      .default;
    const ok = await RowPolicyService.deletePolicy(policyId);
    if (!ok) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteRowPolicy');
  }
});

// ==========================================
// TABLE-TO-TABLE SYNC
// ==========================================

router.post('/table-syncs', async (req: Request, res: Response) => {
  try {
    const { sourceTableId, targetTableId, fieldMapping, syncMode, filterConfig } = req.body ?? {};
    if (!sourceTableId || typeof sourceTableId !== 'string') {
      return res.status(400).json({ error: 'sourceTableId is required' });
    }
    if (!targetTableId || typeof targetTableId !== 'string') {
      return res.status(400).json({ error: 'targetTableId is required' });
    }
    if (!fieldMapping || typeof fieldMapping !== 'object') {
      return res.status(400).json({ error: 'fieldMapping is required' });
    }
    const TableSyncService = (await import('../services/tablePlatform/TableSyncService.js'))
      .default;
    const sync = await TableSyncService.createSync(
      sourceTableId,
      targetTableId,
      fieldMapping,
      syncMode ?? 'one_way',
      filterConfig
    );
    return res.status(201).json(sync);
  } catch (err) {
    handleRouteError(err, res, 'createTableSync');
  }
});

router.get('/tables/:tableId/syncs', async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const TableSyncService = (await import('../services/tablePlatform/TableSyncService.js'))
      .default;
    const syncs = await TableSyncService.listSyncs(tableId);
    return res.status(200).json(syncs);
  } catch (err) {
    handleRouteError(err, res, 'listTableSyncs');
  }
});

router.post('/table-syncs/:syncId/execute', async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    if (!syncId) return res.status(400).json({ error: 'syncId is required' });
    const TableSyncService = (await import('../services/tablePlatform/TableSyncService.js'))
      .default;
    const stats = await TableSyncService.executeSync(syncId);
    return res.status(200).json(stats);
  } catch (err) {
    handleRouteError(err, res, 'executeTableSync');
  }
});

router.delete('/table-syncs/:syncId', async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    if (!syncId) return res.status(400).json({ error: 'syncId is required' });
    const TableSyncService = (await import('../services/tablePlatform/TableSyncService.js'))
      .default;
    const ok = await TableSyncService.deleteSync(syncId);
    if (!ok) {
      return res.status(404).json({ error: 'Sync config not found' });
    }
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteTableSync');
  }
});

// ==========================================
// DISTRIBUTIONS API
// ==========================================

router.post(
  '/bases/:baseId/distributions',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const { baseId } = req.params;
      const { name, sourceType, sourceId, channel, channelConfig, schedule, format } =
        req.body ?? {};
      if (!name || !sourceType || !sourceId || !channel) {
        return res
          .status(400)
          .json({ error: 'name, sourceType, sourceId, and channel are required' });
      }
      const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
        .default;
      const dist = await DistributionService.createDistribution({
        name,
        baseId,
        sourceType,
        sourceId,
        channel,
        channelConfig: channelConfig ?? {},
        schedule,
        format,
        userId: userId!,
      });
      return res.status(201).json(dist);
    } catch (err) {
      handleRouteError(err, res, 'createDistribution');
    }
  }
);

router.get(
  '/bases/:baseId/distributions',
  requireBaseAccess,
  async (req: Request, res: Response) => {
    try {
      const { baseId } = req.params;
      const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
        .default;
      const distributions = await DistributionService.listDistributions(baseId);
      return res.status(200).json(distributions);
    } catch (err) {
      handleRouteError(err, res, 'listDistributions');
    }
  }
);

router.get('/distributions/:distributionId', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params;
    if (!distributionId) return res.status(400).json({ error: 'distributionId is required' });
    const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
      .default;
    const dist = await DistributionService.getDistribution(distributionId);
    if (!dist) return res.status(404).json({ error: 'Distribution not found' });
    return res.status(200).json(dist);
  } catch (err) {
    handleRouteError(err, res, 'getDistribution');
  }
});

router.patch('/distributions/:distributionId', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params;
    if (!distributionId) return res.status(400).json({ error: 'distributionId is required' });
    const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
      .default;
    const dist = await DistributionService.updateDistribution(distributionId, req.body ?? {});
    if (!dist) return res.status(404).json({ error: 'Distribution not found' });
    return res.status(200).json(dist);
  } catch (err) {
    handleRouteError(err, res, 'updateDistribution');
  }
});

router.delete('/distributions/:distributionId', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params;
    if (!distributionId) return res.status(400).json({ error: 'distributionId is required' });
    const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
      .default;
    const ok = await DistributionService.deleteDistribution(distributionId);
    if (!ok) return res.status(404).json({ error: 'Distribution not found' });
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteDistribution');
  }
});

router.post('/distributions/:distributionId/toggle', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params;
    if (!distributionId) return res.status(400).json({ error: 'distributionId is required' });
    const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
      .default;
    const dist = await DistributionService.toggleDistribution(distributionId);
    if (!dist) return res.status(404).json({ error: 'Distribution not found' });
    return res.status(200).json(dist);
  } catch (err) {
    handleRouteError(err, res, 'toggleDistribution');
  }
});

router.post('/distributions/:distributionId/execute', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params;
    if (!distributionId) return res.status(400).json({ error: 'distributionId is required' });
    const DistributionService = (await import('../services/tablePlatform/DistributionService.js'))
      .default;
    const result = await DistributionService.executeDistribution(distributionId);
    return res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res, 'executeDistribution');
  }
});

// ==========================================
// SCIM 2.0 PROVISIONING API
// ==========================================

const scimRouter = Router();

async function verifySCIMAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Bearer token required',
      status: '401',
    });
  }
  const token = authHeader.slice(7);
  const validation = await scimService.validateSCIMToken(token);
  if (!validation.valid || !validation.organizationId) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM token',
      status: '401',
    });
  }
  (req as any).scimOrganizationId = validation.organizationId;
  next();
}

scimRouter.use(verifySCIMAuth);

scimRouter.get('/Users', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).scimOrganizationId;
    const filter = typeof req.query.filter === 'string' ? req.query.filter : undefined;
    const startIndex = req.query.startIndex ? parseInt(String(req.query.startIndex), 10) : 1;
    const count = req.query.count ? parseInt(String(req.query.count), 10) : 100;
    const result = await scimService.listUsers(organizationId, filter, startIndex, count);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('[SCIM] listUsers failed', { error: (err as Error).message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: '500',
    });
  }
});

scimRouter.get('/Users/:id', async (req: Request, res: Response) => {
  try {
    const user = await scimService.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }
    return res.status(200).json(user);
  } catch (err) {
    logger.error('[SCIM] getUser failed', { error: (err as Error).message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: '500',
    });
  }
});

scimRouter.post('/Users', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).scimOrganizationId;
    const user = await scimService.createUser(organizationId, req.body);
    return res.status(201).json(user);
  } catch (err) {
    logger.error('[SCIM] createUser failed', { error: (err as Error).message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: '500',
    });
  }
});

scimRouter.put('/Users/:id', async (req: Request, res: Response) => {
  try {
    const user = await scimService.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }
    return res.status(200).json(user);
  } catch (err) {
    logger.error('[SCIM] updateUser failed', { error: (err as Error).message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: '500',
    });
  }
});

scimRouter.delete('/Users/:id', async (req: Request, res: Response) => {
  try {
    await scimService.deactivateUser(req.params.id);
    return res.status(204).send();
  } catch (err) {
    logger.error('[SCIM] deactivateUser failed', { error: (err as Error).message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: '500',
    });
  }
});

router.use('/scim/v2', scimRouter);

// ============================================================================
// RECORD TEMPLATES
// ============================================================================

router.get('/tables/:tableId/record-templates', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const db = (await import('../database/Database.js')).getDatabase();
    const { tableId } = req.params;
    const tableRow = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
    if (tableRow.rows.length === 0) return res.status(404).json({ error: 'Table not found' });
    const baseId = (tableRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `SELECT * FROM tp_records WHERE table_id = $1 AND (data->>'_is_template')::boolean = true ORDER BY created_at DESC`,
      [tableId]
    );
    return res.status(200).json({
      templates: result.rows.map((r: any) => ({
        id: r.id,
        name: r.data?._template_name ?? 'Untitled',
        data: r.data,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    handleRouteError(err, res, 'listRecordTemplates');
  }
});

router.post('/tables/:tableId/record-templates', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const db = (await import('../database/Database.js')).getDatabase();
    const { tableId } = req.params;
    const tableRow = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
    if (tableRow.rows.length === 0) return res.status(404).json({ error: 'Table not found' });
    const baseId = (tableRow.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const { name, data } = req.body;
    const templateData = { ...data, _is_template: true, _template_name: name };
    const result = await db.query(
      `INSERT INTO tp_records (id, table_id, data) VALUES (gen_random_uuid(), $1, $2) RETURNING *`,
      [tableId, JSON.stringify(templateData)]
    );
    const row = result.rows[0] as any;
    return res.status(201).json({ id: row.id, name, data: row.data, createdAt: row.created_at });
  } catch (err) {
    handleRouteError(err, res, 'createRecordTemplate');
  }
});

router.patch('/record-templates/:templateId', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const db = (await import('../database/Database.js')).getDatabase();
    const { templateId } = req.params;
    const { name, data } = req.body;
    const existing = await db.query(
      `SELECT r.*, t.base_id FROM tp_records r JOIN tp_tables t ON t.id = r.table_id WHERE r.id = $1`,
      [templateId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const baseId = (existing.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const oldData = (existing.rows[0] as any).data ?? {};
    const newData = {
      ...oldData,
      ...(data ?? {}),
      _is_template: true,
      _template_name: name ?? oldData._template_name,
    };
    const result = await db.query(
      'UPDATE tp_records SET data = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [JSON.stringify(newData), templateId]
    );
    const row = result.rows[0] as any;
    return res.status(200).json({
      id: row.id,
      name: newData._template_name,
      data: row.data,
      createdAt: row.created_at,
    });
  } catch (err) {
    handleRouteError(err, res, 'updateRecordTemplate');
  }
});

router.delete('/record-templates/:templateId', async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const userId = authReq.userId || authReq.user?.id;
    const orgId = authReq.organizationId;
    const db = (await import('../database/Database.js')).getDatabase();
    const { templateId } = req.params;
    const existing = await db.query(
      `SELECT r.*, t.base_id FROM tp_records r JOIN tp_tables t ON t.id = r.table_id WHERE r.id = $1`,
      [templateId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const baseId = (existing.rows[0] as any).base_id;
    const allowed = await PermissionsService.canAccessBase(userId, orgId, baseId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM tp_records WHERE id = $1', [templateId]);
    return res.status(204).send();
  } catch (err) {
    handleRouteError(err, res, 'deleteRecordTemplate');
  }
});

// ============================================================================
// DEPENDENCY CONFIG (GET/PUT)
// ============================================================================

router.get('/tables/:tableId/dependency-config', async (req: Request, res: Response) => {
  try {
    const db = (await import('../database/Database.js')).getDatabase();
    const { tableId } = req.params;

    const result = await db.query('SELECT dependency_config FROM tp_tables WHERE id = $1', [
      tableId,
    ]);
    const row = result.rows[0] as { dependency_config: Record<string, unknown> | null } | undefined;
    const config = row?.dependency_config ?? null;

    return res.status(200).json({ config });
  } catch (err) {
    handleRouteError(err, res, 'getDependencyConfig');
  }
});

router.put('/tables/:tableId/dependency-config', async (req: Request, res: Response) => {
  try {
    const db = (await import('../database/Database.js')).getDatabase();
    const { tableId } = req.params;
    const { config } = req.body;

    await db.query(
      'UPDATE tp_tables SET dependency_config = $1, updated_at = NOW() WHERE id = $2',
      [config ? JSON.stringify(config) : null, tableId]
    );

    return res.status(200).json({ success: true, config: config ?? null });
  } catch (err) {
    handleRouteError(err, res, 'putDependencyConfig');
  }
});

router.post(
  '/tables/:tableId/date-dependencies/recalculate',
  async (req: Request, res: Response) => {
    try {
      const { DateDependencyEngine } =
        await import('../services/tablePlatform/DateDependencyEngine.js');
      const db = (await import('../database/Database.js')).getDatabase();
      const { tableId } = req.params;
      const { config } = req.body;

      const recordsResult = await db.query('SELECT * FROM tp_records WHERE table_id = $1', [
        tableId,
      ]);
      const rawRecords = recordsResult.rows as Array<{ id: string; data: Record<string, any> }>;

      const toRecordDateData = (r: { id: string; data: Record<string, any> }) => ({
        recordId: r.id,
        startDate: r.data?.[config.startDateFieldId] ?? null,
        endDate: r.data?.[config.endDateFieldId] ?? null,
        duration: config.durationFieldId ? (r.data?.[config.durationFieldId] ?? null) : null,
        predecessorIds: config.predecessorFieldId
          ? Array.isArray(r.data?.[config.predecessorFieldId])
            ? r.data[config.predecessorFieldId]
            : []
          : [],
        dependencyType: config.dependencyTypeFieldId
          ? (r.data?.[config.dependencyTypeFieldId] ?? config.defaultDependencyType ?? 'FS')
          : (config.defaultDependencyType ?? 'FS'),
        lagDays: config.lagFieldId
          ? Number(r.data?.[config.lagFieldId]) || (config.defaultLagDays ?? 0)
          : (config.defaultLagDays ?? 0),
      });

      const records = rawRecords.map(toRecordDateData);
      const engine = new DateDependencyEngine(config);
      const updates = engine.recalculateDates(records);

      let updatedCount = 0;
      for (const update of updates) {
        if (!update.changed) continue;
        const raw = rawRecords.find((r) => r.id === update.recordId);
        if (!raw) continue;
        const newData = { ...raw.data };
        if (update.startDate !== null) newData[config.startDateFieldId] = update.startDate;
        if (update.endDate !== null) newData[config.endDateFieldId] = update.endDate;
        if (config.durationFieldId && update.duration !== null)
          newData[config.durationFieldId] = update.duration;
        await db.query('UPDATE tp_records SET data = $1, updated_at = now() WHERE id = $2', [
          JSON.stringify(newData),
          update.recordId,
        ]);
        updatedCount++;
      }

      return res.status(200).json({ success: true, updatedRecords: updatedCount });
    } catch (err) {
      handleRouteError(err, res, 'recalculateDateDependencies');
    }
  }
);

router.post(
  '/tables/:tableId/date-dependencies/detect-cycle',
  async (req: Request, res: Response) => {
    try {
      const { DateDependencyEngine } =
        await import('../services/tablePlatform/DateDependencyEngine.js');
      const db = (await import('../database/Database.js')).getDatabase();
      const { tableId } = req.params;
      const { config } = req.body;

      const recordsResult = await db.query('SELECT * FROM tp_records WHERE table_id = $1', [
        tableId,
      ]);
      const rawRecords = recordsResult.rows as Array<{ id: string; data: Record<string, any> }>;

      const records = rawRecords.map((r) => ({
        recordId: r.id,
        startDate: r.data?.[config.startDateFieldId] ?? null,
        endDate: r.data?.[config.endDateFieldId] ?? null,
        duration: config.durationFieldId ? (r.data?.[config.durationFieldId] ?? null) : null,
        predecessorIds: config.predecessorFieldId
          ? Array.isArray(r.data?.[config.predecessorFieldId])
            ? r.data[config.predecessorFieldId]
            : []
          : [],
        dependencyType: (config.defaultDependencyType ?? 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
        lagDays: config.defaultLagDays ?? 0,
      }));

      const engine = new DateDependencyEngine(config);
      const cycleNodes = engine.detectCycle(records);

      return res.status(200).json({ hasCycle: cycleNodes !== null, cycleNodes });
    } catch (err) {
      handleRouteError(err, res, 'detectDateDependencyCycle');
    }
  }
);

// ============================================================================
// FIELD REORDER
// ============================================================================

router.post('/tables/:tableId/fields/reorder', async (req: Request, res: Response) => {
  try {
    const db = (await import('../database/Database.js')).getDatabase();
    const { tableId } = req.params;
    const { fieldIds } = req.body;

    if (!Array.isArray(fieldIds))
      return res.status(400).json({ error: 'fieldIds must be an array' });

    for (let i = 0; i < fieldIds.length; i++) {
      await db.query('UPDATE tp_fields SET field_order = $1 WHERE id = $2 AND table_id = $3', [
        i,
        fieldIds[i],
        tableId,
      ]);
    }

    return res.status(200).json({ success: true, reordered: fieldIds.length });
  } catch (err) {
    handleRouteError(err, res, 'reorderFields');
  }
});

router.post('/admin/scim/token', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context required' });
    const result = await scimService.generateSCIMToken(organizationId);
    return res.status(201).json(result);
  } catch (err) {
    handleRouteError(err, res, 'generateSCIMToken');
  }
});

export default router;
