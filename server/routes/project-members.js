/**
 * Project Members API Routes
 * 
 * PMO Standards Compliant Team Management
 * 
 * Standards:
 * - ISO 21500:2021 - Project Team (Clause 4.6.2)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme (Project Roles)
 * 
 * Endpoints:
 * - POST   /api/projects/:projectId/members     - Add member to project
 * - GET    /api/projects/:projectId/members     - List project team
 * - PATCH  /api/projects/:projectId/members/:userId - Update member
 * - DELETE /api/projects/:projectId/members/:userId - Remove member
 * - GET    /api/projects/:projectId/raci-matrix - Get RACI matrix
 * - GET    /api/projects/:projectId/available-assignees - Get available task assignees
 * 
 * @module routes/project-members
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const ProjectMemberService = require('../services/projectMemberService');

/**
 * Add a member to a project
 * POST /api/projects/:projectId/members
 */
router.post('/:projectId/members', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, projectRole, workstreamId, allocationPercent, startDate, endDate } = req.body;
    const addedById = req.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!projectRole) {
      return res.status(400).json({ error: 'projectRole is required' });
    }

    // Check if requester can manage team
    const requesterPermission = await ProjectMemberService.checkPermission(
      projectId,
      addedById,
      'canManageTeam'
    );

    if (!requesterPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage this team' });
    }

    const member = await ProjectMemberService.addMember(projectId, userId, projectRole, {
      addedById,
      workstreamId,
      allocationPercent,
      startDate,
      endDate
    });

    res.status(201).json(member);
  } catch (err) {
    console.error('[ProjectMembers] Add member error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all members of a project
 * GET /api/projects/:projectId/members
 */
router.get('/:projectId/members', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role, workstreamId } = req.query;

    // Check if user can view project
    const member = await ProjectMemberService.getMember(projectId, req.user.id);
    const canView = member?.permissions?.canViewProject || req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN';

    if (!canView) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const members = await ProjectMemberService.getProjectTeam(projectId, {
      role,
      workstreamId
    });

    res.json({
      projectId,
      members,
      roles: ProjectMemberService.PROJECT_ROLES
    });
  } catch (err) {
    console.error('[ProjectMembers] List members error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a single member
 * GET /api/projects/:projectId/members/:userId
 */
router.get('/:projectId/members/:userId', verifyToken, async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    const member = await ProjectMemberService.getMember(projectId, userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(member);
  } catch (err) {
    console.error('[ProjectMembers] Get member error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a member's role or settings
 * PATCH /api/projects/:projectId/members/:userId
 */
router.patch('/:projectId/members/:userId', verifyToken, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const updates = req.body;

    // Check if requester can manage team
    const requesterPermission = await ProjectMemberService.checkPermission(
      projectId,
      req.user.id,
      'canManageTeam'
    );

    if (!requesterPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage this team' });
    }

    const member = await ProjectMemberService.updateMember(projectId, userId, updates);
    res.json(member);
  } catch (err) {
    console.error('[ProjectMembers] Update member error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Remove a member from a project
 * DELETE /api/projects/:projectId/members/:userId
 */
router.delete('/:projectId/members/:userId', verifyToken, async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    // Check if requester can manage team
    const requesterPermission = await ProjectMemberService.checkPermission(
      projectId,
      req.user.id,
      'canManageTeam'
    );

    if (!requesterPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage this team' });
    }

    // Prevent removing yourself if you're the only SPONSOR/PMO_LEAD
    const member = await ProjectMemberService.getMember(projectId, userId);
    if (member && ['SPONSOR', 'PMO_LEAD'].includes(member.projectRole)) {
      const team = await ProjectMemberService.getProjectTeam(projectId);
      const sameRoleMembers = team.filter(m => m.projectRole === member.projectRole);
      if (sameRoleMembers.length === 1) {
        return res.status(400).json({ 
          error: `Cannot remove the only ${member.projectRole} from the project` 
        });
      }
    }

    await ProjectMemberService.removeMember(projectId, userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[ProjectMembers] Remove member error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get RACI matrix for a project
 * GET /api/projects/:projectId/raci-matrix
 */
router.get('/:projectId/raci-matrix', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if user can view project
    const member = await ProjectMemberService.getMember(projectId, req.user.id);
    const canView = member?.permissions?.canViewProject || req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN';

    if (!canView) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const raciMatrix = await ProjectMemberService.getRACIMatrix(projectId);
    res.json(raciMatrix);
  } catch (err) {
    console.error('[ProjectMembers] RACI matrix error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get available assignees for tasks
 * GET /api/projects/:projectId/available-assignees
 */
router.get('/:projectId/available-assignees', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { workstreamId, taskType } = req.query;

    const assignees = await ProjectMemberService.getAvailableAssignees(projectId, {
      workstreamId,
      taskType
    });

    res.json(assignees);
  } catch (err) {
    console.error('[ProjectMembers] Available assignees error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get user's role in a project
 * GET /api/projects/:projectId/my-role
 */
router.get('/:projectId/my-role', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const member = await ProjectMemberService.getMember(projectId, userId);
    
    if (!member) {
      return res.json({ 
        isMember: false,
        projectRole: null,
        permissions: null
      });
    }

    res.json({
      isMember: true,
      projectRole: member.projectRole,
      workstreamId: member.workstreamId,
      permissions: member.permissions,
      allocationPercent: member.allocationPercent
    });
  } catch (err) {
    console.error('[ProjectMembers] My role error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all projects a user is a member of
 * GET /api/users/:userId/projects
 * GET /api/me/projects (current user)
 */
router.get('/me/projects', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const projects = await ProjectMemberService.getUserProjects(userId);
    res.json(projects);
  } catch (err) {
    console.error('[ProjectMembers] User projects error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

