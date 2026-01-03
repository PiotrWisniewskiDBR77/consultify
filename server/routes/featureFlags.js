import express from 'express';
const router = express.Router();
const FeatureFlagService = import('featureFlagService.js');
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * GET /api/feature-flags
 * Get client-side flags (evaluated for current user)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const context = {
            userId: req.user?.id,
            orgId: req.user?.organizationId,
            email: req.user?.email,
            role: req.user?.role
        };

        // We only expose flags that evaluate to TRUE for this user
        await FeatureFlagService.refreshCache();
        const allFlags = FeatureFlagService.cache;

        const enabledFlags = {};
        for (const key of Object.keys(allFlags)) {
            if (await FeatureFlagService.isEnabled(key, context)) {
                enabledFlags[key] = true;
            }
        }

        res.json(enabledFlags);
    } catch (error) {
        console.error('[FeatureFlag] Error fetching flags:', error);
        res.status(500).json({ error: 'Failed to fetch feature flags' });
    }
});

/**
 * GET /api/feature-flags/admin
 * Get all feature flags (admin only)
 */
router.get('/admin', verifySuperAdmin, async (req, res) => {
    try {
        const { environment, organizationId, enabled } = req.query;

        const filters = {
            environment,
            organizationId: organizationId === 'null' ? null : organizationId,
            enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined
        };

        const flags = await FeatureFlagService.getFlags(filters);
        res.json(flags);
    } catch (error) {
        console.error('[FeatureFlag] Error fetching admin flags:', error);
        res.status(500).json({ error: 'Failed to fetch feature flags' });
    }
});

/**
 * GET /api/feature-flags/:id
 * Get feature flag by ID
 */
router.get('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const flag = await FeatureFlagService.getFlagById(id);

        if (!flag) {
            return res.status(404).json({ error: 'Feature flag not found' });
        }

        res.json(flag);
    } catch (error) {
        console.error('[FeatureFlag] Error fetching flag:', error);
        res.status(500).json({ error: 'Failed to fetch feature flag' });
    }
});

/**
 * POST /api/feature-flags
 * Create a new feature flag
 */
router.post('/', verifySuperAdmin, async (req, res) => {
    try {
        const flagData = {
            ...req.body,
            created_by: req.user.id
        };

        const flag = await FeatureFlagService.createFlag(flagData);
        res.status(201).json(flag);
    } catch (error) {
        console.error('[FeatureFlag] Error creating flag:', error);
        res.status(500).json({ error: error.message || 'Failed to create feature flag' });
    }
});

/**
 * PUT /api/feature-flags/:id
 * Update a feature flag
 */
router.put('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {
            ...req.body,
            updated_by: req.user.id
        };

        const flag = await FeatureFlagService.updateFlag(id, updates);
        res.json(flag);
    } catch (error) {
        console.error('[FeatureFlag] Error updating flag:', error);
        res.status(500).json({ error: error.message || 'Failed to update feature flag' });
    }
});

/**
 * DELETE /api/feature-flags/:id
 * Delete a feature flag
 */
router.delete('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await FeatureFlagService.deleteFlag(id, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[FeatureFlag] Error deleting flag:', error);
        res.status(500).json({ error: error.message || 'Failed to delete feature flag' });
    }
});

/**
 * POST /api/feature-flags/:id/toggle
 * Toggle a feature flag
 */
router.post('/:id/toggle', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const flag = await FeatureFlagService.toggleFlag(id, enabled, req.user.id);
        res.json(flag);
    } catch (error) {
        console.error('[FeatureFlag] Error toggling flag:', error);
        res.status(500).json({ error: error.message || 'Failed to toggle feature flag' });
    }
});

/**
 * GET /api/feature-flags/:id/history
 * Get feature flag history
 */
router.get('/:id/history', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const history = await FeatureFlagService.getFlagHistory(id, parseInt(limit));
        res.json(history);
    } catch (error) {
        console.error('[FeatureFlag] Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch feature flag history' });
    }
});

/**
 * GET /api/feature-flags/evaluate
 * Evaluate flags for a specific context
 */
router.get('/evaluate/context', verifySuperAdmin, async (req, res) => {
    try {
        const { key, context, environment } = req.query;

        if (!key) {
            return res.status(400).json({ error: 'Flag key is required' });
        }

        const parsedContext = context ? JSON.parse(context) : {};
        const enabled = await FeatureFlagService.isEnabled(key, parsedContext, environment || 'production');

        res.json({ key, enabled, context: parsedContext });
    } catch (error) {
        console.error('[FeatureFlag] Error evaluating flag:', error);
        res.status(500).json({ error: 'Failed to evaluate feature flag' });
    }
});

export default router;
