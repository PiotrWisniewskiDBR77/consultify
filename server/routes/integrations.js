/**
 * Integrations Routes
 * 
 * API endpoints for managing third-party integrations
 */

const express = require('express');
const router = express.Router();
const integrationService = require('../services/integrationService');
const authMiddleware = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

/**
 * GET /api/integrations
 * Get all integrations for organization
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.query.organizationId;
        const { type, enabled } = req.query;

        if (!orgId && !verifySuperAdmin) {
            return res.status(403).json({ error: 'Organization ID required' });
        }

        const filters = { type, enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined };
        const integrations = await integrationService.getIntegrations(orgId, filters);
        res.json(integrations);
    } catch (error) {
        console.error('[Integration] Error fetching integrations:', error);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});

/**
 * GET /api/integrations/:id
 * Get integration by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const integration = await integrationService.getIntegrationById(id);

        if (!integration) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        res.json(integration);
    } catch (error) {
        console.error('[Integration] Error fetching integration:', error);
        res.status(500).json({ error: 'Failed to fetch integration' });
    }
});

/**
 * POST /api/integrations
 * Create a new integration
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.body.organization_id;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const integrationData = {
            ...req.body,
            organization_id: orgId
        };

        const integration = await integrationService.createIntegration(integrationData);
        res.status(201).json(integration);
    } catch (error) {
        console.error('[Integration] Error creating integration:', error);
        res.status(500).json({ error: error.message || 'Failed to create integration' });
    }
});

/**
 * PUT /api/integrations/:id
 * Update an integration
 */
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const integration = await integrationService.updateIntegration(id, req.body);
        res.json(integration);
    } catch (error) {
        console.error('[Integration] Error updating integration:', error);
        res.status(500).json({ error: error.message || 'Failed to update integration' });
    }
});

/**
 * DELETE /api/integrations/:id
 * Delete an integration
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await integrationService.deleteIntegration(id);
        res.json(result);
    } catch (error) {
        console.error('[Integration] Error deleting integration:', error);
        res.status(500).json({ error: error.message || 'Failed to delete integration' });
    }
});

/**
 * POST /api/integrations/:id/sync
 * Trigger a sync for an integration
 */
router.post('/:id/sync', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { syncType = 'incremental' } = req.body;

        const result = await integrationService.syncIntegration(id, syncType);
        res.json(result);
    } catch (error) {
        console.error('[Integration] Error syncing integration:', error);
        res.status(500).json({ error: error.message || 'Failed to sync integration' });
    }
});

/**
 * GET /api/integrations/:id/sync-logs
 * Get sync logs for an integration
 */
router.get('/:id/sync-logs', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const logs = await integrationService.getSyncLogs(id, parseInt(limit));
        res.json(logs);
    } catch (error) {
        console.error('[Integration] Error fetching sync logs:', error);
        res.status(500).json({ error: 'Failed to fetch sync logs' });
    }
});

/**
 * GET /api/integrations/:id/health
 * Check integration health
 */
router.get('/:id/health', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const health = await integrationService.checkHealth(id);
        res.json(health);
    } catch (error) {
        console.error('[Integration] Error checking health:', error);
        res.status(500).json({ error: error.message || 'Failed to check integration health' });
    }
});

/**
 * GET /api/integrations/available/types
 * Get available integration types
 */
router.get('/available/types', authMiddleware, async (req, res) => {
    try {
        const types = integrationService.getAvailableTypes();
        res.json(types);
    } catch (error) {
        console.error('[Integration] Error fetching types:', error);
        res.status(500).json({ error: 'Failed to fetch integration types' });
    }
});

module.exports = router;




