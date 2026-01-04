/**
 * System Configuration Routes
 * 
 * API endpoints for system configuration management
 */

import express from 'express';
const router = express.Router();
import * as systemConfigServiceModule from '../services/systemConfigService.js';
const systemConfigService = systemConfigServiceModule.default || systemConfigServiceModule;
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * GET /api/system-config
 * Get all system configurations
 */
router.get('/', verifySuperAdmin, async (req, res) => {
    try {
        const { environment } = req.query;
        const configs = await systemConfigService.getAllConfigs(environment);
        res.json(configs);
    } catch (error) {
        console.error('[SystemConfig] Error fetching configs:', error);
        res.status(500).json({ error: 'Failed to fetch system configurations' });
    }
});

/**
 * GET /api/system-config/:key
 * Get configuration value by key
 */
router.get('/:key', verifySuperAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { environment } = req.query;

        const config = await systemConfigService.getConfig(key, environment);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(config);
    } catch (error) {
        console.error('[SystemConfig] Error fetching config:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
});

/**
 * POST /api/system-config
 * Set configuration value
 */
router.post('/', verifySuperAdmin, async (req, res) => {
    try {
        const configData = {
            ...req.body,
            updated_by: req.user.id
        };

        const config = await systemConfigService.setConfig(configData);
        res.json(config);
    } catch (error) {
        console.error('[SystemConfig] Error setting config:', error);
        res.status(500).json({ error: error.message || 'Failed to set system configuration' });
    }
});

/**
 * DELETE /api/system-config/:key
 * Delete configuration
 */
router.delete('/:key', verifySuperAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { environment } = req.query;

        const result = await systemConfigService.deleteConfig(key, environment);
        res.json(result);
    } catch (error) {
        console.error('[SystemConfig] Error deleting config:', error);
        res.status(500).json({ error: 'Failed to delete system configuration' });
    }
});

export default router;







