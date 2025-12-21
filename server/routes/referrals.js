/**
 * Referrals API Routes
 * 
 * Phase G: Ecosystem Participation referral endpoints.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ReferralService = require('../services/referralService');

/**
 * POST /api/referrals/generate
 * Generate a new referral code
 */
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const userState = req.userState || 'ANON'; // Default to ANON if not attached
        const { expiresInDays } = req.body;

        const result = await ReferralService.generateCode(userId, userState, expiresInDays || 90);

        res.json({
            success: true,
            referral: result
        });
    } catch (error) {
        console.error('[Referrals] Generate error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/referrals/validate/:code
 * Validate a referral code (public)
 */
router.get('/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const result = await ReferralService.validateCode(code);

        if (!result) {
            return res.status(404).json({
                success: false,
                valid: false,
                error: 'Invalid or expired referral code'
            });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[Referrals] Validate error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/referrals/use
 * Record usage of a referral code
 */
router.post('/use', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { code, organizationId } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Referral code required'
            });
        }

        const result = await ReferralService.recordUsage(code, userId, organizationId);

        res.json(result);
    } catch (error) {
        console.error('[Referrals] Use error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/referrals/my
 * Get current user's referrals
 */
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const referrals = await ReferralService.getUserReferrals(userId);

        res.json({
            success: true,
            referrals
        });
    } catch (error) {
        console.error('[Referrals] My referrals error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/referrals/stats
 * Get ecosystem statistics (admin only)
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        // Only ADMIN or SUPERADMIN can view global stats
        if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized: Admin access required for ecosystem statistics'
            });
        }

        const stats = await ReferralService.getEcosystemStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[Referrals] Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
