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

type RolePayloadValidation = {
  valid: boolean;
  status: number;
  error?: string;
  name?: string;
  permissions?: string[];
};

function validateRolePayload(body: unknown, options: { requireName: boolean }): RolePayloadValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid payload. Expected JSON object.',
    };
  }

  const payload = body as Record<string, unknown>;
  const roleKeyRaw = payload.roleKey;
  if (roleKeyRaw !== undefined) {
    if (typeof roleKeyRaw !== 'string' || roleKeyRaw.trim().length === 0) {
      return {
        valid: false,
        status: 400,
        error: 'roleKey must be a non-empty string when provided.',
      };
    }
  }

  const nameRaw = payload.name ?? payload.label;
  const hasNameField = nameRaw !== undefined;
  let normalizedName: string | undefined;
  if (hasNameField) {
    if (typeof nameRaw !== 'string') {
      return {
        valid: false,
        status: 400,
        error: 'name (or label) must be a string.',
      };
    }
    const trimmed = nameRaw.trim();
    if (trimmed.length === 0) {
      return {
        valid: false,
        status: 400,
        error: 'Role name cannot be empty.',
      };
    }
    normalizedName = trimmed;
  }

  if (options.requireName && !normalizedName) {
    return {
      valid: false,
      status: 400,
      error: 'Role name is required.',
    };
  }

  const permissionsRaw = payload.permissions ?? payload.capabilities;
  const hasPermissionsField = permissionsRaw !== undefined;
  let normalizedPermissions: string[] | undefined;
  if (hasPermissionsField) {
    if (!Array.isArray(permissionsRaw)) {
      return {
        valid: false,
        status: 400,
        error: 'permissions (or capabilities) must be an array of strings.',
      };
    }
    const values: string[] = [];
    for (const entry of permissionsRaw) {
      if (typeof entry !== 'string') {
        return {
          valid: false,
          status: 400,
          error: 'permissions (or capabilities) must be an array of strings.',
        };
      }
      const trimmed = entry.trim();
      if (trimmed.length === 0) {
        return {
          valid: false,
          status: 400,
          error: 'permissions (or capabilities) cannot contain empty values.',
        };
      }
      values.push(trimmed);
    }
    normalizedPermissions = Array.from(new Set(values));
  }

  return {
    valid: true,
    status: 200,
    name: normalizedName,
    permissions: normalizedPermissions,
  };
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

    const validation = validateRolePayload(req.body, { requireName: true });
    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const name = validation.name!;
    const permissions = validation.permissions ?? [];

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

    const validation = validateRolePayload(req.body, { requireName: false });
    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const name = validation.name;
    const permissions = validation.permissions;
    if (name === undefined && permissions === undefined) {
      return res
        .status(400)
        .json({ success: false, error: 'No updatable fields provided (name/label or permissions/capabilities).' });
    }

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
