/**
 * Consultant Project Access Routes
 * Full CRUD implementation for external consultant management
 *
 * Endpoints:
 * - GET /api/consultant-project-access - List all consultants with their project access
 * - GET /api/consultant-project-access/projects - List available projects for consultant assignment
 * - GET /api/consultant-project-access/permission-definitions - Get permission definitions
 * - POST /api/consultant-project-access - Invite consultant to project
 * - PUT /api/consultant-project-access/:accessId - Update consultant permissions
 * - DELETE /api/consultant-project-access/:accessId - Remove consultant access
 * - POST /api/consultant-project-access/:accessId/regenerate-code - Regenerate access code
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// Permission definitions for consultants
const PERMISSION_DEFINITIONS = [
  {
    key: 'canViewProject',
    label: 'View Project',
    description: 'View project overview and status',
    category: 'view',
  },
  {
    key: 'canViewTasks',
    label: 'View Tasks',
    description: 'View task list and details',
    category: 'view',
  },
  {
    key: 'canViewInitiatives',
    label: 'View Initiatives',
    description: 'View initiative details',
    category: 'view',
  },
  {
    key: 'canViewDecisions',
    label: 'View Decisions',
    description: 'View decision records',
    category: 'view',
  },
  {
    key: 'canViewFinancials',
    label: 'View Financials',
    description: 'View financial data',
    category: 'view',
  },
  {
    key: 'canCreateTasks',
    label: 'Create Tasks',
    description: 'Create new tasks',
    category: 'tasks',
  },
  {
    key: 'canAssignTasks',
    label: 'Assign Tasks',
    description: 'Assign tasks to team members',
    category: 'tasks',
  },
  {
    key: 'canUpdateTasks',
    label: 'Update Tasks',
    description: 'Update task status and details',
    category: 'tasks',
  },
  { key: 'canDeleteTasks', label: 'Delete Tasks', description: 'Delete tasks', category: 'tasks' },
  {
    key: 'canCreateInitiatives',
    label: 'Create Initiatives',
    description: 'Create new initiatives',
    category: 'initiatives',
  },
  {
    key: 'canUpdateInitiatives',
    label: 'Update Initiatives',
    description: 'Update initiative details',
    category: 'initiatives',
  },
  {
    key: 'canDeleteInitiatives',
    label: 'Delete Initiatives',
    description: 'Delete initiatives',
    category: 'initiatives',
  },
  {
    key: 'canRequestDecisions',
    label: 'Request Decisions',
    description: 'Submit decision requests',
    category: 'governance',
  },
  {
    key: 'canApproveDecisions',
    label: 'Approve Decisions',
    description: 'Approve decision requests',
    category: 'governance',
  },
  {
    key: 'canSubmitChangeRequests',
    label: 'Submit Change Requests',
    description: 'Submit change requests',
    category: 'governance',
  },
  {
    key: 'canApproveChangeRequests',
    label: 'Approve Change Requests',
    description: 'Approve change requests',
    category: 'governance',
  },
  {
    key: 'canComment',
    label: 'Comment',
    description: 'Add comments and notes',
    category: 'collaboration',
  },
  { key: 'canUseAI', label: 'Use AI', description: 'Access AI features', category: 'ai' },
  {
    key: 'canEscalate',
    label: 'Escalate',
    description: 'Escalate issues',
    category: 'collaboration',
  },
  {
    key: 'canReceiveEscalations',
    label: 'Receive Escalations',
    description: 'Receive escalated issues',
    category: 'collaboration',
  },
];

// Generate access code
const generateAccessCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Ensure table exists
const ensureTableExists = async () => {
  const createTableSQL = `
        CREATE TABLE IF NOT EXISTS consultant_project_access (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            consultant_email TEXT NOT NULL,
            consultant_id TEXT,
            project_id TEXT NOT NULL,
            project_role TEXT, -- desired project role (stored even before consultant accepts)
            access_code TEXT,
            permissions TEXT, -- JSON object
            status TEXT DEFAULT 'pending', -- pending, accepted, revoked
            invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            accepted_at TIMESTAMP,
            revoked_at TIMESTAMP,
            invited_by TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(consultant_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
  await dbRun(createTableSQL, []);

  // Best-effort schema evolution (for existing SQLite DBs).
  // If the table exists without project_role, add it.
  try {
    await dbRun('ALTER TABLE consultant_project_access ADD COLUMN project_role TEXT', []);
  } catch {
    // ignore (already exists or not supported)
  }

  // Create index for faster lookups
  await dbRun(
    'CREATE INDEX IF NOT EXISTS idx_cpa_org ON consultant_project_access(organization_id)',
    []
  );
  await dbRun(
    'CREATE INDEX IF NOT EXISTS idx_cpa_email ON consultant_project_access(consultant_email)',
    []
  );
  await dbRun(
    'CREATE INDEX IF NOT EXISTS idx_cpa_project ON consultant_project_access(project_id)',
    []
  );
};

// Apply auth middleware
router.use(verifyToken);
router.use(requireOrgAccess());

/**
 * GET /api/consultant-project-access
 * List all consultants with their project access
 */
router.get(
  '/',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fail-soft: lazy DDL must not surface as a bare 500 on a read.
    try {
      await ensureTableExists();

      // Get all consultant access records grouped by consultant
      const accessRecords = await dbAll<{
        id: string;
        consultant_email: string;
        consultant_id: string | null;
        project_id: string;
        project_role: string | null;
        access_code: string | null;
        permissions: string;
        status: string;
        invited_at: string;
        accepted_at: string | null;
      }>(
        `SELECT cpa.*, p.name as project_name
             FROM consultant_project_access cpa
             LEFT JOIN projects p ON cpa.project_id = p.id
             WHERE cpa.organization_id = ?
             ORDER BY cpa.consultant_email, cpa.invited_at DESC`,
        [orgId]
      );

      // Group by consultant
      const consultantsMap = new Map<string, any>();

      for (const record of accessRecords) {
        const email = record.consultant_email;

        if (!consultantsMap.has(email)) {
          // Get consultant user info if they've accepted
          let consultantInfo = null;
          if (record.consultant_id) {
            consultantInfo = await dbGet<{
              first_name: string;
              last_name: string;
              avatar_url: string | null;
            }>(`SELECT first_name, last_name, avatar_url FROM users WHERE id = ?`, [
              record.consultant_id,
            ]);
          }

          consultantsMap.set(email, {
            consultant_id: record.consultant_id || email,
            email: email,
            firstName: consultantInfo?.first_name || null,
            lastName: consultantInfo?.last_name || null,
            avatarUrl: consultantInfo?.avatar_url || null,
            projects: [],
          });
        }

        consultantsMap.get(email).projects.push({
          access_id: record.id,
          project_id: record.project_id,
          projectName: (record as any).project_name || 'Unknown Project',
          status: record.status,
          projectRole: record.project_role || null,
          permissions: JSON.parse(record.permissions || '{}'),
          invited_at: record.invited_at,
          accepted_at: record.accepted_at,
        });
      }

      return res.json(Array.from(consultantsMap.values()));
    } catch (err) {
      console.error('[consultant-project-access] GET / failed (fail-soft, returning empty):', err);
      return res.json([]);
    }
  })
);

/**
 * GET /api/consultant-project-access/projects
 * List available projects for consultant assignment
 */
router.get(
  '/projects',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await dbAll<{
      id: string;
      name: string;
      status: string;
    }>(
      `SELECT id, name, status FROM projects WHERE organization_id = ? AND status != 'deleted' ORDER BY name`,
      [orgId]
    );

    return res.json(projects);
  })
);

/**
 * GET /api/consultant-project-access/permission-definitions
 * Get permission definitions
 */
router.get('/permission-definitions', (_req, res) => {
  return res.json(PERMISSION_DEFINITIONS);
});

/**
 * POST /api/consultant-project-access
 * Invite consultant to project
 */
router.post(
  '/',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const orgId = req.user?.organizationId;
    const invitedBy = req.user?.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      email,
      projectId,
      permissions,
      generateCode = true,
      accessCode,
      projectRole,
    } = req.body;

    if (!email || !projectId) {
      return res.status(400).json({ error: 'Email and project ID are required' });
    }

    const project = await dbGet<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ? LIMIT 1`,
      [projectId, orgId]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found in this organization' });
    }

    // Check if access already exists
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM consultant_project_access 
             WHERE organization_id = ? AND consultant_email = ? AND project_id = ? AND status != 'revoked'`,
      [orgId, email.toLowerCase(), projectId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Consultant already has access to this project' });
    }

    // Check if user exists with this email
    const existingUser = await dbGet<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`,
      [email]
    );

    const id = uuidv4();
    const code = generateCode ? generateAccessCode() : accessCode || null;
    const now = new Date().toISOString();

    const sql = `
            INSERT INTO consultant_project_access 
            (id, organization_id, consultant_email, consultant_id, project_id, project_role, access_code, permissions, status, invited_at, invited_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const result = await dbRun(sql, [
      id,
      orgId,
      email.toLowerCase(),
      existingUser?.id || null,
      projectId,
      projectRole ? String(projectRole) : null,
      code,
      JSON.stringify(permissions || {}),
      'pending',
      now,
      invitedBy,
    ]);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create consultant access');
    }

    logger.info(`Consultant invited: ${email} to project ${projectId} in org ${orgId}`);

    // Compatibility layer (v1):
    // If the invited consultant already exists as a user, ensure canonical project membership exists
    // and mark consultant overlay fields on that membership.
    if (existingUser?.id) {
      try {
        const memberId = uuidv4();
        await dbRun(
          `INSERT OR IGNORE INTO project_members
           (id, project_id, user_id, project_role, allocation_percent, permissions, added_by_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            memberId,
            projectId,
            existingUser.id,
            projectRole ? String(projectRole) : 'CONSULTANT',
            100,
            JSON.stringify({}),
            invitedBy || null,
          ]
        );

        // Overlay fields were added in migration 542; best-effort update
        await dbRun(
          `UPDATE project_members
           SET consultant_profile = ?, engagement_type = ?, updated_at = datetime('now')
           WHERE project_id = ? AND user_id = ?`,
          ['EXTERNAL', 'INVITED_BY_CLIENT', projectId, existingUser.id]
        );
      } catch {
        // best-effort
      }
    }

    return res.status(201).json({
      id,
      email: email.toLowerCase(),
      projectId,
      projectRole: projectRole ? String(projectRole) : null,
      accessCode: code,
      permissions: permissions || {},
      status: 'pending',
      invitedAt: now,
    });
  })
);

/**
 * PUT /api/consultant-project-access/:accessId
 * Update consultant permissions
 */
router.put(
  '/:accessId',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { accessId } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { permissions, projectRole } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    if (permissions !== undefined) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(permissions || {}));
    }
    if (projectRole !== undefined) {
      updates.push('project_role = ?');
      params.push(projectRole ? String(projectRole) : null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    const sql = `UPDATE consultant_project_access SET ${updates.join(
      ', '
    )} WHERE id = ? AND organization_id = ?`;
    params.push(accessId, orgId);
    const result = await dbRun(sql, params);

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Access record not found' });
    }

    logger.info(`Consultant permissions updated: ${accessId} in org ${orgId}`);

    return res.json({ message: 'Access updated' });
  })
);

/**
 * DELETE /api/consultant-project-access/:accessId
 * Remove consultant access (revoke)
 */
router.delete(
  '/:accessId',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { accessId } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch record for compatibility cleanup
    let accessRecord: { consultant_id: string | null; project_id: string } | null = null;
    try {
      accessRecord = await dbGet<{ consultant_id: string | null; project_id: string }>(
        `SELECT consultant_id, project_id FROM consultant_project_access WHERE id = ? AND organization_id = ?`,
        [accessId, orgId]
      );
    } catch {
      accessRecord = null;
    }

    const now = new Date().toISOString();

    // Soft delete - set status to revoked
    const result = await dbRun(
      `UPDATE consultant_project_access SET status = 'revoked', revoked_at = ? WHERE id = ? AND organization_id = ?`,
      [now, accessId, orgId]
    );

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Access record not found' });
    }

    logger.info(`Consultant access revoked: ${accessId} in org ${orgId}`);

    // Compatibility cleanup: revoke canonical membership created via consultant access
    try {
      if (accessRecord?.consultant_id && accessRecord?.project_id) {
        // Prefer removing only memberships that look like an external consultant overlay.
        // Columns may not exist in older DBs, so keep this best-effort.
        try {
          await dbRun(
            `DELETE FROM project_members
             WHERE project_id = ? AND user_id = ?
               AND (UPPER(consultant_profile) = 'EXTERNAL' OR UPPER(engagement_type) = 'INVITED_BY_CLIENT')`,
            [accessRecord.project_id, accessRecord.consultant_id]
          );
        } catch {
          // Fallback: remove the consultant membership by user+project only
          await dbRun(
            `DELETE FROM project_members
             WHERE project_id = ? AND user_id = ?`,
            [accessRecord.project_id, accessRecord.consultant_id]
          );
        }
      }
    } catch {
      // best-effort
    }

    return res.json({ message: 'Access revoked' });
  })
);

/**
 * POST /api/consultant-project-access/:accessId/regenerate-code
 * Regenerate access code
 */
router.post(
  '/:accessId/regenerate-code',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTableExists();

    const { accessId } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const newCode = generateAccessCode();

    const result = await dbRun(
      `UPDATE consultant_project_access SET access_code = ? WHERE id = ? AND organization_id = ?`,
      [newCode, accessId, orgId]
    );

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Access record not found' });
    }

    logger.info(`Access code regenerated for: ${accessId} in org ${orgId}`);

    return res.json({ accessCode: newCode });
  })
);

export default router;
