/**
 * Work Mode Routes
 * 
 * API endpoints for managing organization work mode configuration.
 * 
 * @module routes/workMode
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbac');
const WorkModeService = require('../services/workModeService');

/**
 * GET /api/org/work-mode
 * Get current organization work mode configuration
 */
router.get('/', auth, async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID is required',
        code: 'NO_ORGANIZATION'
      });
    }

    const config = await WorkModeService.getWorkMode(organizationId);
    res.json(config);
  } catch (error) {
    console.error('[WorkMode] Error getting work mode:', error);
    res.status(500).json({ error: 'Failed to get work mode configuration' });
  }
});

/**
 * PUT /api/org/work-mode
 * Update organization work mode
 * Requires ADMIN role
 */
router.put('/', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID is required',
        code: 'NO_ORGANIZATION'
      });
    }

    const { workMode, projectLabel, locationLabel, teamLabel } = req.body;

    if (!workMode) {
      return res.status(400).json({
        error: 'Work mode is required',
        code: 'MISSING_WORK_MODE'
      });
    }

    const config = await WorkModeService.setWorkMode(organizationId, workMode, {
      projectLabel,
      locationLabel,
      teamLabel
    });

    res.json({
      success: true,
      message: 'Work mode updated successfully',
      config
    });
  } catch (error) {
    console.error('[WorkMode] Error setting work mode:', error);

    if (error.message.includes('Invalid work mode')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update work mode configuration' });
  }
});

/**
 * GET /api/org/work-mode/options
 * Get all available work mode options
 */
router.get('/options', auth, async (req, res) => {
  try {
    const modes = WorkModeService.getAllWorkModes();
    res.json(modes);
  } catch (error) {
    console.error('[WorkMode] Error getting work mode options:', error);
    res.status(500).json({ error: 'Failed to get work mode options' });
  }
});

/**
 * GET /api/org/work-mode/capabilities
 * Get effective capabilities for current user
 */
router.get('/capabilities', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId || req.user.organization_id;
    const { projectId, facilityId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID is required',
        code: 'NO_ORGANIZATION'
      });
    }

    const capabilities = await WorkModeService.getEffectiveCapabilities(
      userId,
      organizationId,
      { projectId, facilityId }
    );

    res.json(capabilities);
  } catch (error) {
    console.error('[WorkMode] Error getting capabilities:', error);
    res.status(500).json({ error: 'Failed to get user capabilities' });
  }
});

/**
 * POST /api/org/work-mode/check-capability
 * Check if user has a specific capability
 */
router.post('/check-capability', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId || req.user.organization_id;
    const { capability, projectId, facilityId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID is required',
        code: 'NO_ORGANIZATION'
      });
    }

    if (!capability) {
      return res.status(400).json({
        error: 'Capability is required',
        code: 'MISSING_CAPABILITY'
      });
    }

    const hasCapability = await WorkModeService.hasCapability(
      userId,
      organizationId,
      capability,
      { projectId, facilityId }
    );

    res.json({
      capability,
      hasCapability,
      context: { projectId, facilityId }
    });
  } catch (error) {
    console.error('[WorkMode] Error checking capability:', error);
    res.status(500).json({ error: 'Failed to check capability' });
  }
});

/**
 * GET /api/org/work-mode/visibility-rules
 * Get task visibility rules for current user
 */
router.get('/visibility-rules', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId || req.user.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID is required',
        code: 'NO_ORGANIZATION'
      });
    }

    const rules = await WorkModeService.getTaskVisibilityRules(userId, organizationId);
    res.json(rules);
  } catch (error) {
    console.error('[WorkMode] Error getting visibility rules:', error);
    res.status(500).json({ error: 'Failed to get visibility rules' });
  }
});

module.exports = router;



