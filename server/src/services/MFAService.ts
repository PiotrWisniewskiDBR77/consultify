/**
 * MFA Service - Stub Implementation
 * Returns disabled MFA status by default to allow login without MFA
 */

const mfaService = {
    /**
     * Get MFA status for a user - returns disabled by default
     */
    getMFAStatus: async (userId: string) => {
        console.log(`[MFAService] getMFAStatus called for user: ${userId}`);
        return {
            enabled: false,
            methods: [],
            enforced: false,
        };
    },

    /**
     * Check if a device is trusted
     */
    isDeviceTrusted: async (userId: string, deviceFingerprint: string) => {
        console.log(`[MFAService] isDeviceTrusted called for user: ${userId}`);
        return true; // Trust all devices when MFA is disabled
    },

    /**
     * Trust a device
     */
    trustDevice: async (userId: string, deviceFingerprint: string, deviceName: string) => {
        console.log(`[MFAService] trustDevice called for user: ${userId}`);
        return { success: true };
    },

    /**
     * Verify TOTP code
     */
    verifyTOTP: async (userId: string, code: string) => {
        console.log(`[MFAService] verifyTOTP called for user: ${userId}`);
        return { success: false, error: 'MFA not configured' };
    },

    /**
     * Setup MFA for a user
     */
    setupMFA: async (userId: string, email: string) => {
        console.log(`[MFAService] setupMFA called for user: ${userId}`);
        return { success: false, error: 'MFA setup not implemented' };
    },

    /**
     * Verify and enable MFA
     */
    verifyAndEnableMFA: async (userId: string, token: string) => {
        console.log(`[MFAService] verifyAndEnableMFA called for user: ${userId}`);
        return { success: false, error: 'MFA not implemented' };
    },

    /**
     * Disable MFA for a user
     */
    disableMFA: async (userId: string, token: string) => {
        console.log(`[MFAService] disableMFA called for user: ${userId}`);
        return { success: true };
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies: (deps: any) => {
        console.log('[MFAService] setDependencies called');
    },
};

export default mfaService;
