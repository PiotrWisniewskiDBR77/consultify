const express = require('express');
const router = express.Router();
const SystemHealthService = require('../services/systemHealthService');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

// Only SuperAdmins should see detailed internals
router.get('/detailed', verifySuperAdmin, async (req, res) => {
    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

module.exports = router;
