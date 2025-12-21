/**
 * Connectors API Routes
 * Step 17: Integrations & Secrets Platform
 * 
 * REST API for connector management.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');
const connectorService = require('../services/connectorService');
const connectorHealthService = require('../services/connectorHealthService');

/**
 * Permission check middleware for CONNECTORS_MANAGE.
 */
const requireConnectorsManage = (req, res, next) => {
    const userRole = req.user?.role;

    // SUPERADMIN and ADMIN with implicit CONNECTORS_MANAGE permission
    if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
        return next();
    }

    return res.status(403).json({
        error: 'Permission denied',
        required: 'CONNECTORS_MANAGE',
        message: 'Only Admins can manage connectors'
    });
};

// ============================================
// PUBLIC CATALOG (Authenticated users)
// ============================================

/**
 * GET /api/connectors
 * Returns catalog of available connectors.
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const catalog = await connectorService.getCatalog();

        res.json({
            connectors: catalog,
            total: catalog.length
        });
    } catch (error) {
        console.error('Error fetching connector catalog:', error);
        res.status(500).json({ error: 'Failed to fetch connector catalog' });
    }
});

// ============================================
// ORG CONFIG (Admin only)
// ============================================

/**
 * GET /api/connectors/org
 * Returns org's configured connectors with redacted secrets.
 */
router.get('/org', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const configs = await connectorService.getOrgConfigs(orgId);

        res.json({
            connectors: configs,
            total: configs.length
        });
    } catch (error) {
        console.error('Error fetching org connectors:', error);
        res.status(500).json({ error: 'Failed to fetch organization connectors' });
    }
});

/**
 * POST /api/connectors/:key/connect
 * Connect an integration with secrets.
 */
router.post('/:key/connect', verifyToken, verifyAdmin, requireConnectorsManage, async (req, res) => {
    try {
        const { key } = req.params;
        const { secrets, scopes, sandbox_mode } = req.body;
        const orgId = req.user.organizationId;
        const userId = req.user.id;

        if (!secrets || typeof secrets !== 'object') {
            return res.status(400).json({ error: 'Secrets object is required' });
        }

        const config = await connectorService.connect(orgId, key, secrets, scopes || [], {
            configuredBy: userId,
            sandboxMode: sandbox_mode || false
        });

        res.json({
            success: true,
            message: `Connector ${key} connected successfully`,
            config
        });
    } catch (error) {
        console.error('Error connecting connector:', error);

        if (error.message.includes('Unknown connector') || error.message.includes('Missing required')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to connect connector' });
    }
});

/**
 * POST /api/connectors/:key/disconnect
 * Disconnect an integration.
 */
router.post('/:key/disconnect', verifyToken, verifyAdmin, requireConnectorsManage, async (req, res) => {
    try {
        const { key } = req.params;
        const orgId = req.user.organizationId;
        const userId = req.user.id;

        const success = await connectorService.disconnect(orgId, key, userId);

        if (!success) {
            return res.status(404).json({ error: `Connector ${key} is not configured` });
        }

        res.json({
            success: true,
            message: `Connector ${key} disconnected successfully`
        });
    } catch (error) {
        console.error('Error disconnecting connector:', error);
        res.status(500).json({ error: 'Failed to disconnect connector' });
    }
});

/**
 * POST /api/connectors/:key/test
 * Test connection health.
 */
router.post('/:key/test', verifyToken, verifyAdmin, requireConnectorsManage, async (req, res) => {
    try {
        const { key } = req.params;
        const orgId = req.user.organizationId;

        const result = await connectorHealthService.testConnection(orgId, key);

        res.json(result);
    } catch (error) {
        console.error('Error testing connector:', error);
        res.status(500).json({ error: 'Failed to test connector' });
    }
});

/**
 * PUT /api/connectors/:key/secrets
 * Update/rotate secrets for an existing connection.
 */
router.put('/:key/secrets', verifyToken, verifyAdmin, requireConnectorsManage, async (req, res) => {
    try {
        const { key } = req.params;
        const { secrets } = req.body;
        const orgId = req.user.organizationId;
        const userId = req.user.id;

        if (!secrets || typeof secrets !== 'object') {
            return res.status(400).json({ error: 'Secrets object is required' });
        }

        const success = await connectorService.updateSecret(orgId, key, secrets, userId);

        if (!success) {
            return res.status(404).json({ error: `Connector ${key} is not configured` });
        }

        res.json({
            success: true,
            message: `Secrets for ${key} updated successfully`
        });
    } catch (error) {
        console.error('Error updating connector secrets:', error);

        if (error.message.includes('Missing required')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to update connector secrets' });
    }
});

/**
 * GET /api/connectors/health
 * Get health status for all org connectors.
 */
router.get('/health', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const health = await connectorHealthService.getHealth(orgId);

        res.json({
            health,
            total: health.length
        });
    } catch (error) {
        console.error('Error fetching connector health:', error);
        res.status(500).json({ error: 'Failed to fetch connector health' });
    }
});

module.exports = router;
