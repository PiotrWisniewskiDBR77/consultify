/**
 * PMO Roles Routes
 * Full CRUD implementation for PMO role and permission management
 *
 * Endpoints:
 * - GET /api/pmo-roles - List all roles (system + custom)
 * - GET /api/pmo-roles/:id - Get single role
 * - POST /api/pmo-roles - Create custom role
 * - PUT /api/pmo-roles/:id - Update custom role
 * - DELETE /api/pmo-roles/:id - Delete custom role
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// System roles (predefined, cannot be deleted)
const SYSTEM_ROLES = [
  {
    id: 'project-executive',
    name: 'Project Executive / Sponsor',
    description: 'Ultimate decision authority, budget approval, strategic direction',
    level: 0,
    levelLabel: 'Executive',
    permissions: [
      'approve_budget',
      'strategic_decisions',
      'escalation_final',
      'governance_override',
      'stakeholder_liaison',
    ],
    isSystem: true,
    color: 'amber',
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Day-to-day project management, team coordination, reporting',
    level: 1,
    levelLabel: 'Manager',
    permissions: [
      'manage_project',
      'assign_tasks',
      'manage_team',
      'approve_changes',
      'view_reports',
      'manage_schedule',
      'risk_management',
    ],
    isSystem: true,
    color: 'blue',
  },
  {
    id: 'workstream-lead',
    name: 'Workstream Lead',
    description: 'Lead specific workstream, coordinate deliverables',
    level: 2,
    levelLabel: 'Lead',
    permissions: [
      'manage_workstream',
      'assign_tasks',
      'approve_deliverables',
      'view_reports',
      'escalate_issues',
    ],
    isSystem: true,
    color: 'violet',
  },
  {
    id: 'team-member',
    name: 'Team Member',
    description: 'Execute tasks, collaborate on deliverables',
    level: 3,
    levelLabel: 'Team',
    permissions: [
      'execute_tasks',
      'update_status',
      'view_project',
      'collaborate',
      'request_support',
    ],
    isSystem: true,
    color: 'green',
  },
  {
    id: 'stakeholder',
    name: 'Stakeholder',
    description: 'View project status, provide feedback',
    level: 4,
    levelLabel: 'Stakeholder',
    permissions: ['view_project', 'view_reports', 'provide_feedback'],
    isSystem: true,
    color: 'slate',
  },
  {
    id: 'portfolio-manager',
    name: 'Portfolio Manager',
    description: 'Oversee multiple projects, resource allocation',
    level: 0,
    levelLabel: 'Executive',
    permissions: [
      'view_all_projects',
      'approve_resources',
      'strategic_planning',
      'portfolio_reports',
      'budget_allocation',
    ],
    isSystem: true,
    color: 'rose',
  },
];

// Ensure custom_roles table exists
const ensureTableExists = async () => {
  const createTableSQL = `
        CREATE TABLE IF NOT EXISTS custom_roles (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            level INTEGER DEFAULT 3,
            level_label TEXT DEFAULT 'Custom',
            permissions TEXT, -- JSON array
            color TEXT DEFAULT 'gray',
            is_system INTEGER DEFAULT 0,
            user_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
    `;
  await dbRun(createTableSQL, []);
};

/**
 * GET /api/pmo-roles
 * Get all roles (system + custom) for organization
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const orgId = req.user?.organizationId;
    const includeCustom = req.query.includeCustom !== 'false';

    // H5.3 (N+1): fetch user counts for ALL system roles in one grouped query
    // instead of one COUNT query per role. Response contract is unchanged —
    // counts are looked up in-memory by role id below.
    const roleIds = SYSTEM_ROLES.map((r) => r.id);
    const countRows = await dbAll<{ project_role: string; count: number }>(
      `SELECT project_role, COUNT(*) as count
         FROM users
        WHERE organization_id = ? AND project_role IN (${roleIds.map(() => '?').join(', ')})
        GROUP BY project_role`,
      [orgId, ...roleIds]
    );
    const countByRole = new Map<string, number>();
    for (const row of countRows) {
      countByRole.set(String(row.project_role), Number(row.count) || 0);
    }
    const systemRolesWithCounts = SYSTEM_ROLES.map((role) => ({
      ...role,
      userCount: countByRole.get(role.id) || 0,
    }));

    let allRoles: Array<{
      id: string;
      name: string;
      description: string | null;
      level: number;
      levelLabel: string;
      permissions: string[];
      isSystem: boolean;
      color: string;
      userCount: number;
      organizationId?: string;
      createdAt?: string;
      updatedAt?: string;
    }> = [...systemRolesWithCounts];

    // Include custom roles if requested and organization is provided
    if (includeCustom && orgId) {
      const customRoles = await dbAll<{
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        level: number;
        level_label: string;
        permissions: string;
        color: string;
        is_system: number;
        user_count: number;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM custom_roles WHERE organization_id = ? ORDER BY level, name`, [orgId]);

      const formattedCustomRoles = customRoles.map((r) => ({
        id: r.id,
        organizationId: r.organization_id,
        name: r.name,
        description: r.description,
        level: r.level,
        levelLabel: r.level_label,
        permissions: JSON.parse(r.permissions || '[]') as string[],
        color: r.color,
        isSystem: false,
        userCount: r.user_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })) as typeof systemRolesWithCounts;

      allRoles = [...allRoles, ...formattedCustomRoles];
    }

    return res.json(allRoles);
  })
);

/**
 * GET /api/pmo-roles/:id
 * Get single role by ID
 */
router.get(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { id } = req.params;
    const orgId = req.user?.organizationId;

    // Check system roles first
    const systemRole = SYSTEM_ROLES.find((r) => r.id === id);
    if (systemRole) {
      const countResult = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND project_role = ?`,
        [orgId, id]
      );
      return res.json({
        ...systemRole,
        userCount: countResult?.count || 0,
      });
    }

    // Check custom roles
    const customRole = await dbGet<{
      id: string;
      organization_id: string;
      name: string;
      description: string | null;
      level: number;
      level_label: string;
      permissions: string;
      color: string;
      user_count: number;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM custom_roles WHERE id = ? AND organization_id = ?`, [id, orgId]);

    if (!customRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    return res.json({
      id: customRole.id,
      organizationId: customRole.organization_id,
      name: customRole.name,
      description: customRole.description,
      level: customRole.level,
      levelLabel: customRole.level_label,
      permissions: JSON.parse(customRole.permissions || '[]'),
      color: customRole.color,
      isSystem: false,
      userCount: customRole.user_count,
      createdAt: customRole.created_at,
      updatedAt: customRole.updated_at,
    });
  })
);

/**
 * POST /api/pmo-roles
 * Create custom role (Admin only)
 */
router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, level, levelLabel, permissions, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check for duplicate name
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM custom_roles WHERE organization_id = ? AND LOWER(name) = LOWER(?)`,
      [orgId, name]
    );

    if (existing) {
      return res.status(400).json({ error: 'A role with this name already exists' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
            INSERT INTO custom_roles (id, organization_id, name, description, level, level_label, permissions, color, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const result = await dbRun(sql, [
      id,
      orgId,
      name,
      description || null,
      level || 3,
      levelLabel || 'Custom',
      JSON.stringify(permissions || []),
      color || 'gray',
      now,
      now,
    ]);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create role');
    }

    logger.info(`Custom role created: ${name} (${id}) in org ${orgId}`);

    return res.status(201).json({
      id,
      organizationId: orgId,
      name,
      description,
      level: level || 3,
      levelLabel: levelLabel || 'Custom',
      permissions: permissions || [],
      color: color || 'gray',
      isSystem: false,
      userCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  })
);

/**
 * PUT /api/pmo-roles/:id
 * Update custom role (Admin only)
 */
router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if it's a system role (cannot edit)
    const systemRole = SYSTEM_ROLES.find((r) => r.id === id);
    if (systemRole) {
      return res.status(403).json({ error: 'System roles cannot be modified' });
    }

    // Check if role exists
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM custom_roles WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const { name, description, level, levelLabel, permissions, color } = req.body;
    const now = new Date().toISOString();

    const sql = `
            UPDATE custom_roles SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                level = COALESCE(?, level),
                level_label = COALESCE(?, level_label),
                permissions = COALESCE(?, permissions),
                color = COALESCE(?, color),
                updated_at = ?
            WHERE id = ? AND organization_id = ?
        `;

    const result = await dbRun(sql, [
      name,
      description,
      level,
      levelLabel,
      permissions ? JSON.stringify(permissions) : null,
      color,
      now,
      id,
      orgId,
    ]);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update role');
    }

    logger.info(`Custom role updated: ${id} in org ${orgId}`);

    return res.json({ message: 'Role updated successfully' });
  })
);

/**
 * DELETE /api/pmo-roles/:id
 * Delete custom role (Admin only)
 */
router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if it's a system role (cannot delete)
    const systemRole = SYSTEM_ROLES.find((r) => r.id === id);
    if (systemRole) {
      return res.status(403).json({ error: 'System roles cannot be deleted' });
    }

    // Check if role is in use
    const usersWithRole = await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND project_role = ?`,
      [orgId, id]
    );

    if (usersWithRole && usersWithRole.count > 0) {
      return res.status(400).json({
        error: `Cannot delete role: ${usersWithRole.count} users have this role assigned`,
      });
    }

    const result = await dbRun(`DELETE FROM custom_roles WHERE id = ? AND organization_id = ?`, [
      id,
      orgId,
    ]);

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    logger.info(`Custom role deleted: ${id} in org ${orgId}`);

    return res.json({ message: 'Role deleted successfully' });
  })
);

export default router;
