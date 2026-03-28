/**
 * RBAC Routes
 *
 * Custom roles, permissions, and templates management.
 * Mounted at /api/rbac in Gateway.ts.
 * Also mounted as a final /api catch-all (no-op for unknown routes).
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

const ensureRbacTables = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS custom_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'shield',
    base_role TEXT,
    role_type TEXT DEFAULT 'custom',
    scope TEXT DEFAULT 'organization',
    priority INTEGER DEFAULT 50,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS permission_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    resource TEXT DEFAULT '*',
    action TEXT DEFAULT 'read',
    risk_level TEXT DEFAULT 'low',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS role_permission_assignments (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    grant_type TEXT DEFAULT 'allow',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(role_id, permission_id)
  )`);
};

const ROLE_TEMPLATES = [
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to all resources',
    color: '#3b82f6',
    icon: 'eye',
    permissions: ['read:projects', 'read:reports', 'read:dashboard'],
  },
  {
    name: 'editor',
    displayName: 'Editor',
    description: 'Can edit content and manage projects',
    color: '#22c55e',
    icon: 'edit',
    permissions: [
      'read:projects',
      'write:projects',
      'read:reports',
      'write:reports',
      'read:dashboard',
    ],
  },
  {
    name: 'project_manager',
    displayName: 'Project Manager',
    description: 'Full project management with team oversight',
    color: '#8b5cf6',
    icon: 'briefcase',
    permissions: [
      'read:projects',
      'write:projects',
      'delete:projects',
      'read:reports',
      'write:reports',
      'read:dashboard',
      'manage:team',
    ],
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full administrative access',
    color: '#ef4444',
    icon: 'shield',
    permissions: [
      'read:projects',
      'write:projects',
      'delete:projects',
      'read:reports',
      'write:reports',
      'read:dashboard',
      'manage:team',
      'manage:settings',
      'manage:users',
    ],
  },
];

// ── Roles ──

router.get(
  '/roles',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureRbacTables();
    const rows = await dbAll(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM role_permission_assignments rpa WHERE rpa.role_id = r.id) as permission_count
       FROM custom_roles r
       ORDER BY r.priority ASC, r.name ASC`,
      [],
      { fallback: true }
    );
    const data = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      description: r.description,
      color: r.color || '#6366f1',
      icon: r.icon || 'shield',
      baseRole: r.base_role,
      roleType: r.role_type || 'custom',
      scope: r.scope || 'organization',
      priority: r.priority || 50,
      isActive: !!r.is_active,
      isDefault: !!r.is_default,
      userCount: 0,
      permissionCount: r.permission_count || 0,
    }));
    res.json({ data });
  })
);

router.post(
  '/roles',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, displayName, description, color, icon, baseRole, priority } = req.body;
    if (!name || !displayName) {
      return res.status(400).json({ error: 'name and displayName are required' });
    }
    await ensureRbacTables();
    const id = uuidv4();
    await dbRun(
      `INSERT INTO custom_roles (id, name, display_name, description, color, icon, base_role, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        displayName,
        description || null,
        color || '#6366f1',
        icon || 'shield',
        baseRole || null,
        priority || 50,
      ]
    );
    logger.info(`[RBAC] Role created: ${name}`);
    res.json({ data: { id, name, displayName, description, color, icon, isActive: true } });
  })
);

router.delete(
  '/roles/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureRbacTables();
    const role = await dbGet<any>(`SELECT * FROM custom_roles WHERE id = ?`, [req.params.id]);
    if (role?.role_type === 'system') {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }
    await dbRun(`DELETE FROM role_permission_assignments WHERE role_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM custom_roles WHERE id = ?`, [req.params.id]);
    logger.info(`[RBAC] Role deleted: ${req.params.id}`);
    res.json({ success: true });
  })
);

router.post(
  '/roles/from-template',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { templateName } = req.body;
    const template = ROLE_TEMPLATES.find((t) => t.name === templateName);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    await ensureRbacTables();
    const existing = await dbGet<any>(`SELECT id FROM custom_roles WHERE name = ?`, [
      template.name,
    ]);
    if (existing) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }
    const id = uuidv4();
    await dbRun(
      `INSERT INTO custom_roles (id, name, display_name, description, color, icon, role_type)
       VALUES (?, ?, ?, ?, ?, ?, 'template')`,
      [id, template.name, template.displayName, template.description, template.color, template.icon]
    );
    logger.info(`[RBAC] Role created from template: ${template.name}`);
    res.json({ data: { id, name: template.name, displayName: template.displayName } });
  })
);

// ── Permissions ──

router.get(
  '/permissions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureRbacTables();
    const rows = await dbAll(
      `SELECT * FROM permission_definitions ORDER BY category ASC, name ASC`,
      [],
      { fallback: true }
    );
    const data = (rows || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      description: p.description,
      category: p.category || 'general',
      resource: p.resource || '*',
      action: p.action || 'read',
      riskLevel: p.risk_level || 'low',
    }));
    res.json({ data });
  })
);

// ── Role Permissions ──

router.get(
  '/roles/:roleId/permissions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureRbacTables();
    const rows = await dbAll(
      `SELECT rpa.id, rpa.permission_id, rpa.grant_type,
              pd.name as permission_name, pd.display_name, pd.category, pd.risk_level
       FROM role_permission_assignments rpa
       LEFT JOIN permission_definitions pd ON pd.id = rpa.permission_id
       WHERE rpa.role_id = ?
       ORDER BY pd.category ASC, pd.name ASC`,
      [req.params.roleId],
      { fallback: true }
    );
    const data = (rows || []).map((r: any) => ({
      id: r.id,
      permissionId: r.permission_id,
      permissionName: r.permission_name || r.permission_id,
      displayName: r.display_name || r.permission_name,
      category: r.category || 'general',
      grantType: r.grant_type || 'allow',
      riskLevel: r.risk_level || 'low',
    }));
    res.json({ data });
  })
);

router.post(
  '/roles/:roleId/permissions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { permissionId, grantType } = req.body;
    if (!permissionId) {
      return res.status(400).json({ error: 'permissionId is required' });
    }
    await ensureRbacTables();
    const id = uuidv4();
    await dbRun(
      `INSERT OR REPLACE INTO role_permission_assignments (id, role_id, permission_id, grant_type)
       VALUES (?, ?, ?, ?)`,
      [id, req.params.roleId, permissionId, grantType || 'allow']
    );
    res.json({ success: true, id });
  })
);

router.delete(
  '/roles/:roleId/permissions/:permissionId',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureRbacTables();
    await dbRun(`DELETE FROM role_permission_assignments WHERE role_id = ? AND permission_id = ?`, [
      req.params.roleId,
      req.params.permissionId,
    ]);
    res.json({ success: true });
  })
);

// ── Templates ──

router.get(
  '/templates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: ROLE_TEMPLATES });
  })
);

export default router;
