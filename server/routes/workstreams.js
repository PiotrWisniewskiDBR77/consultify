/**
 * Workstreams API Routes
 * 
 * PMO Standards Compliant Work Package Grouping
 * 
 * Standards:
 * - ISO 21500:2021 - Work Breakdown Structure (Clause 4.4.3)
 * - PMI PMBOK 7th Edition - Work Package Grouping
 * - PRINCE2 - Work Package Cluster
 * 
 * Endpoints:
 * - POST   /api/projects/:projectId/workstreams     - Create workstream
 * - GET    /api/projects/:projectId/workstreams     - List project workstreams
 * - GET    /api/workstreams/:id                     - Get workstream details
 * - PATCH  /api/workstreams/:id                     - Update workstream
 * - DELETE /api/workstreams/:id                     - Delete workstream
 * - GET    /api/workstreams/:id/progress            - Get workstream progress
 * - POST   /api/workstreams/:id/initiatives/:initiativeId - Assign initiative
 * - DELETE /api/workstreams/:id/initiatives/:initiativeId - Unassign initiative
 * - POST   /api/projects/:projectId/workstreams/reorder - Reorder workstreams
 * 
 * @module routes/workstreams
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const WorkstreamService = require('../services/workstreamService');
const ProjectMemberService = require('../services/projectMemberService');

/**
 * Create a new workstream
 * POST /api/projects/:projectId/workstreams
 */
router.post('/projects/:projectId/workstreams', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, ownerId, color } = req.body;

    // Check if requester can manage workstreams
    const hasPermission = await ProjectMemberService.checkPermission(
      projectId,
      req.user.id,
      'canManageWorkstreams'
    );

    if (!hasPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage workstreams' });
    }

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const workstream = await WorkstreamService.createWorkstream(projectId, {
      name,
      description,
      ownerId,
      color
    });

    res.status(201).json(workstream);
  } catch (err) {
    console.error('[Workstreams] Create error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all workstreams for a project
 * GET /api/projects/:projectId/workstreams
 */
router.get('/projects/:projectId/workstreams', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;

    // Check if user can view project
    const member = await ProjectMemberService.getMember(projectId, req.user.id);
    const canView = member?.permissions?.canViewProject || req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN';

    if (!canView) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const workstreams = await WorkstreamService.getProjectWorkstreams(projectId, { status });

    // Get unassigned initiatives count
    const unassigned = await WorkstreamService.getUnassignedInitiatives(projectId);

    res.json({
      projectId,
      workstreams,
      unassignedInitiatives: unassigned.length,
      statuses: WorkstreamService.WORKSTREAM_STATUS,
      colors: WorkstreamService.DEFAULT_COLORS
    });
  } catch (err) {
    console.error('[Workstreams] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get unassigned initiatives
 * GET /api/projects/:projectId/workstreams/unassigned
 */
router.get('/projects/:projectId/workstreams/unassigned', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const initiatives = await WorkstreamService.getUnassignedInitiatives(projectId);
    res.json(initiatives);
  } catch (err) {
    console.error('[Workstreams] Unassigned error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Reorder workstreams
 * POST /api/projects/:projectId/workstreams/reorder
 */
router.post('/projects/:projectId/workstreams/reorder', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { workstreamIds } = req.body;

    if (!Array.isArray(workstreamIds)) {
      return res.status(400).json({ error: 'workstreamIds must be an array' });
    }

    // Check permission
    const hasPermission = await ProjectMemberService.checkPermission(
      projectId,
      req.user.id,
      'canManageWorkstreams'
    );

    if (!hasPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage workstreams' });
    }

    await WorkstreamService.reorderWorkstreams(projectId, workstreamIds);
    res.json({ success: true });
  } catch (err) {
    console.error('[Workstreams] Reorder error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get a single workstream
 * GET /api/workstreams/:id
 */
router.get('/workstreams/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const workstream = await WorkstreamService.getWorkstream(id);
    if (!workstream) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    res.json(workstream);
  } catch (err) {
    console.error('[Workstreams] Get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a workstream
 * PATCH /api/workstreams/:id
 */
router.patch('/workstreams/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get workstream to check project
    const existing = await WorkstreamService.getWorkstream(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    // Check permission
    const hasPermission = await ProjectMemberService.checkPermission(
      existing.projectId,
      req.user.id,
      'canManageWorkstreams'
    );

    if (!hasPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage workstreams' });
    }

    const workstream = await WorkstreamService.updateWorkstream(id, updates);
    res.json(workstream);
  } catch (err) {
    console.error('[Workstreams] Update error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete a workstream
 * DELETE /api/workstreams/:id
 */
router.delete('/workstreams/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get workstream to check project
    const existing = await WorkstreamService.getWorkstream(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    // Check permission
    const hasPermission = await ProjectMemberService.checkPermission(
      existing.projectId,
      req.user.id,
      'canManageWorkstreams'
    );

    if (!hasPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage workstreams' });
    }

    await WorkstreamService.deleteWorkstream(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Workstreams] Delete error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get workstream progress
 * GET /api/workstreams/:id/progress
 */
router.get('/workstreams/:id/progress', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const progress = await WorkstreamService.getWorkstreamProgress(id);
    res.json(progress);
  } catch (err) {
    console.error('[Workstreams] Progress error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Assign initiative to workstream
 * POST /api/workstreams/:id/initiatives/:initiativeId
 */
router.post('/workstreams/:id/initiatives/:initiativeId', verifyToken, async (req, res) => {
  try {
    const { id, initiativeId } = req.params;

    // Get workstream to check project
    const existing = await WorkstreamService.getWorkstream(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    // Check permission
    const hasPermission = await ProjectMemberService.checkPermission(
      existing.projectId,
      req.user.id,
      'canManageWorkstreams'
    );

    if (!hasPermission && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to manage workstreams' });
    }

    const initiative = await WorkstreamService.assignInitiative(id, initiativeId);
    res.json(initiative);
  } catch (err) {
    console.error('[Workstreams] Assign initiative error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Unassign initiative from workstream
 * DELETE /api/workstreams/:id/initiatives/:initiativeId
 */
router.delete('/workstreams/:id/initiatives/:initiativeId', verifyToken, async (req, res) => {
  try {
    const { initiativeId } = req.params;

    const initiative = await WorkstreamService.unassignInitiative(initiativeId);
    res.json(initiative);
  } catch (err) {
    console.error('[Workstreams] Unassign initiative error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

