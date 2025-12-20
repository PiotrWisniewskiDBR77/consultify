/**
 * Organization Limits API Routes
 * 
 * Endpoints for:
 * - Viewing organization limits and usage
 * - Policy snapshot (single source of truth for UI)
 * - Trial status
 * - Trial upgrade (admin only)
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AccessPolicyService = require('../services/accessPolicyService');
const TrialService = require('../services/trialService');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

/**
 * GET /api/organization/policy-snapshot
 * SINGLE SOURCE OF TRUTH for UI gating
 * UI should ONLY use this endpoint - no local calculations
 */
router.get('/policy-snapshot', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const snapshot = await AccessPolicyService.buildPolicySnapshot(organizationId);

        if (!snapshot) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json(snapshot);

    } catch (error) {
        console.error('[OrgLimits] Error building policy snapshot:', error);
        res.status(500).json({ error: 'Failed to build policy snapshot' });
    }
});

/**
 * GET /api/organization/limits
 * Get current organization limits and usage
 */
router.get('/limits', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;

        const [limits, usage, trialStatus] = await Promise.all([
            AccessPolicyService.getOrganizationLimits(organizationId),
            AccessPolicyService.getDailyUsage(organizationId),
            AccessPolicyService.checkTrialStatus(organizationId)
        ]);

        res.json({
            limits,
            usage,
            trialStatus
        });

    } catch (error) {
        console.error('[OrgLimits] Error fetching limits:', error);
        res.status(500).json({ error: 'Failed to fetch organization limits' });
    }
});

/**
 * GET /api/organization/trial-status
 * Get detailed trial status
 */
router.get('/trial-status', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const status = await TrialService.getTrialStatus(organizationId);

        res.json(status);

    } catch (error) {
        console.error('[OrgLimits] Error fetching trial status:', error);
        res.status(500).json({ error: 'Failed to fetch trial status' });
    }
});

/**
 * GET /api/organization/access-context
 * Get AI access context (used by frontend for banners/badges)
 */
router.get('/access-context', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const accessContext = await AccessPolicyService.getAIAccessContext(organizationId);

        res.json(accessContext);

    } catch (error) {
        console.error('[OrgLimits] Error fetching access context:', error);
        res.status(500).json({ error: 'Failed to fetch access context' });
    }
});

/**
 * GET /api/organization/seat-availability
 * Get seat availability for Step 3 invitations
 */
router.get('/seat-availability', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const availability = await AccessPolicyService.getSeatAvailability(organizationId);

        res.json(availability);

    } catch (error) {
        console.error('[OrgLimits] Error fetching seat availability:', error);
        res.status(500).json({ error: 'Failed to fetch seat availability' });
    }
});

/**
 * PUT /api/organization/:id/upgrade
 * Upgrade trial to paid (SuperAdmin only)
 * IDEMPOTENT: If already PAID, returns success without changes
 */
router.put('/:id/upgrade', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { planType } = req.body;

        if (!planType || !['PRO', 'ENTERPRISE'].includes(planType.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid plan type. Must be PRO or ENTERPRISE.' });
        }

        const result = await TrialService.upgradeToPaid(id, planType.toUpperCase(), req.user.id);

        res.json(result);

    } catch (error) {
        console.error('[OrgLimits] Error upgrading organization:', error);
        res.status(500).json({ error: error.message || 'Failed to upgrade organization' });
    }
});

/**
 * PUT /api/organization/:id/extend-trial
 * Extend trial period (SuperAdmin only)
 * 
 * Rules:
 * - Only for organization_type = TRIAL
 * - Max extensions: 2 (MAX_TRIAL_EXTENSIONS)
 * - Max days per extension: 14 (MAX_EXTENSION_DAYS)
 * - Requires reason field
 */
router.put('/:id/extend-trial', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { additionalDays, reason } = req.body;

        // Validate reason is provided
        if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
            return res.status(400).json({
                error: 'Reason is required and must be at least 5 characters.',
                errorCode: 'REASON_REQUIRED'
            });
        }

        // Validate additionalDays
        if (!additionalDays || additionalDays < 1 || additionalDays > AccessPolicyService.MAX_EXTENSION_DAYS) {
            return res.status(400).json({
                error: `Invalid additional days. Must be between 1 and ${AccessPolicyService.MAX_EXTENSION_DAYS}.`,
                errorCode: 'INVALID_DAYS'
            });
        }

        const result = await TrialService.extendTrial(id, additionalDays, req.user.id, reason);

        res.json(result);

    } catch (error) {
        console.error('[OrgLimits] Error extending trial:', error);

        // Return appropriate error code
        if (error.errorCode) {
            return res.status(error.status || 400).json({
                error: error.message,
                errorCode: error.errorCode
            });
        }

        res.status(500).json({ error: error.message || 'Failed to extend trial' });
    }
});

module.exports = router;

