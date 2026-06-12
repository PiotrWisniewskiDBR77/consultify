/**
 * Security Roles Routes
 *
 * Extracted from `security.routes.ts` to allow focused integration testing + coverage.
 * Mounted under `/api/security/roles` in `security.routes.ts`.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../../services/effectiveAccessService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

async function ensureRolesSchema() {
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS security_roles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT
      )
    `
  );
}

async function requireProjectRolesManage(req: AuthRequest, res: any): Promise<boolean> {
  const userId = String(req.user?.id || req.userId || '').trim();
  const orgId = String(req.organizationId || req.user?.organizationId || '').trim();
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return false;
  }

  const access = await resolveEffectiveAccess({
    userId,
    organizationId: orgId,
    applicationRole: req.userRole || req.user?.role,
    isImpersonating: Boolean(req.user?.impersonatorId),
  });

  if (!hasEffectiveCapability(access, 'admin.project_roles.manage')) {
    res.status(403).json({
      error: 'Project role management permission required',
      code: 'PROJECT_ROLES_MANAGE_REQUIRED',
      required: 'admin.project_roles.manage',
    });
    return false;
  }

  return true;
}

router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireProjectRolesManage(req, res))) return;
    const orgId = req.user!.organizationId;
    await ensureRolesSchema();

    const rows = await dbAll(
      `SELECT id, name, permissions_json, created_at, updated_at
       FROM security_roles
       WHERE organization_id = ?
       ORDER BY created_at DESC`,
      [orgId]
    );

    const roles = (rows as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      permissions: (() => {
        try {
          return JSON.parse(r.permissions_json || '[]');
        } catch {
          return [];
        }
      })(),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return res.json({ roles });
  })
);

router.post(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireProjectRolesManage(req, res))) return;
    const orgId = req.user!.organizationId;
    await ensureRolesSchema();

    const rawName = req.body?.name;
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    if (
      req.body?.roleKey !== undefined &&
      (typeof req.body.roleKey !== 'string' || req.body.roleKey.trim().length === 0)
    ) {
      return res.status(400).json({ error: 'roleKey must be a non-empty string when provided' });
    }
    if (req.body?.permissions !== undefined && !Array.isArray(req.body.permissions)) {
      return res.status(400).json({ error: 'permissions must be an array when provided' });
    }
    if (req.body?.capabilities !== undefined && !Array.isArray(req.body.capabilities)) {
      return res.status(400).json({ error: 'capabilities must be an array when provided' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const name = rawName.trim();
    const rawPermissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions
      : Array.isArray(req.body?.capabilities)
        ? req.body.capabilities
        : [];
    const permissions = [...new Set<string>(rawPermissions)];

    await dbRun(
      `INSERT INTO security_roles (id, organization_id, name, permissions_json, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, name, JSON.stringify(permissions), now, now, req.user!.id, req.user!.id]
    );

    return res.json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireProjectRolesManage(req, res))) return;
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    await ensureRolesSchema();

    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM security_roles WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Role not found' });

    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
    const hasPermissions = Object.prototype.hasOwnProperty.call(req.body || {}, 'permissions');
    const hasCapabilities = Object.prototype.hasOwnProperty.call(req.body || {}, 'capabilities');

    if (!hasName && !hasPermissions && !hasCapabilities) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    let name: string | undefined;
    if (hasName) {
      if (typeof req.body?.name !== 'string') {
        return res.status(400).json({ error: 'name must be a string' });
      }
      name = req.body.name.trim();
      if (!name) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
    }

    if (hasPermissions && !Array.isArray(req.body?.permissions)) {
      return res.status(400).json({ error: 'permissions must be an array when provided' });
    }
    if (hasCapabilities && !Array.isArray(req.body?.capabilities)) {
      return res.status(400).json({ error: 'capabilities must be an array when provided' });
    }

    const permissions = hasPermissions
      ? req.body.permissions
      : hasCapabilities
        ? req.body.capabilities
        : undefined;

    await dbRun(
      `
        UPDATE security_roles
        SET
          name = COALESCE(?, name),
          permissions_json = COALESCE(?, permissions_json),
          updated_at = ?,
          updated_by = ?
        WHERE id = ? AND organization_id = ?
      `,
      [
        name ?? null,
        permissions !== undefined ? JSON.stringify(permissions) : null,
        new Date().toISOString(),
        req.user!.id,
        id,
        orgId,
      ]
    );

    return res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireProjectRolesManage(req, res))) return;
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    await ensureRolesSchema();
    await dbRun(`DELETE FROM security_roles WHERE id = ? AND organization_id = ?`, [id, orgId]);
    return res.json({ success: true });
  })
);

export default router;
