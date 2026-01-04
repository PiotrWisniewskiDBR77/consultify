import express from 'express';
import auth from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbac.js';
import PMORoleService from '../services/pmoRoleService.js';

const router = express.Router();

// ============================================
// PMO ROLE DEFINITIONS
// ============================================

/**
 * GET /api/pmo-roles
 * Get all PMO role definitions
 */
router.get('/', auth, async (req, res) => {
  try {
    const { level, includeCustom } = req.query;

    const options = {};
    if (level !== undefined) {
      options.level = parseInt(level, 10);
    }
    if (includeCustom !== undefined) {
      options.includeCustom = includeCustom === 'true';
    }

    const roles = await PMORoleService.getAllRoles(options);
    res.json(roles);
  } catch (error) {
    console.error('[PMORoles] Error getting roles:', error);
    res.status(500).json({ error: 'Failed to get PMO roles' });
  }
});

/**
 * GET /api/pmo-roles/by-level
 * Get roles grouped by level
 */
router.get('/by-level', auth, async (req, res) => {
  try {
    const rolesByLevel = await PMORoleService.getRolesByLevel();
    res.json(rolesByLevel);
  } catch (error) {
    console.error('[PMORoles] Error getting roles by level:', error);
    res.status(500).json({ error: 'Failed to get PMO roles by level' });
  }
});

/**
 * GET /api/pmo-roles/:id
 * Get a single role with its capabilities
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const role = await PMORoleService.getRole(req.params.id);

    if (!role) {
      return res.status(404).json({ error: 'PMO role not found' });
    }

    res.json(role);
  } catch (error) {
    console.error('[PMORoles] Error getting role:', error);
    res.status(500).json({ error: 'Failed to get PMO role' });
  }
});

/**
 * POST /api/pmo-roles
 * Create a custom PMO role
 * Requires ADMIN role
 */
router.post('/', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
  try {
    const { code, name, namePl, level, description, descriptionPl, reportsToCode } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const role = await PMORoleService.createCustomRole({
      code,
      name,
      namePl,
      level,
      description,
      descriptionPl,
      reportsToCode
    });

    res.status(201).json({
      success: true,
      message: 'Custom PMO role created',
      role
    });
  } catch (error) {
    console.error('[PMORoles] Error creating role:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to create PMO role' });
  }
});

/**
 * GET /api/pmo-roles/:id/capabilities
 * Get capabilities for a specific role
 */
router.get('/:id/capabilities', auth, async (req, res) => {
  try {
    const capabilities = await PMORoleService.getRoleCapabilities(req.params.id);
    res.json(capabilities);
  } catch (error) {
    console.error('[PMORoles] Error getting role capabilities:', error);
    res.status(500).json({ error: 'Failed to get role capabilities' });
  }
});

// ============================================
// PROJECT TEAM MANAGEMENT
// ============================================

/**
 * GET /api/projects/:projectId/team
 * Get project team with PMO roles
 */
router.get('/projects/:projectId/team', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { level, grouped } = req.query;

    if (grouped === 'true') {
      const teamByLevel = await PMORoleService.getProjectTeamByLevel(projectId);
      return res.json(teamByLevel);
    }

    const options = {};
    if (level !== undefined) {
      options.level = parseInt(level, 10);
    }

    const team = await PMORoleService.getProjectTeam(projectId, options);
    res.json(team);
  } catch (error) {
    console.error('[PMORoles] Error getting project team:', error);
    res.status(500).json({ error: 'Failed to get project team' });
  }
});

/**
 * GET /api/projects/:projectId/team/stats
 * Get project team statistics
 */
router.get('/projects/:projectId/team/stats', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const stats = await PMORoleService.getProjectTeamStats(projectId);
    res.json(stats);
  } catch (error) {
    console.error('[PMORoles] Error getting team stats:', error);
    res.status(500).json({ error: 'Failed to get team statistics' });
  }
});

/**
 * GET /api/projects/:projectId/team/:userId
 * Get a specific team member
 */
router.get('/projects/:projectId/team/:userId', auth, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const member = await PMORoleService.getProjectMember(projectId, userId);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json(member);
  } catch (error) {
    console.error('[PMORoles] Error getting team member:', error);
    res.status(500).json({ error: 'Failed to get team member' });
  }
});

/**
 * POST /api/projects/:projectId/team
 * Assign user to project with PMO role
 * Requires PROJECT_MANAGER or ADMIN role
 */
router.post('/projects/:projectId/team', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      userId,
      pmoRoleId,
      allocationPercent,
      startDate,
      endDate,
      responsibilities,
      notes
    } = req.body;

    if (!userId || !pmoRoleId) {
      return res.status(400).json({ error: 'User ID and PMO Role ID are required' });
    }

    const assignment = await PMORoleService.assignProjectRole(userId, projectId, pmoRoleId, {
      allocationPercent,
      startDate,
      endDate,
      responsibilities,
      notes,
      addedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Team member assigned successfully',
      assignment
    });
  } catch (error) {
    console.error('[PMORoles] Error assigning team member:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to assign team member' });
  }
});

/**
 * PUT /api/projects/:projectId/team/:userId
 * Update team member assignment
 */
router.put('/projects/:projectId/team/:userId', auth, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { pmoRoleId, allocationPercent, startDate, endDate, responsibilities, notes } = req.body;

    // If changing role, use assignProjectRole (handles update)
    if (pmoRoleId) {
      const assignment = await PMORoleService.assignProjectRole(userId, projectId, pmoRoleId, {
        allocationPercent,
        startDate,
        endDate,
        responsibilities,
        notes,
        addedBy: req.user.id
      });

      return res.json({
        success: true,
        message: 'Team member updated successfully',
        assignment
      });
    }

    // If just updating allocation
    if (allocationPercent !== undefined) {
      const assignment = await PMORoleService.updateAllocation(userId, projectId, allocationPercent);
      return res.json({
        success: true,
        message: 'Allocation updated successfully',
        assignment
      });
    }

    res.status(400).json({ error: 'No valid updates provided' });
  } catch (error) {
    console.error('[PMORoles] Error updating team member:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('between 0 and 100')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update team member' });
  }
});

/**
 * DELETE /api/projects/:projectId/team/:userId
 * Remove user from project
 */
router.delete('/projects/:projectId/team/:userId', auth, async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    await PMORoleService.removeFromProject(userId, projectId, req.user.id);

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('[PMORoles] Error removing team member:', error);

    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ============================================
// USER PROJECT ROLES
// ============================================

/**
 * GET /api/users/:userId/project-roles
 * Get all project assignments for a user
 */
router.get('/users/:userId/project-roles', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only see their own roles unless admin
    if (userId !== req.user.id && !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to view other user\'s project roles' });
    }

    const projectRoles = await PMORoleService.getUserProjectRoles(userId);
    res.json(projectRoles);
  } catch (error) {
    console.error('[PMORoles] Error getting user project roles:', error);
    res.status(500).json({ error: 'Failed to get user project roles' });
  }
});

/**
 * GET /api/me/project-roles
 * Get current user's project assignments
 */
router.get('/me/project-roles', auth, async (req, res) => {
  try {
    const projectRoles = await PMORoleService.getUserProjectRoles(req.user.id);
    res.json(projectRoles);
  } catch (error) {
    console.error('[PMORoles] Error getting my project roles:', error);
    res.status(500).json({ error: 'Failed to get project roles' });
  }
});

export default router;














