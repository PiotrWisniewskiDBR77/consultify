/**
 * Promo Code API Routes
 * 
 * Endpoints for promo code validation and management.
 * 
 * Public:
 * - POST /api/promo/validate - Validate a promo code (rate limited)
 * 
 * Authenticated:
 * - POST /api/promo/apply - Apply promo code to current organization
 * 
 * SuperAdmin:
 * - POST /api/promo/create - Create new promo code
 * - GET /api/promo - List all promo codes
 * - DELETE /api/promo/:id - Deactivate a promo code
 * - GET /api/promo/:id/usage - Get usage history
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const PromoCodeService = require('../services/promoCodeService');
const AttributionService = require('../services/attributionService');

// Rate limit promo validation: 10 per minute
const promoValidateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: {
        error: 'Too many promo code validation attempts. Please try again later.',
        errorCode: 'PROMO_RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * POST /api/promo/validate
 * Validate a promo code without consuming it
 * Public endpoint with rate limiting
 */
router.post('/validate', promoValidateLimiter, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ valid: false, reason: 'Promo code is required' });
        }

        const validation = await PromoCodeService.validatePromoCode(code);

        // Don't expose internal IDs to public endpoint
        if (validation.valid) {
            res.json({
                valid: true,
                type: validation.type,
                discount: validation.discountMessage || null,
                message: validation.discountMessage ? `Applied: ${validation.discountMessage}` : 'Applied for tracking'
            });
        } else {
            res.json({
                valid: false,
                reason: validation.reason
            });
        }
    } catch (error) {
        console.error('[Promo] Validation error:', error);
        res.status(500).json({ valid: false, reason: 'Validation failed' });
    }
});

/**
 * POST /api/promo/apply
 * Apply a promo code to the current user's organization
 * Requires authentication
 */
router.post('/apply', authMiddleware, async (req, res) => {
    try {
        const { code, campaign, medium, partnerCode } = req.body;
        const organizationId = req.user.organization_id;
        const userId = req.user.id;

        if (!code) {
            return res.status(400).json({ error: 'Promo code is required' });
        }

        // Mark promo code as used
        const result = await PromoCodeService.markPromoCodeUsed(code, organizationId, userId);

        if (!result.success) {
            return res.status(400).json({ error: result.reason, errorCode: 'PROMO_APPLY_FAILED' });
        }

        // Record attribution
        await AttributionService.recordAttribution({
            organizationId,
            userId,
            sourceType: AttributionService.SOURCE_TYPES.PROMO_CODE,
            sourceId: result.codeId,
            campaign,
            partnerCode: partnerCode || null,
            medium,
            metadata: { code, appliedAt: new Date().toISOString() }
        });

        res.json({
            success: true,
            discountType: result.discountType,
            discountValue: result.discountValue,
            message: result.discountValue ? `Applied: ${result.discountType === 'PERCENT' ? `-${result.discountValue}%` : `-$${result.discountValue}`}` : 'Promo code applied for tracking'
        });
    } catch (error) {
        console.error('[Promo] Apply error:', error);
        res.status(500).json({ error: 'Failed to apply promo code' });
    }
});

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * Middleware to require SUPERADMIN role
 */
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    next();
};

/**
 * POST /api/promo/create
 * Create a new promo code (SuperAdmin only)
 */
router.post('/create', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const {
            code,
            type,
            discountType,
            discountValue,
            validFrom,
            validUntil,
            maxUses,
            metadata
        } = req.body;

        if (!code || !type || !validFrom) {
            return res.status(400).json({ error: 'Code, type, and validFrom are required' });
        }

        const promoCode = await PromoCodeService.createPromoCode({
            code,
            type,
            discountType,
            discountValue,
            validFrom,
            validUntil,
            maxUses,
            createdByUserId: req.user.id,
            metadata
        });

        res.status(201).json(promoCode);
    } catch (error) {
        console.error('[Promo] Create error:', error);
        if (error.message === 'Promo code already exists') {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create promo code' });
    }
});

/**
 * GET /api/promo
 * List all promo codes (SuperAdmin only)
 */
router.get('/', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const { includeInactive, type, limit, offset } = req.query;

        const promoCodes = await PromoCodeService.listPromoCodes({
            includeInactive: includeInactive === 'true',
            type: type || null,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        });

        res.json(promoCodes);
    } catch (error) {
        console.error('[Promo] List error:', error);
        res.status(500).json({ error: 'Failed to list promo codes' });
    }
});

/**
 * DELETE /api/promo/:id
 * Deactivate a promo code (SuperAdmin only)
 */
router.delete('/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const result = await PromoCodeService.deactivatePromoCode(req.params.id);

        if (!result.success) {
            return res.status(404).json({ error: 'Promo code not found' });
        }

        res.json({ success: true, message: 'Promo code deactivated' });
    } catch (error) {
        console.error('[Promo] Deactivate error:', error);
        res.status(500).json({ error: 'Failed to deactivate promo code' });
    }
});

/**
 * GET /api/promo/:id/usage
 * Get promo code usage history (SuperAdmin only)
 */
router.get('/:id/usage', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const usage = await PromoCodeService.getUsageHistory(req.params.id);
        res.json(usage);
    } catch (error) {
        console.error('[Promo] Usage history error:', error);
        res.status(500).json({ error: 'Failed to get usage history' });
    }
});

module.exports = router;
