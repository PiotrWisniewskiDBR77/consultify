/**
 * WebAuthn Routes
 * 
 * Endpoints for WebAuthn/Passkey authentication
 * Supports credential registration and authentication
 */

import express from 'express';
const router = express.Router();
import * as webauthnServiceModule from '../services/webauthnService.js';
const webauthnService = webauthnServiceModule.default || webauthnServiceModule;
import verifyToken from '../middleware/authMiddleware.js';

// ====== REGISTRATION ENDPOINTS ======

/**
 * POST /register/options
 * Generate registration options for WebAuthn credential creation
 */
router.post('/register/options', verifyToken, async (req, res) => {
    try {
        const { userId, userName, userDisplayName } = req.body;
        
        // Use authenticated user if no specific user provided
        const targetUserId = userId || req.user.id;
        const targetUserName = userName || req.user.email;
        const targetDisplayName = userDisplayName || req.user.display_name || req.user.email;

        const result = await webauthnService.generateRegistrationOptions(
            targetUserId,
            targetUserName,
            targetDisplayName
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[WebAuthn] Registration options error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate registration options',
        });
    }
});

/**
 * POST /register/verify
 * Verify registration response and store credential
 */
router.post('/register/verify', verifyToken, async (req, res) => {
    try {
        const { challengeId, response, deviceName } = req.body;

        if (!challengeId || !response) {
            return res.status(400).json({
                success: false,
                error: 'challengeId and response are required',
            });
        }

        const result = await webauthnService.verifyRegistration(
            challengeId,
            req.user.id,
            response,
            deviceName
        );

        res.json({
            success: true,
            data: result,
            message: 'Passkey registered successfully',
        });
    } catch (error) {
        console.error('[WebAuthn] Registration verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to verify registration',
        });
    }
});

// ====== AUTHENTICATION ENDPOINTS ======

/**
 * POST /authenticate/options
 * Generate authentication options
 */
router.post('/authenticate/options', async (req, res) => {
    try {
        const { email, userId } = req.body;
        
        // If email provided, look up user
        let targetUserId = userId;
        if (email && !userId) {
            // Would need to look up user by email
            // For now, support discoverable credentials (no userId)
            targetUserId = null;
        }

        const result = await webauthnService.generateAuthenticationOptions(targetUserId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[WebAuthn] Authentication options error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate authentication options',
        });
    }
});

/**
 * POST /authenticate/verify
 * Verify authentication response
 */
router.post('/authenticate/verify', async (req, res) => {
    try {
        const { challengeId, response } = req.body;

        if (!challengeId || !response) {
            return res.status(400).json({
                success: false,
                error: 'challengeId and response are required',
            });
        }

        const result = await webauthnService.verifyAuthentication(challengeId, response);

        // Generate JWT token for authenticated user
        // This would integrate with your existing auth system
        res.json({
            success: true,
            data: result,
            message: 'Authentication successful',
        });
    } catch (error) {
        console.error('[WebAuthn] Authentication verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Authentication failed',
        });
    }
});

// ====== CREDENTIAL MANAGEMENT ======

/**
 * GET /credentials
 * List user's WebAuthn credentials
 */
router.get('/credentials', verifyToken, async (req, res) => {
    try {
        const credentials = await webauthnService.getUserCredentials(req.user.id);

        // Don't expose sensitive fields
        const safeCredentials = credentials.map(cred => ({
            id: cred.id,
            deviceName: cred.device_name,
            deviceType: cred.device_type,
            createdAt: cred.created_at,
            lastUsedAt: cred.last_used_at,
            usageCount: cred.usage_count,
            isActive: cred.is_active === 1,
            backupEligible: cred.backup_eligible === 1,
            backupState: cred.backup_state === 1,
        }));

        res.json({
            success: true,
            data: safeCredentials,
        });
    } catch (error) {
        console.error('[WebAuthn] List credentials error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list credentials',
        });
    }
});

/**
 * PATCH /credentials/:id
 * Rename a credential
 */
router.patch('/credentials/:id', verifyToken, async (req, res) => {
    try {
        const { deviceName } = req.body;

        if (!deviceName) {
            return res.status(400).json({
                success: false,
                error: 'deviceName is required',
            });
        }

        const result = await webauthnService.renameCredential(
            req.params.id,
            req.user.id,
            deviceName
        );

        if (!result.renamed) {
            return res.status(404).json({
                success: false,
                error: 'Credential not found',
            });
        }

        res.json({
            success: true,
            message: 'Credential renamed successfully',
        });
    } catch (error) {
        console.error('[WebAuthn] Rename credential error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rename credential',
        });
    }
});

/**
 * DELETE /credentials/:id
 * Revoke a credential
 */
router.delete('/credentials/:id', verifyToken, async (req, res) => {
    try {
        const { reason } = req.body;

        const result = await webauthnService.revokeCredential(
            req.params.id,
            req.user.id,
            reason
        );

        if (!result.revoked) {
            return res.status(404).json({
                success: false,
                error: 'Credential not found',
            });
        }

        res.json({
            success: true,
            message: 'Credential revoked successfully',
        });
    } catch (error) {
        console.error('[WebAuthn] Revoke credential error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke credential',
        });
    }
});

/**
 * GET /status
 * Check if user has WebAuthn enabled
 */
router.get('/status', verifyToken, async (req, res) => {
    try {
        const enabled = await webauthnService.isWebAuthnEnabled(req.user.id);

        res.json({
            success: true,
            data: {
                enabled,
                userId: req.user.id,
            },
        });
    } catch (error) {
        console.error('[WebAuthn] Status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check WebAuthn status',
        });
    }
});

export default router;

