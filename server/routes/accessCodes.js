/**
 * Access Codes Router — HARDENED
 * 
 * API endpoints for managing and using access codes.
 * 
 * SECURITY:
 * - Rate limiting on validate/accept endpoints
 * - Sanitized responses (no org names, no attribution, no uses_count)
 * - Email from body for email-match validation
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const AccessCodeService = require('../services/accessCodeService');
const authenticateToken = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate endpoint: 60 requests/min per IP
 * (Prevents enumeration attacks)
 */
const validateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { valid: false, error: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
});

/**
 * Accept endpoint: 20 requests/min per IP
 * (Prevents trial spam)
 */
const acceptLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: { ok: false, error: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/access-codes/generate
 * @desc Generate a new access code
 * @access Protected (Admin, Consultant)
 */
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { type, maxUses, expiresInDays, organizationId, targetEmail, metadata } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // RBAC enforcement
        let createdByConsultantId = null;

        if (type === AccessCodeService.CODE_TYPES.CONSULTANT || type === AccessCodeService.CODE_TYPES.TRIAL) {
            if (!['SUPERADMIN', 'ADMIN', 'CONSULTANT'].includes(userRole)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            if (userRole === 'CONSULTANT') {
                createdByConsultantId = userId;
            }
        } else if (type === AccessCodeService.CODE_TYPES.INVITE) {
            if (!['SUPERADMIN', 'ADMIN'].includes(userRole)) {
                return res.status(403).json({ error: 'Only Admins can generate team invites' });
            }
            // Org scoping
            if (userRole === 'ADMIN' && organizationId && organizationId !== req.user.organizationId) {
                return res.status(403).json({ error: 'Cannot generate invite for another organization' });
            }
        }

        const code = await AccessCodeService.generateCode({
            type,
            createdByUserId: userId,
            createdByConsultantId,
            organizationId: organizationId || (type === 'INVITE' ? req.user.organizationId : null),
            targetEmail: targetEmail || null,
            maxUses,
            expiresInDays,
            metadata
        });

        // Return plaintext code (ONCE)
        res.status(201).json({
            code: code.code,
            expiresAt: code.expiresAt,
            maxUses: code.maxUses
        });
    } catch (err) {
        console.error('[AccessCodes] Generate error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/access-codes/validate/:code
 * @desc Validate a code (PUBLIC, rate-limited)
 * @access Public
 * 
 * PRIVACY: Returns ONLY { valid, type, requiresEmailMatch }
 * NO org names, NO uses_count, NO target_email value
 */
router.get('/validate/:code', validateLimiter, async (req, res) => {
    try {
        const result = await AccessCodeService.validatePublic(req.params.code);
        res.json(result);
    } catch (err) {
        // Always return same shape for privacy
        res.json({ valid: false });
    }
});

/**
 * @route POST /api/access-codes/accept
 * @desc Accept/consume a code (PUBLIC, rate-limited)
 * @access Public (for registration) or Protected (for logged-in users)
 * 
 * PRIVACY: Returns { ok, outcome, organizationId? } but NO attribution, NO sensitive metadata
 */
router.post('/accept', acceptLimiter, async (req, res) => {
    try {
        const { code, email, userId: bodyUserId } = req.body;

        // Determine user ID (logged-in takes precedence)
        const actorUserId = req.user?.id || bodyUserId;

        if (!actorUserId) {
            return res.status(400).json({ ok: false, error: 'USER_REQUIRED' });
        }

        if (!code) {
            return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });
        }

        const result = await AccessCodeService.acceptCode({
            code,
            actorUserId,
            providedEmail: email,
            actorIp: req.ip
        });

        // Sanitize response
        if (result.ok) {
            res.json({
                ok: true,
                type: result.type,
                outcome: result.outcome,
                organizationId: result.organizationId || null
            });
        } else {
            res.status(400).json({
                ok: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('[AccessCodes] Accept error:', err);
        res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
    }
});

/**
 * @route GET /api/access-codes/my-codes
 * @desc List codes created by current user
 * @access Protected
 */
router.get('/my-codes', authenticateToken, async (req, res) => {
    try {
        const codes = await AccessCodeService.listCodes(
            req.user.id,
            req.user.role === 'CONSULTANT' ? 'CONSULTANT' : 'USER'
        );
        // Sanitize: remove code_hash from response
        const sanitized = codes.map(c => ({
            id: c.id,
            code: c.code,
            type: c.type,
            maxUses: c.max_uses,
            usesCount: c.uses_count,
            expiresAt: c.expires_at,
            status: c.status,
            createdAt: c.created_at
        }));
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/access-codes/:id/revoke
 * @desc Revoke a code
 * @access Protected
 */
router.post('/:id/revoke', authenticateToken, async (req, res) => {
    try {
        // TODO: Add ownership verification
        await AccessCodeService.revokeCode(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
