/**
 * Security Roles Routes
 *
 * Extracted from `security.routes.ts` to allow focused integration testing + coverage.
 * Mounted under `/api/security/roles` in `security.routes.ts`.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
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

router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    await ensureRolesSchema();

    const rows =
      (await dbAll(
        `SELECT id, name, permissions_json, created_at, updated_at
         FROM security_roles
         WHERE organization_id = ?
         ORDER BY created_at DESC`,
        [orgId]
      )) || [];

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
    const orgId = req.user!.organizationId;
    await ensureRolesSchema();

    const id = uuidv4();
    const now = new Date().toISOString();
    const name = String(req.body?.name || 'Custom Role');
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

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
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    await ensureRolesSchema();

    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM security_roles WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Role not found' });

    const name = req.body?.name !== undefined ? String(req.body.name) : undefined;
    const permissions =
      req.body?.permissions !== undefined
        ? Array.isArray(req.body.permissions)
          ? req.body.permissions
          : []
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
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    await ensureRolesSchema();
    await dbRun(`DELETE FROM security_roles WHERE id = ? AND organization_id = ?`, [id, orgId]);
    return res.json({ success: true });
  })
);

export default router;
