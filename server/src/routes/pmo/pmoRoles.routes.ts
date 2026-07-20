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

// Ensure pmo_roles table exists (org-scoped PMO roles).
// NOTE: intentionally NOT `custom_roles` — that name belongs to the GLOBAL RBAC
// table (rbac.routes.ts + migration 200) with a different schema (display_name /
// icon / base_role / role_type / scope, UNIQUE(name) only). Reusing it caused a
// silent schema collision (42703 undefined_column) here. See migration
// server/migrations/20260720_pmo_roles_table.sql. Postgres-native.
const ensureTableExists = async () => {
  const createTableSQL = `
        CREATE TABLE IF NOT EXISTS pmo_roles (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            level INTEGER DEFAULT 3,
            level_label TEXT DEFAULT 'Custom',
            permissions TEXT, -- JSON array
            color TEXT DEFAULT 'gray',
            is_system BOOLEAN DEFAULT FALSE,
            user_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT pmo_roles_org_name_unique UNIQUE (organization_id, name),
            CONSTRAINT pmo_roles_org_fk FOREIGN KEY (organization_id)
                REFERENCES organizations(id) ON DELETE CASCADE
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
      }>(`SELECT * FROM pmo_roles WHERE organization_id = ? ORDER BY level, name`, [orgId]);

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
    }>(`SELECT * FROM pmo_roles WHERE id = ? AND organization_id = ?`, [id, orgId]);

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
      `SELECT id FROM pmo_roles WHERE organization_id = ? AND LOWER(name) = LOWER(?)`,
      [orgId, name]
    );

    if (existing) {
      return res.status(400).json({ error: 'A role with this name already exists' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
            INSERT INTO pmo_roles (id, organization_id, name, description, level, level_label, permissions, color, created_at, updated_at)
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
      `SELECT id FROM pmo_roles WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const { name, description, level, levelLabel, permissions, color } = req.body;
    const now = new Date().toISOString();

    const sql = `
            UPDATE pmo_roles SET
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

    const result = await dbRun(`DELETE FROM pmo_roles WHERE id = ? AND organization_id = ?`, [
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

// ==========================================
// PROJECT TEAM BOARD
// (src/components/Projects/ProjectTeamBoard.tsx)
// ==========================================
//
// NOTE: dedicated `project_team_members` table (NOT the legacy free-text-role
// `project_members` table from 542_...). See
// server/migrations/20260720_project_team_members.sql for rationale.
//
// LEVEL_CONFIG in ProjectTeamBoard.tsx: 0=executive,1=manager,2=lead,3=member,4=stakeholder.

const LEVEL_KEY_BY_NUMBER: Record<number, string> = {
  0: 'executive',
  1: 'manager',
  2: 'lead',
  3: 'member',
  4: 'stakeholder',
};

// System roles have no Polish name column (SYSTEM_ROLES is EN-only) — small PL map
// so `pmoRole.namePl` is always populated for the two Piotr-facing surfaces.
const SYSTEM_ROLE_NAME_PL: Record<string, string> = {
  'project-executive': 'Sponsor Projektu',
  'project-manager': 'Kierownik Projektu',
  'workstream-lead': 'Lider Strumienia',
  'team-member': 'Członek Zespołu',
  stakeholder: 'Interesariusz',
  'portfolio-manager': 'Kierownik Portfela',
};

// Minimum viable "required roles" policy for team-completeness stats: a project
// should have a Project Manager and at least one Team Member. Deliberately
// simple v1 default (CTO decision) — can grow into an org-configurable policy later.
const REQUIRED_ROLE_IDS = ['project-manager', 'team-member'];

interface PmoRoleInfo {
  id: string;
  code: string;
  name: string;
  namePl: string;
  level: number;
}

interface TeamMemberRow {
  id: string;
  user_id: string;
  pmo_role_id: string | null;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

const ensureTeamTableExists = async () => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS project_team_members (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            pmo_role_id TEXT,
            allocation_percent INTEGER NOT NULL DEFAULT 100,
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT project_team_members_project_user_unique UNIQUE (project_id, user_id)
        )`,
    []
  );
};

/** Batch-resolve pmo_role_id values (system or org-scoped custom) to display info. */
async function resolveRoleMap(
  roleIds: string[],
  orgId: string
): Promise<Map<string, PmoRoleInfo>> {
  const map = new Map<string, PmoRoleInfo>();

  for (const role of SYSTEM_ROLES) {
    map.set(role.id, {
      id: role.id,
      code: role.id,
      name: role.name,
      namePl: SYSTEM_ROLE_NAME_PL[role.id] || role.name,
      level: role.level,
    });
  }

  const customIds = [...new Set(roleIds)].filter((id) => id && !map.has(id));
  if (customIds.length > 0) {
    const placeholders = customIds.map(() => '?').join(', ');
    const customRoles = await dbAll<{
      id: string;
      name: string;
      level: number;
    }>(
      `SELECT id, name, level FROM pmo_roles WHERE organization_id = ? AND id IN (${placeholders})`,
      [orgId, ...customIds]
    );
    for (const row of customRoles) {
      map.set(row.id, {
        id: row.id,
        code: row.id,
        name: row.name,
        namePl: row.name,
        level: Number(row.level),
      });
    }
  }

  return map;
}

async function loadTeamRows(projectId: string, orgId: string): Promise<TeamMemberRow[]> {
  return dbAll<TeamMemberRow>(
    `SELECT
        ptm.id AS id,
        ptm.user_id AS user_id,
        ptm.pmo_role_id AS pmo_role_id,
        ptm.allocation_percent AS allocation_percent,
        ptm.start_date AS start_date,
        ptm.end_date AS end_date,
        u.first_name AS first_name,
        u.last_name AS last_name,
        u.email AS email,
        u.avatar_url AS avatar_url
     FROM project_team_members ptm
     JOIN users u ON u.id = ptm.user_id
     WHERE ptm.project_id = ? AND ptm.organization_id = ?
     ORDER BY ptm.created_at ASC`,
    [projectId, orgId]
  );
}

function formatMember(row: TeamMemberRow, roleMap: Map<string, PmoRoleInfo>) {
  const roleInfo = row.pmo_role_id ? roleMap.get(row.pmo_role_id) || null : null;
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();

  return {
    userId: row.user_id,
    userName: fullName || row.email || row.user_id,
    userEmail: row.email || '',
    userAvatar: row.avatar_url || undefined,
    pmoRole: roleInfo,
    allocationPercent: Number(row.allocation_percent) || 0,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
  };
}

/**
 * GET /api/pmo-roles/projects/:projectId/team
 * GET /api/pmo-roles/projects/:projectId/team?grouped=true
 */
router.get(
  '/projects/:projectId/team',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTeamTableExists();

    const { projectId } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rows = await loadTeamRows(projectId, orgId);
    const roleMap = await resolveRoleMap(
      rows.map((r) => r.pmo_role_id).filter((id): id is string => !!id),
      orgId
    );
    const members = rows.map((row) => formatMember(row, roleMap));

    if (req.query.grouped === 'true') {
      const grouped: Record<string, ReturnType<typeof formatMember>[]> = {
        executive: [],
        manager: [],
        lead: [],
        member: [],
        stakeholder: [],
        unassigned: [],
      };

      for (const member of members) {
        const key =
          member.pmoRole != null ? LEVEL_KEY_BY_NUMBER[member.pmoRole.level] : undefined;
        (grouped[key || 'unassigned'] || grouped.unassigned).push(member);
      }

      return res.json(grouped);
    }

    return res.json(members);
  })
);

/**
 * GET /api/pmo-roles/projects/:projectId/team/stats
 */
router.get(
  '/projects/:projectId/team/stats',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTeamTableExists();

    const { projectId } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rows = await loadTeamRows(projectId, orgId);
    const roleMap = await resolveRoleMap(
      rows.map((r) => r.pmo_role_id).filter((id): id is string => !!id),
      orgId
    );

    const totalMembers = rows.length;
    const totalAllocation = rows.reduce((sum, r) => sum + (Number(r.allocation_percent) || 0), 0);
    const averageAllocation = totalMembers > 0 ? Math.round(totalAllocation / totalMembers) : 0;

    const byLevel = { executive: 0, manager: 0, lead: 0, member: 0, stakeholder: 0 };
    for (const row of rows) {
      const roleInfo = row.pmo_role_id ? roleMap.get(row.pmo_role_id) : null;
      if (!roleInfo) continue;
      const key = LEVEL_KEY_BY_NUMBER[roleInfo.level] as keyof typeof byLevel | undefined;
      if (key && key in byLevel) {
        byLevel[key] += 1;
      }
    }

    const assignedRoleIds = new Set(rows.map((r) => r.pmo_role_id).filter(Boolean));
    const missing: { code: string; name: string }[] = [];
    for (const requiredId of REQUIRED_ROLE_IDS) {
      if (!assignedRoleIds.has(requiredId)) {
        const role = SYSTEM_ROLES.find((r) => r.id === requiredId);
        missing.push({ code: requiredId, name: role?.name || requiredId });
      }
    }

    return res.json({
      totalMembers,
      totalAllocation,
      averageAllocation,
      byLevel,
      requiredRoles: {
        total: REQUIRED_ROLE_IDS.length,
        filled: REQUIRED_ROLE_IDS.length - missing.length,
        missing,
      },
    });
  })
);

/**
 * POST /api/pmo-roles/projects/:projectId/team
 * body: { userId, pmoRoleId, allocationPercent }
 * Upserts a team member (idempotent by project_id+user_id).
 */
router.post(
  '/projects/:projectId/team',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTeamTableExists();

    const { projectId } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, pmoRoleId, allocationPercent } = req.body || {};
    if (!userId || !pmoRoleId) {
      return res.status(400).json({ error: 'userId and pmoRoleId are required' });
    }

    const project = await dbGet<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [projectId, orgId]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await dbGet<{ id: string }>(
      `SELECT id FROM users WHERE id = ? AND organization_id = ?`,
      [userId, orgId]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const id = uuidv4();
    const allocation = Number.isFinite(Number(allocationPercent)) ? Number(allocationPercent) : 100;

    const result = await dbRun(
      `INSERT INTO project_team_members
          (id, organization_id, project_id, user_id, pmo_role_id, allocation_percent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, now(), now())
       ON CONFLICT (project_id, user_id) DO UPDATE SET
          pmo_role_id = EXCLUDED.pmo_role_id,
          allocation_percent = EXCLUDED.allocation_percent,
          updated_at = now()`,
      [id, orgId, projectId, userId, pmoRoleId, allocation]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to add team member');
    }

    logger.info(`Team member upserted: user ${userId} on project ${projectId} (org ${orgId})`);

    const rows = await loadTeamRows(projectId, orgId);
    const row = rows.find((r) => r.user_id === userId);
    const roleMap = await resolveRoleMap([pmoRoleId], orgId);

    return res
      .status(201)
      .json(row ? formatMember(row, roleMap) : { userId, pmoRoleId, allocationPercent: allocation });
  })
);

/**
 * DELETE /api/pmo-roles/projects/:projectId/team/:userId
 */
router.delete(
  '/projects/:projectId/team/:userId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTeamTableExists();

    const { projectId, userId } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await dbRun(
      `DELETE FROM project_team_members WHERE project_id = ? AND user_id = ? AND organization_id = ?`,
      [projectId, userId, orgId]
    );

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    logger.info(`Team member removed: user ${userId} from project ${projectId} (org ${orgId})`);

    return res.json({ message: 'Team member removed successfully' });
  })
);

export default router;
