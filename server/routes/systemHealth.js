const express = require('express');
const router = express.Router();
const SystemHealthService = require('../services/systemHealthService');
const { verifySuperAdmin } = require('../middleware/superAdminMiddleware'); // Assuming this exists or similar

// Only SuperAdmins should see detailed internals
// If middleware doesn't exist, we'll skip for now or use generic auth + role check
const requireSuperAdmin = (req, res, next) => {
    // Basic fallback check
    if (req.user && req.user.role === 'SUPERADMIN') return next();
    return res.status(403).json({ error: 'Access denied' });
};

router.get('/detailed', requireSuperAdmin, async (req, res) => {
    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

module.exports = router;
