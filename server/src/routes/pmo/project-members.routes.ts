/**
 * Project Members Routes
 * API endpoints for managing project team members
 *
 * Schema note (RED-G / RED-D W5/W6, 2026-07-19): the live `project_members`
 * table has columns `project_role` / `created_at` / `added_by_id` — NOT the
 * `role` / `joined_at` / `added_by` names this file originally used. Every
 * query below is aliased/renamed to the real columns while keeping the JSON
 * response contract (`role`, `joined_at`) unchanged for callers.
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
const FEATURE_NAME = 'project-members';

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

const isSchemaMissingError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('database not initialized')
  );
};

const respondFeatureUnavailable = (res: Response, _detail?: string) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

/**
 * GET /api/pmo/project-members/:projectId
 * Get all members of a project
 */
router.get(
  '/:projectId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;

    try {
      const members = await dbAll(
        `
    SELECT pm.id, pm.user_id, pm.project_role AS role, pm.permissions, pm.created_at AS joined_at,
           u.first_name, u.last_name, u.email, u.avatar_url
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.project_role DESC, pm.created_at ASC
  `,
        [projectId],
        { fallback: false }
      );

      res.json(members || []);
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }
      throw error;
    }
  })
);

/**
 * POST /api/pmo/project-members/:projectId
 * Add member to project
 */
router.post(
  '/:projectId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { userId, role = 'MEMBER', permissions } = req.body;
    const requesterId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      // Check if user exists
      const user = await dbGet(
        'SELECT id, first_name, last_name FROM users WHERE id = ?',
        [userId],
        {
          fallback: false,
        }
      );
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already a member
      const existing = await dbGet(
        `
    SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
  `,
        [projectId, userId],
        { fallback: false }
      );

      if (existing) {
        return res.status(400).json({ error: 'User is already a project member' });
      }

      const id = uuidv4();
      const result = await dbRun(
        `
    INSERT INTO project_members (id, project_id, user_id, project_role, permissions, added_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `,
        [id, projectId, userId, role, JSON.stringify(permissions || []), requesterId],
        { fallback: false }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to add project member');
      }

      logger.info(`[ProjectMembers] Added ${userId} to project ${projectId} as ${role}`);
      res.status(201).json({ success: true, id, userId, role });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

/**
 * PUT /api/pmo/project-members/:projectId/:memberId
 * Update member role/permissions
 */
router.put(
  '/:projectId/:memberId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId, memberId } = req.params;
    const { role, permissions } = req.body;

    try {
      const existing = await dbGet(
        `
    SELECT id FROM project_members WHERE id = ? AND project_id = ?
  `,
        [memberId, projectId],
        { fallback: false }
      );

      if (!existing) {
        return res.status(404).json({ error: 'Project member not found' });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (role !== undefined) {
        updates.push('project_role = ?');
        params.push(role);
      }
      if (permissions !== undefined) {
        updates.push('permissions = ?');
        params.push(JSON.stringify(permissions));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push("updated_at = datetime('now')");
      params.push(memberId);

      const result = await dbRun(
        `
    UPDATE project_members SET ${updates.join(', ')} WHERE id = ?
  `,
        params,
        { fallback: false }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update project member');
      }

      logger.info(`[ProjectMembers] Updated member ${memberId} in project ${projectId}`);
      res.json({ success: true });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/pmo/project-members/:projectId/:memberId
 * Remove member from project
 */
router.delete(
  '/:projectId/:memberId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId, memberId } = req.params;

    try {
      const existing = await dbGet(
        `
    SELECT id, user_id FROM project_members WHERE id = ? AND project_id = ?
  `,
        [memberId, projectId],
        { fallback: false }
      );

      if (!existing) {
        return res.status(404).json({ error: 'Project member not found' });
      }

      const result = await dbRun('DELETE FROM project_members WHERE id = ?', [memberId], {
        fallback: false,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove project member');
      }

      logger.info(`[ProjectMembers] Removed member ${memberId} from project ${projectId}`);
      res.json({ success: true });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

/**
 * GET /api/pmo/project-members/:projectId/roles
 * Get available roles for project
 */
router.get(
  '/:projectId/roles/available',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const roles = [
      { id: 'OWNER', name: 'Owner', description: 'Full project control' },
      { id: 'MANAGER', name: 'Manager', description: 'Can manage team and tasks' },
      { id: 'LEAD', name: 'Lead', description: 'Technical or functional lead' },
      { id: 'MEMBER', name: 'Member', description: 'Regular team member' },
      { id: 'VIEWER', name: 'Viewer', description: 'Read-only access' },
      { id: 'STAKEHOLDER', name: 'Stakeholder', description: 'External stakeholder' },
    ];

    res.json(roles);
  })
);

/**
 * POST /api/pmo/project-members/:projectId/invite
 * Invite user by email to project
 */
router.post(
  '/:projectId/invite',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { email, role = 'MEMBER', message } = req.body;
    const requesterId = req.user?.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      // Check if user exists
      const existingUser = (await dbGet('SELECT id FROM users WHERE email = ?', [email], {
        fallback: false,
      })) as {
        id: string;
      } | null;

      if (existingUser) {
        // Add directly if user exists
        const existing = await dbGet(
          `
      SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
    `,
          [projectId, existingUser.id],
          { fallback: false }
        );

        if (existing) {
          return res.status(400).json({ error: 'User is already a project member' });
        }

        const id = uuidv4();
        await dbRun(
          `
      INSERT INTO project_members (id, project_id, user_id, project_role, added_by_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `,
          [id, projectId, existingUser.id, role, requesterId],
          { fallback: false }
        );

        return res.json({ success: true, added: true, userId: existingUser.id });
      }

      // Create invitation for non-existing user
      const inviteId = uuidv4();
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      await dbRun(
        `
    INSERT INTO project_invitations (id, project_id, email, role, invite_code, 
                                     invited_by, message, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 days'), datetime('now'))
  `,
        [inviteId, projectId, email, role, inviteCode, requesterId, message || ''],
        { fallback: false }
      );

      logger.info(`[ProjectMembers] Invitation sent to ${email} for project ${projectId}`);
      res.json({ success: true, invited: true, inviteCode });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

export default router;
