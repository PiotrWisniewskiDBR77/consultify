const express = require('express');
const router = express.Router();
const FeatureFlagService = require('../services/featureFlagService');
const authMiddleware = require('../middleware/authMiddleware');

// Public route (or auth optional) to get client-side flags
router.get('/', authMiddleware, async (req, res) => {
    try {
        const context = {
            userId: req.user?.id,
            orgId: req.user?.organizationId,
            email: req.user?.email,
            role: req.user?.role
        };

        // We only expose flags that evaluate to TRUE for this user
        // This prevents leaking beta features or upcoming keys
        await FeatureFlagService.refreshCache();
        const allFlags = FeatureFlagService.cache; // Access internal cache mostly safe here or add getter

        const enabledFlags = {};
        for (const key of Object.keys(allFlags)) {
            if (await FeatureFlagService.isEnabled(key, context)) {
                enabledFlags[key] = true;
            }
        }

        res.json(enabledFlags);
    } catch (error) {
        console.error('Feature flag error', error);
        res.status(500).json({});
    }
});

// Admin routes would go here (POST / to create flags) - Omitted for brevity

module.exports = router;
