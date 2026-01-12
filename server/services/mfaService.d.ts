export default MFAService;
declare namespace MFAService {
    /**
     * Setup SMS as MFA method
     * @param {string} userId
     * @param {string} phoneNumber - E.164 format
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function setupSMSMFA(userId: string, phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify phone and enable SMS MFA
     * @param {string} userId
     * @param {string} code
     * @returns {Promise<{success: boolean, backupCodes?: string[], error?: string}>}
     */
    function verifySMSSetup(userId: string, code: string): Promise<{
        success: boolean;
        backupCodes?: string[];
        error?: string;
    }>;
    /**
     * Send SMS code for MFA challenge during login
     * @param {string} userId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function sendSMSChallenge(userId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify SMS code during login
     * @param {string} userId
     * @param {string} code
     * @param {string} ip
     * @param {string} userAgent
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function verifySMSCode(userId: string, code: string, ip?: string, userAgent?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get user's MFA methods and status
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    function getMFAMethods(userId: string): Promise<Object>;
    /**
     * Set primary MFA method
     * @param {string} userId
     * @param {string} method - 'totp' or 'sms'
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function setPrimaryMethod(userId: string, method: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Disable SMS MFA (keep TOTP if enabled)
     * @param {string} userId
     * @param {string} token - TOTP or SMS code for verification
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function disableSMSMFA(userId: string, token: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    function _maskPhoneNumber(phone: any): any;
    /**
     * Generate a new TOTP secret and QR code for MFA setup
     * @param {string} userId
     * @param {string} userEmail
     * @returns {Promise<{secret: string, qrCode: string, manualEntry: string}>}
     */
    function setupMFA(userId: string, userEmail: string): Promise<{
        secret: string;
        qrCode: string;
        manualEntry: string;
    }>;
    /**
     * Verify TOTP token and complete MFA setup
     * @param {string} userId
     * @param {string} token
     * @returns {Promise<{success: boolean, backupCodes?: string[]}>}
     */
    function verifyAndEnableMFA(userId: string, token: string): Promise<{
        success: boolean;
        backupCodes?: string[];
    }>;
    /**
     * Verify TOTP during login
     * @param {string} userId
     * @param {string} token
     * @param {string} ip
     * @param {string} userAgent
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function verifyTOTP(userId: string, token: string, ip?: string, userAgent?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Use a backup code (single-use)
     * @param {string} userId
     * @param {string} code
     * @param {string} ip
     * @param {string} userAgent
     * @returns {Promise<{success: boolean, remainingCodes?: number}>}
     */
    function useBackupCode(userId: string, code: string, ip?: string, userAgent?: string): Promise<{
        success: boolean;
        remainingCodes?: number;
    }>;
    /**
     * Regenerate backup codes (requires TOTP verification)
     * @param {string} userId
     * @param {string} totpToken
     * @returns {Promise<{success: boolean, backupCodes?: string[]}>}
     */
    function regenerateBackupCodes(userId: string, totpToken: string): Promise<{
        success: boolean;
        backupCodes?: string[];
    }>;
    /**
     * Disable MFA (requires TOTP verification)
     * @param {string} userId
     * @param {string} token
     * @returns {Promise<{success: boolean}>}
     */
    function disableMFA(userId: string, token: string): Promise<{
        success: boolean;
    }>;
    /**
     * Check if MFA is required for user
     * @param {string} userId
     * @returns {Promise<{required: boolean, enabled: boolean, gracePeriodRemaining?: number}>}
     */
    function getMFAStatus(userId: string): Promise<{
        required: boolean;
        enabled: boolean;
        gracePeriodRemaining?: number;
    }>;
    /**
     * Register a trusted device
     * @param {string} userId
     * @param {string} deviceFingerprint
     * @param {string} deviceName
     * @returns {Promise<{success: boolean, deviceId: string}>}
     */
    function trustDevice(userId: string, deviceFingerprint: string, deviceName?: string): Promise<{
        success: boolean;
        deviceId: string;
    }>;
    /**
     * Check if device is trusted
     * @param {string} userId
     * @param {string} deviceFingerprint
     * @returns {Promise<boolean>}
     */
    function isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean>;
    /**
     * Get user's trusted devices
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    function getTrustedDevices(userId: string): Promise<any[]>;
    /**
     * Revoke a trusted device
     * @param {string} userId
     * @param {string} deviceId
     * @returns {Promise<{success: boolean}>}
     */
    function revokeTrustedDevice(userId: string, deviceId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Revoke all trusted devices (security action)
     * @param {string} userId
     * @returns {Promise<{success: boolean, count: number}>}
     */
    function revokeAllTrustedDevices(userId: string): Promise<{
        success: boolean;
        count: number;
    }>;
    function _generateBackupCodes(): Promise<{
        codes: string[];
        hashedCodes: string[];
    }>;
    function _logAttempt(userId: any, attemptType: any, success: any, ip?: null, userAgent?: null): Promise<void>;
    function _isBlocked(userId: any, ip: any): Promise<boolean>;
}
//# sourceMappingURL=mfaService.d.ts.map