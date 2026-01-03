/**
 * API Keys Routes
 * 
 * API endpoints for API key management
 */

const express = require('express');
const router = express.Router();
import apiKeyService from '../services/apiKeyService.js';
const authMiddleware = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

/**
 * GET /api/api-keys
 * Get all API keys
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const userId = req.user.id;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        // Users can only see their own keys, SuperAdmins can see all
        const keys = isSuperAdmin
            ? await apiKeyService.listKeys({ organizationId: req.query.organizationId })
            : await apiKeyService.listKeys({ userId, organizationId: orgId });

        res.json(keys);
    } catch (error) {
        console.error('[APIKey] Error fetching keys:', error);
        res.status(500).json({ error: 'Failed to fetch API keys' });
    }
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const userId = req.user.id;

        const keyData = {
            ...req.body,
            organizationId: orgId,
            userId
        };

        const result = await apiKeyService.generateKey(keyData);
        res.status(201).json(result);
    } catch (error) {
        console.error('[APIKey] Error creating key:', error);
        res.status(500).json({ error: error.message || 'Failed to create API key' });
    }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke an API key
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await apiKeyService.revokeKey(id);
        res.json(result);
    } catch (error) {
        console.error('[APIKey] Error revoking key:', error);
        res.status(500).json({ error: error.message || 'Failed to revoke API key' });
    }
});

/**
 * GET /api/api-keys/:id/usage
 * Get API key usage statistics
 */
router.get('/:id/usage', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // Usage tracking would be implemented in apiKeyService
        // For now, return basic info
        const key = await apiKeyService.getKeyById(id);
        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        res.json({
            key_id: id,
            last_used_at: key.last_used_at,
            usage_count: 0 // TODO: Implement usage tracking
        });
    } catch (error) {
        console.error('[APIKey] Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch API key usage' });
    }
});

module.exports = router;




