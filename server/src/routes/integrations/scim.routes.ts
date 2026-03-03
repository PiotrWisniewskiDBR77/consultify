/**
 * SCIM Routes - System for Cross-domain Identity Management
 *
 * Protocol endpoints: /Users, /Groups (SCIM 2.0 standard)
 * Admin endpoints: /admin/service-provider, /admin/tokens, /admin/group-mappings, /admin/sync-logs
 */
import crypto from 'crypto';

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

const ensureScimTables = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_service_providers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    base_url TEXT,
    patch_supported INTEGER DEFAULT 1,
    filter_supported INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 0,
    last_sync_at TEXT,
    sync_status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    scopes TEXT DEFAULT '[]',
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_group_mappings (
    id TEXT PRIMARY KEY,
    external_group_id TEXT NOT NULL,
    external_group_name TEXT NOT NULL,
    internal_role TEXT NOT NULL DEFAULT 'member',
    custom_role_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_sync_logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
};

// ── SCIM Bearer Token Auth ──

const verifyScimToken = asyncHandler(async (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Authorization required',
      status: '401',
    });
  }
  const token = authHeader.slice(7);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await ensureScimTables();
  const row = await dbGet<{ id: string; is_active: number }>(
    'SELECT id, is_active FROM scim_tokens WHERE token_hash = ? AND is_active = 1',
    [hash]
  );
  if (!row) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid or expired SCIM token',
      status: '401',
    });
  }
  await dbRun('UPDATE scim_tokens SET last_used_at = datetime(\'now\'), usage_count = usage_count + 1 WHERE id = ?', [row.id]);
  next();
});

// ── SCIM 2.0 Protocol Endpoints ──

router.get(
  '/Users',
  verifyScimToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { startIndex = '1', count = '100' } = req.query;
    const parsedCount = Math.max(1, Math.min(1000, parseInt(count as string, 10) || 100));
    const parsedStart = Math.max(1, parseInt(startIndex as string, 10) || 1);
    const users = await dbAll(
      `SELECT id, email, first_name, last_name, is_active FROM users LIMIT ? OFFSET ?`,
      [parsedCount, parsedStart - 1]
    );
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (users || []).length,
      startIndex: parsedStart,
      itemsPerPage: parsedCount,
      Resources: (users || []).map((u: any) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: u.id,
        userName: u.email,
        active: !!u.is_active,
        name: { givenName: u.first_name, familyName: u.last_name },
      })),
    });
  })
);

router.post(
  '/Users',
  verifyScimToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { userName, name, active } = req.body;
    if (!userName) return res.status(400).json({ error: 'userName required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO users (id, email, first_name, last_name, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, userName, name?.givenName || '', name?.familyName || '', active !== false ? 1 : 0]
    );
    logger.info(`[SCIM] Created user: ${userName}`);
    res.status(201).json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id, userName });
  })
);

router.get(
  '/Groups',
  verifyScimToken,
  asyncHandler(async (_req: Request, res: Response) => {
    const groups = await dbAll('SELECT id, name FROM groups LIMIT 100', [], { fallback: true });
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (groups || []).length,
      Resources: (groups || []).map((g: any) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: g.id,
        displayName: g.name,
      })),
    });
  })
);

// ── Admin Endpoints (SuperAdmin) ──

router.get(
  '/admin/service-provider',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const sp = await dbGet<any>(`SELECT * FROM scim_service_providers LIMIT 1`);
    if (!sp) {
      return res.json({ data: null });
    }
    res.json({
      data: {
        id: sp.id,
        organizationId: sp.organization_id,
        baseUrl: sp.base_url,
        patchSupported: !!sp.patch_supported,
        filterSupported: !!sp.filter_supported,
        isActive: !!sp.is_active,
        lastSyncAt: sp.last_sync_at,
        syncStatus: sp.sync_status,
      },
    });
  })
);

router.post(
  '/admin/service-provider',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { isActive } = req.body;
    await ensureScimTables();
    const existing = await dbGet<any>(`SELECT id FROM scim_service_providers LIMIT 1`);
    if (existing) {
      await dbRun(`UPDATE scim_service_providers SET is_active = ? WHERE id = ?`, [
        isActive ? 1 : 0,
        existing.id,
      ]);
    } else {
      const id = uuidv4();
      await dbRun(
        `INSERT INTO scim_service_providers (id, base_url, is_active) VALUES (?, ?, ?)`,
        [id, '/api/scim/v2', isActive ? 1 : 0]
      );
    }
    logger.info(`[SCIM] Service provider ${isActive ? 'enabled' : 'disabled'}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/tokens',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const rows = await dbAll(
      `SELECT * FROM scim_tokens ORDER BY created_at DESC`,
      [],
      { fallback: true }
    );
    const data = (rows || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tokenPrefix: t.token_prefix,
      scopes: JSON.parse(t.scopes || '[]'),
      lastUsedAt: t.last_used_at,
      usageCount: t.usage_count || 0,
      expiresAt: t.expires_at,
      isActive: !!t.is_active,
      createdAt: t.created_at,
    }));
    res.json({ data });
  })
);

router.post(
  '/admin/tokens',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, scopes } = req.body;
    if (!name) return res.status(400).json({ error: 'Token name is required' });
    await ensureScimTables();
    const id = uuidv4();
    const rawToken = `scim_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 12);
    await dbRun(
      `INSERT INTO scim_tokens (id, name, description, token_hash, token_prefix, scopes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, description || null, tokenHash, tokenPrefix, JSON.stringify(scopes || [])]
    );
    logger.info(`[SCIM] Token generated: ${name}`);
    res.json({
      data: {
        id,
        name,
        description,
        tokenPrefix,
        scopes: scopes || [],
        lastUsedAt: null,
        usageCount: 0,
        expiresAt: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        token: rawToken,
      },
    });
  })
);

router.delete(
  '/admin/tokens/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureScimTables();
    await dbRun(`DELETE FROM scim_tokens WHERE id = ?`, [req.params.id]);
    logger.info(`[SCIM] Token revoked: ${req.params.id}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/group-mappings',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const rows = await dbAll(
      `SELECT * FROM scim_group_mappings ORDER BY created_at DESC`,
      [],
      { fallback: true }
    );
    const data = (rows || []).map((m: any) => ({
      id: m.id,
      externalGroupId: m.external_group_id,
      externalGroupName: m.external_group_name,
      internalRole: m.internal_role,
      customRoleId: m.custom_role_id,
      isActive: !!m.is_active,
    }));
    res.json({ data });
  })
);

router.post(
  '/admin/group-mappings',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { externalGroupId, externalGroupName, internalRole } = req.body;
    if (!externalGroupId || !externalGroupName) {
      return res.status(400).json({ error: 'externalGroupId and externalGroupName are required' });
    }
    await ensureScimTables();
    const id = uuidv4();
    await dbRun(
      `INSERT INTO scim_group_mappings (id, external_group_id, external_group_name, internal_role)
       VALUES (?, ?, ?, ?)`,
      [id, externalGroupId, externalGroupName, internalRole || 'member']
    );
    logger.info(`[SCIM] Group mapping created: ${externalGroupName} → ${internalRole}`);
    res.json({ data: { id, externalGroupId, externalGroupName, internalRole, isActive: true } });
  })
);

router.delete(
  '/admin/group-mappings/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureScimTables();
    await dbRun(`DELETE FROM scim_group_mappings WHERE id = ?`, [req.params.id]);
    logger.info(`[SCIM] Group mapping deleted: ${req.params.id}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/sync-logs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    await ensureScimTables();
    const rows = await dbAll(
      `SELECT * FROM scim_sync_logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
      { fallback: true }
    );
    const data = (rows || []).map((l: any) => ({
      id: l.id,
      operation: l.operation,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      externalId: l.external_id,
      status: l.status,
      errorMessage: l.error_message,
      createdAt: l.created_at,
    }));
    res.json({ data });
  })
);

export default router;
