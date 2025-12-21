/**
 * Email Verification Routes
 * 
 * API endpoints for email verification flow.
 * 
 * Endpoints:
 * - GET  /api/verify/status - Check verification status
 * - POST /api/verify/send - Send/resend verification email
 * - POST /api/verify/:token - Verify email with token
 * - POST /api/verify/change-email - Request email change
 * - POST /api/verify/confirm-change/:token - Confirm email change
 * - DELETE /api/verify/cancel-change - Cancel pending email change
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const EmailVerificationService = require('../services/emailVerificationService');
const AuditService = require('../services/auditService');

/**
 * GET /api/verify/status
 * Check email verification status for current user
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const isVerified = await EmailVerificationService.isEmailVerified(userId);

        res.json({
            verified: isVerified,
            email: req.user.email
        });
    } catch (error) {
        console.error('[Verify] Status error:', error);
        res.status(500).json({ error: 'Failed to check verification status' });
    }
});

/**
 * POST /api/verify/send
 * Send or resend verification email
 */
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;

        // Check if already verified
        const isVerified = await EmailVerificationService.isEmailVerified(userId);
        if (isVerified) {
            return res.json({
                success: true,
                message: 'Email is already verified',
                alreadyVerified: true
            });
        }

        const result = await EmailVerificationService.sendVerificationEmail(userId, email);

        if (!result.success) {
            return res.status(429).json(result); // Rate limited
        }

        // Log verification email sent
        AuditService.logFromRequest(req, 'VERIFICATION_EMAIL_SENT', 'user', userId, {
            email: email
        });

        res.json(result);
    } catch (error) {
        console.error('[Verify] Send error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

/**
 * POST /api/verify/:token
 * Verify email with token (public - no auth required)
 */
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const result = await EmailVerificationService.verifyEmail(token);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Log email verified
        AuditService.logSystemEvent('EMAIL_VERIFIED', 'user', result.userId, null, {
            email: result.email
        });

        res.json({
            success: true,
            message: 'Email verified successfully. You can now log in.'
        });
    } catch (error) {
        console.error('[Verify] Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/verify/change-email
 * Request email change (requires password verification)
 * Body: { newEmail: string, password: string }
 */
router.post('/change-email', authMiddleware, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const userId = req.user.id;

        if (!newEmail || !password) {
            return res.status(400).json({ error: 'New email and password are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const result = await EmailVerificationService.requestEmailChange(userId, newEmail, password);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Log email change requested
        AuditService.logFromRequest(req, 'EMAIL_CHANGE_REQUESTED', 'user', userId, {
            newEmail: newEmail
        });

        res.json(result);
    } catch (error) {
        console.error('[Verify] Email change request error:', error);
        res.status(500).json({ error: 'Failed to request email change' });
    }
});

/**
 * POST /api/verify/confirm-change/:token
 * Confirm email change with token (public - no auth required)
 */
router.post('/confirm-change/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const result = await EmailVerificationService.confirmEmailChange(token);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Log email changed (security event)
        AuditService.logSystemEvent('EMAIL_CHANGED', 'user', null, null, {
            oldEmail: result.oldEmail,
            newEmail: result.newEmail
        });

        res.json({
            success: true,
            message: 'Email changed successfully. Please log in with your new email.',
            newEmail: result.newEmail
        });
    } catch (error) {
        console.error('[Verify] Email change confirmation error:', error);
        res.status(500).json({ error: 'Email change confirmation failed' });
    }
});

/**
 * DELETE /api/verify/cancel-change
 * Cancel pending email change
 */
router.delete('/cancel-change', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await EmailVerificationService.cancelEmailChange(userId);

        // Log cancellation
        AuditService.logFromRequest(req, 'EMAIL_CHANGE_CANCELLED', 'user', userId);

        res.json({ success: true, message: 'Email change cancelled' });
    } catch (error) {
        console.error('[Verify] Cancel email change error:', error);
        res.status(500).json({ error: 'Failed to cancel email change' });
    }
});

module.exports = router;
