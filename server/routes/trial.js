const express = require('express');
const router = express.Router();
const TrialService = require('../services/trialService');
const auth = require('../middleware/authMiddleware');
const demoGuard = require('../middleware/demoGuard');

// POST /api/trial/:trialId/convert
router.post('/:trialId/convert', auth, demoGuard, async (req, res) => {
    try {
        const { trialId } = req.params;
        const { newOrgName } = req.body;
        const userId = req.user.id;

        if (!newOrgName) {
            return res.status(400).json({ error: 'New organization name is required' });
        }

        const result = await TrialService.convertTrialToOrg(trialId, userId, newOrgName);

        // Optional: Switch session to new org immediately?
        // Frontend will handle redirect, but backend remains stateless regarding session token usually,
        // unless token has org claim. If so, user needs to refresh token.

        res.json({
            success: true,
            message: 'Trial converted successfully',
            newOrganizationId: result.newOrganizationId
        });
    } catch (error) {
        console.error('Trial Conversion Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
