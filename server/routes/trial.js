const express = require('express');
const router = express.Router();
const TrialService = require('../services/trialService');
const auth = require('../middleware/authMiddleware');
const demoGuard = require('../middleware/demoGuard');
const AuditService = require('../services/auditService');

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

// POST /api/trial/confirm-transition — Phase C → D Gate
// Records explicit user confirmations before organization creation
router.post('/confirm-transition', auth, async (req, res) => {
    try {
        const { confirmations, confirmedAt } = req.body;
        const userId = req.user.id;

        // Validate all 3 confirmations are present
        if (!confirmations?.timeCommitment || !confirmations?.teamScope || !confirmations?.memoryAware) {
            return res.status(400).json({
                error: 'All three confirmations required',
                required: ['timeCommitment', 'teamScope', 'memoryAware']
            });
        }

        // Log to audit trail
        await AuditService.log({
            userId,
            action: 'trial_transition_confirmed',
            entityType: 'user',
            entityId: userId,
            metadata: {
                confirmations,
                confirmedAt: confirmedAt || new Date().toISOString(),
                phase: 'C_TO_D',
            }
        });

        res.json({
            success: true,
            message: 'Transition confirmed',
            nextStep: 'ORG_SETUP_WIZARD'
        });
    } catch (error) {
        console.error('Transition Confirmation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
