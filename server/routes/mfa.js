/**
 * MFA Routes
 * 
 * API endpoints for Multi-Factor Authentication.
 * 
 * Endpoints:
 * - GET  /api/mfa/status - Get MFA status for current user
 * - POST /api/mfa/setup - Initialize MFA setup (get QR code)
 * - POST /api/mfa/verify-setup - Verify TOTP and enable MFA
 * - POST /api/mfa/challenge - Verify TOTP during login
 * - POST /api/mfa/backup-code - Use backup code during login
 * - POST /api/mfa/regenerate-codes - Regenerate backup codes
 * - POST /api/mfa/disable - Disable MFA
 * - GET  /api/mfa/devices - List trusted devices
 * - DELETE /api/mfa/devices/:id - Revoke trusted device
 * - DELETE /api/mfa/devices - Revoke all trusted devices
 */

import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import MFAService from '../services/mfaService.js';
import AuditService from '../services/auditService.js';
import SMSService from '../services/smsService.js';

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/mfa/status
 * Get MFA status for current user
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await MFAService.getMFAStatus(userId);

        res.json(status);
    } catch (error) {
        console.error('[MFA] Status error:', error);
        res.status(500).json({ error: 'Failed to get MFA status' });
    }
});

/**
 * POST /api/mfa/setup
 * Initialize MFA setup - returns QR code and secret
 */
router.post('/setup', async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        const setup = await MFAService.setupMFA(userId, userEmail);

        // Log setup initiation
        AuditService.logFromRequest(req, 'MFA_SETUP_INITIATED', 'user', userId, {
            email: userEmail
        });

        res.json({
            qrCode: setup.qrCode,
            manualEntry: setup.manualEntry,
            message: 'Scan the QR code with your authenticator app, then verify with a code'
        });
    } catch (error) {
        console.error('[MFA] Setup error:', error);
        res.status(500).json({ error: 'Failed to initialize MFA setup' });
    }
});

/**
 * POST /api/mfa/verify-setup
 * Verify TOTP code and complete MFA setup
 * Body: { token: string }
 */
router.post('/verify-setup', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token || token.length !== 6) {
            return res.status(400).json({ error: 'Invalid token format. Must be 6 digits.' });
        }

        const result = await MFAService.verifyAndEnableMFA(userId, token);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Log MFA enabled
        AuditService.logFromRequest(req, 'MFA_ENABLED', 'user', userId, {
            backupCodesGenerated: result.backupCodes.length
        });

        res.json({
            success: true,
            backupCodes: result.backupCodes,
            message: 'MFA enabled successfully. Save your backup codes in a safe place.'
        });
    } catch (error) {
        console.error('[MFA] Verify setup error:', error);
        res.status(500).json({ error: 'Failed to verify MFA setup' });
    }
});

/**
 * POST /api/mfa/challenge
 * Verify TOTP during login (called after password verification)
 * Body: { token: string, trustDevice?: boolean, deviceFingerprint?: string }
 */
router.post('/challenge', async (req, res) => {
    try {
        const { token, trustDevice, deviceFingerprint } = req.body;
        const userId = req.user.id;
        const ip = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('user-agent');

        if (!token || token.length !== 6) {
            return res.status(400).json({ error: 'Invalid token format. Must be 6 digits.' });
        }

        const result = await MFAService.verifyTOTP(userId, token, ip, userAgent);

        if (!result.success) {
            return res.status(401).json({
                error: result.error,
                blocked: result.blocked || false
            });
        }

        // Trust device if requested
        if (trustDevice && deviceFingerprint) {
            const deviceName = `${req.get('user-agent') || 'Unknown Device'}`.substring(0, 100);
            await MFAService.trustDevice(userId, deviceFingerprint, deviceName);
        }

        // Log successful MFA verification
        AuditService.logFromRequest(req, 'MFA_VERIFIED', 'user', userId, {
            method: 'TOTP',
            deviceTrusted: trustDevice || false
        });

        res.json({
            success: true,
            message: 'MFA verification successful'
        });
    } catch (error) {
        console.error('[MFA] Challenge error:', error);
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

/**
 * POST /api/mfa/backup-code
 * Use backup code during login
 * Body: { code: string }
 */
router.post('/backup-code', async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;
        const ip = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('user-agent');

        if (!code) {
            return res.status(400).json({ error: 'Backup code is required' });
        }

        const result = await MFAService.useBackupCode(userId, code, ip, userAgent);

        if (!result.success) {
            return res.status(401).json({
                error: result.error,
                blocked: result.blocked || false
            });
        }

        // Log backup code usage
        AuditService.logFromRequest(req, 'MFA_BACKUP_CODE_USED', 'user', userId, {
            remainingCodes: result.remainingCodes
        });

        res.json({
            success: true,
            remainingCodes: result.remainingCodes,
            warning: result.warning
        });
    } catch (error) {
        console.error('[MFA] Backup code error:', error);
        res.status(500).json({ error: 'Backup code verification failed' });
    }
});

/**
 * POST /api/mfa/regenerate-codes
 * Regenerate backup codes (requires TOTP verification)
 * Body: { token: string }
 */
router.post('/regenerate-codes', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token || token.length !== 6) {
            return res.status(400).json({ error: 'TOTP token required to regenerate codes' });
        }

        const result = await MFAService.regenerateBackupCodes(userId, token);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Log regeneration
        AuditService.logFromRequest(req, 'MFA_BACKUP_CODES_REGENERATED', 'user', userId);

        res.json({
            success: true,
            backupCodes: result.backupCodes,
            message: 'New backup codes generated. Previous codes are now invalid.'
        });
    } catch (error) {
        console.error('[MFA] Regenerate codes error:', error);
        res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
});

/**
 * POST /api/mfa/disable
 * Disable MFA (requires TOTP verification)
 * Body: { token: string }
 */
router.post('/disable', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token || token.length !== 6) {
            return res.status(400).json({ error: 'TOTP token required to disable MFA' });
        }

        const result = await MFAService.disableMFA(userId, token);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Also revoke all trusted devices
        await MFAService.revokeAllTrustedDevices(userId);

        // Log MFA disabled (critical security event)
        AuditService.logFromRequest(req, 'MFA_DISABLED', 'user', userId);

        res.json({
            success: true,
            message: 'MFA has been disabled. We recommend enabling it again for security.'
        });
    } catch (error) {
        console.error('[MFA] Disable error:', error);
        res.status(500).json({ error: 'Failed to disable MFA' });
    }
});

// ==========================================
// TRUSTED DEVICES
// ==========================================

/**
 * GET /api/mfa/devices
 * List trusted devices
 */
router.get('/devices', async (req, res) => {
    try {
        const userId = req.user.id;
        const devices = await MFAService.getTrustedDevices(userId);

        res.json({ devices });
    } catch (error) {
        console.error('[MFA] Get devices error:', error);
        res.status(500).json({ error: 'Failed to get trusted devices' });
    }
});

/**
 * DELETE /api/mfa/devices/:id
 * Revoke a trusted device
 */
router.delete('/devices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await MFAService.revokeTrustedDevice(userId, id);

        if (!result.success) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Log device revocation
        AuditService.logFromRequest(req, 'MFA_DEVICE_REVOKED', 'trusted_device', id);

        res.json({ success: true, message: 'Device revoked' });
    } catch (error) {
        console.error('[MFA] Revoke device error:', error);
        res.status(500).json({ error: 'Failed to revoke device' });
    }
});

/**
 * DELETE /api/mfa/devices
 * Revoke all trusted devices
 */
router.delete('/devices', async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await MFAService.revokeAllTrustedDevices(userId);

        // Log all devices revoked
        AuditService.logFromRequest(req, 'MFA_ALL_DEVICES_REVOKED', 'user', userId, {
            count: result.count
        });

        res.json({
            success: true,
            message: `${result.count} device(s) revoked`
        });
    } catch (error) {
        console.error('[MFA] Revoke all devices error:', error);
        res.status(500).json({ error: 'Failed to revoke devices' });
    }
});

// ==========================================
// SMS MFA ROUTES
// ==========================================

/**
 * GET /api/mfa/methods
 * Get available MFA methods and status
 */
router.get('/methods', async (req, res) => {
    try {
        const userId = req.user.id;
        const methods = await MFAService.getMFAMethods(userId);
        res.json(methods);
    } catch (error) {
        console.error('[MFA] Get methods error:', error);
        res.status(500).json({ error: 'Failed to get MFA methods' });
    }
});

/**
 * POST /api/mfa/sms/setup
 * Initialize SMS MFA setup - send verification code to phone
 * Body: { phoneNumber: string } - E.164 format (+1234567890)
 */
router.post('/sms/setup', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const userId = req.user.id;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const result = await MFAService.setupSMSMFA(userId, phoneNumber);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Log setup initiation
        AuditService.logFromRequest(req, 'SMS_MFA_SETUP_INITIATED', 'user', userId, {
            phoneNumber: phoneNumber.slice(0, 3) + '***' + phoneNumber.slice(-4)
        });

        res.json({
            success: true,
            message: result.message,
            expiresAt: result.expiresAt
        });
    } catch (error) {
        console.error('[MFA] SMS setup error:', error);
        res.status(500).json({ error: 'Failed to initialize SMS MFA' });
    }
});

/**
 * POST /api/mfa/sms/verify-setup
 * Verify SMS code and complete SMS MFA setup
 * Body: { code: string }
 */
router.post('/sms/verify-setup', async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        if (!code || code.length !== 6) {
            return res.status(400).json({ error: 'Invalid code format. Must be 6 digits.' });
        }

        const result = await MFAService.verifySMSSetup(userId, code);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Log SMS MFA enabled
        AuditService.logFromRequest(req, 'SMS_MFA_ENABLED', 'user', userId, {
            backupCodesGenerated: result.backupCodes.length
        });

        res.json({
            success: true,
            backupCodes: result.backupCodes,
            message: 'SMS MFA enabled successfully. Save your backup codes.'
        });
    } catch (error) {
        console.error('[MFA] SMS verify setup error:', error);
        res.status(500).json({ error: 'Failed to verify SMS setup' });
    }
});

/**
 * POST /api/mfa/sms/send
 * Send SMS code for MFA challenge (during login)
 */
router.post('/sms/send', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await MFAService.sendSMSChallenge(userId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'Verification code sent',
            expiresAt: result.expiresAt
        });
    } catch (error) {
        console.error('[MFA] SMS send error:', error);
        res.status(500).json({ error: 'Failed to send SMS code' });
    }
});

/**
 * POST /api/mfa/sms/verify
 * Verify SMS code during login (MFA challenge)
 * Body: { code: string, trustDevice?: boolean, deviceFingerprint?: string }
 */
router.post('/sms/verify', async (req, res) => {
    try {
        const { code, trustDevice, deviceFingerprint } = req.body;
        const userId = req.user.id;
        const ip = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('user-agent');

        if (!code || code.length !== 6) {
            return res.status(400).json({ error: 'Invalid code format. Must be 6 digits.' });
        }

        const result = await MFAService.verifySMSCode(userId, code, ip, userAgent);

        if (!result.success) {
            return res.status(401).json({
                error: result.error,
                blocked: result.blocked || false
            });
        }

        // Trust device if requested
        if (trustDevice && deviceFingerprint) {
            const deviceName = `${req.get('user-agent') || 'Unknown Device'}`.substring(0, 100);
            await MFAService.trustDevice(userId, deviceFingerprint, deviceName);
        }

        // Log successful SMS MFA verification
        AuditService.logFromRequest(req, 'MFA_VERIFIED', 'user', userId, {
            method: 'SMS',
            deviceTrusted: trustDevice || false
        });

        res.json({
            success: true,
            message: 'SMS verification successful'
        });
    } catch (error) {
        console.error('[MFA] SMS verify error:', error);
        res.status(500).json({ error: 'SMS verification failed' });
    }
});

/**
 * PUT /api/mfa/primary-method
 * Set primary MFA method
 * Body: { method: 'totp' | 'sms' }
 */
router.put('/primary-method', async (req, res) => {
    try {
        const { method } = req.body;
        const userId = req.user.id;

        if (!method || !['totp', 'sms'].includes(method)) {
            return res.status(400).json({ error: 'Invalid method. Must be "totp" or "sms".' });
        }

        const result = await MFAService.setPrimaryMethod(userId, method);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        AuditService.logFromRequest(req, 'MFA_PRIMARY_METHOD_CHANGED', 'user', userId, {
            newMethod: method
        });

        res.json({ success: true, message: `Primary MFA method set to ${method}` });
    } catch (error) {
        console.error('[MFA] Set primary method error:', error);
        res.status(500).json({ error: 'Failed to set primary method' });
    }
});

/**
 * POST /api/mfa/sms/disable
 * Disable SMS MFA
 * Body: { token: string } - Current TOTP or SMS code
 */
router.post('/sms/disable', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token || token.length !== 6) {
            return res.status(400).json({ error: 'Verification code required' });
        }

        const result = await MFAService.disableSMSMFA(userId, token);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        AuditService.logFromRequest(req, 'SMS_MFA_DISABLED', 'user', userId, {
            mfaStillEnabled: result.mfaStillEnabled
        });

        res.json({
            success: true,
            mfaStillEnabled: result.mfaStillEnabled,
            message: result.message
        });
    } catch (error) {
        console.error('[MFA] SMS disable error:', error);
        res.status(500).json({ error: 'Failed to disable SMS MFA' });
    }
});

/**
 * GET /api/mfa/phone-status
 * Get phone verification status
 */
router.get('/phone-status', async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await SMSService.getPhoneStatus(userId);
        res.json(status);
    } catch (error) {
        console.error('[MFA] Phone status error:', error);
        res.status(500).json({ error: 'Failed to get phone status' });
    }
});

export default router;
