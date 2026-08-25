/**
 * Teams Routes
 * API endpoints for team management
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

/**
 * GET /api/teams
 * Get all teams for organization
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = `
        SELECT 
            t.*,
            l.first_name as lead_first_name,
            l.last_name as lead_last_name,
            l.avatar_url as lead_avatar,
            (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
        FROM teams t
        LEFT JOIN users l ON t.lead_id = l.id
        WHERE t.organization_id = ?
        ORDER BY t.name ASC
    `;

    const teams = await dbAll<{
      id: string;
      organization_id: string;
      name: string;
      description: string | null;
      lead_id: string | null;
      lead_first_name: string | null;
      lead_last_name: string | null;
      lead_avatar: string | null;
      member_count: number;
      created_at: string;
    }>(sql, [orgId]);

    const formattedTeams = teams.map((t) => ({
      id: t.id,
      organizationId: t.organization_id,
      name: t.name,
      description: t.description,
      leadId: t.lead_id,
      lead: t.lead_id
        ? {
            id: t.lead_id,
            firstName: t.lead_first_name,
            lastName: t.lead_last_name,
            avatarUrl: t.lead_avatar,
          }
        : null,
      memberCount: t.member_count,
      createdAt: t.created_at,
    }));

    return res.json(formattedTeams);
  })
);

/**
 * GET /api/teams/:id
 * Get single team with members
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const teamSql = `
        SELECT t.*, l.first_name as lead_first_name, l.last_name as lead_last_name, l.avatar_url as lead_avatar
        FROM teams t
        LEFT JOIN users l ON t.lead_id = l.id
        WHERE t.id = ? AND t.organization_id = ?
    `;

    const team = await dbGet<{
      id: string;
      organization_id: string;
      name: string;
      description: string | null;
      lead_id: string | null;
      lead_first_name: string | null;
      lead_last_name: string | null;
      lead_avatar: string | null;
      created_at: string;
    }>(teamSql, [id, orgId]);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get members
    const membersSql = `
        SELECT tm.*, u.first_name, u.last_name, u.email, u.avatar_url
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
    `;

    const members = await dbAll<{
      team_id: string;
      user_id: string;
      role: string;
      joined_at: string;
      first_name: string;
      last_name: string;
      email: string;
      avatar_url: string | null;
    }>(membersSql, [id]);

    return res.json({
      id: team.id,
      organizationId: team.organization_id,
      name: team.name,
      description: team.description,
      leadId: team.lead_id,
      lead: team.lead_id
        ? {
            id: team.lead_id,
            firstName: team.lead_first_name,
            lastName: team.lead_last_name,
            avatarUrl: team.lead_avatar,
          }
        : null,
      createdAt: team.created_at,
      members: members.map((m) => ({
        userId: m.user_id,
        user: {
          id: m.user_id,
          firstName: m.first_name,
          lastName: m.last_name,
          email: m.email,
          avatarUrl: m.avatar_url,
        },
        role: m.role,
        joinedAt: m.joined_at,
      })),
    });
  })
);

/**
 * POST /api/teams
 * Create team (Admin only)
 */
router.post(
  '/',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, leadId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (leadId) {
      const lead = await dbGet<{ id: string }>(
        'SELECT id FROM users WHERE id = ? AND organization_id = ?',
        [leadId, orgId]
      );
      if (!lead) return res.status(404).json({ error: 'Team lead not found in organization' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `INSERT INTO teams (id, organization_id, name, description, lead_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`;

    const runResult1 = await dbRun(sql, [
      id,
      orgId,
      name,
      description || null,
      leadId || null,
      now,
    ]);

    if (!runResult1.success) {
      throw new Error(runResult1.error || 'Failed to create team');
    }

    // If leadId provided, also add them as a team member with 'lead' role
    if (leadId) {
      const runResult2 = await dbRun(
        `INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
        [id, leadId, 'lead', now]
      );

      if (!runResult2.success) {
        throw new Error(runResult2.error || 'Failed to add team lead');
      }
    }

    return res.json({
      id,
      organizationId: orgId,
      name,
      description,
      leadId,
      createdAt: now,
    });
  })
);

/**
 * PUT /api/teams/:id
 * Update team (Admin only)
 */
router.put(
  '/:id',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, leadId } = req.body;

    if (leadId) {
      const lead = await dbGet<{ id: string }>(
        'SELECT id FROM users WHERE id = ? AND organization_id = ?',
        [leadId, orgId]
      );
      if (!lead) return res.status(404).json({ error: 'Team lead not found in organization' });
    }

    const sql = `
        UPDATE teams SET
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            lead_id = COALESCE(?, lead_id)
        WHERE id = ? AND organization_id = ?
    `;

    const result = await dbRun(sql, [name, description, leadId, id, orgId]);

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json({ message: 'Team updated' });
  })
);

/**
 * DELETE /api/teams/:id
 * Delete team (Admin only)
 */
router.delete(
  '/:id',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Prove tenant ownership before touching child rows.
    const team = await dbGet<{ id: string }>(
      'SELECT id FROM teams WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Delete team members first
    const runResult1 = await dbRun('DELETE FROM team_members WHERE team_id = ?', [id]);

    if (!runResult1.success) {
      throw new Error(runResult1.error || 'Failed to delete team members');
    }

    // Delete team
    const result = await dbRun('DELETE FROM teams WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json({ message: 'Team deleted' });
  })
);

/**
 * POST /api/teams/:id/members
 * Add member to team (Admin only)
 */
router.post(
  '/:id/members',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, role = 'member' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify team exists and belongs to org
    const team = await dbGet<{ id: string }>(
      'SELECT id FROM teams WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Verify user exists and belongs to same org
    const user = await dbGet<{ id: string }>(
      'SELECT id FROM users WHERE id = ? AND organization_id = ?',
      [userId, orgId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    const now = new Date().toISOString();

    const runResult = await dbRun(
      `INSERT OR REPLACE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
      [id, userId, role, now]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to add team member');
    }

    return res.json({ message: 'Member added to team' });
  })
);

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove member from team (Admin only)
 */
router.delete(
  '/:id/members/:userId',
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!id || !userId) {
      return res.status(400).json({ error: 'id and userId are required' });
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify team exists and belongs to org
    const team = await dbGet<{ id: string }>(
      'SELECT id FROM teams WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const result = await dbRun('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [
      id,
      userId,
    ]);

    if (!result.success || (result.changes || 0) === 0) {
      return res.status(404).json({ error: 'Member not in team' });
    }

    return res.json({ message: 'Member removed from team' });
  })
);

export default router;
