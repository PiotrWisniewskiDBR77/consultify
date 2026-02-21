/**
 * MFA Service
 *
 * This codebase does not currently ship a complete MFA implementation in the service layer.
 * Do not return fake-success responses; expose honest contracts so callers can handle
 * unavailability explicitly.
 */

import { AppError } from '../utils/ErrorHandler.js';

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
    return false;
  },

  /**
   * Trust a device
   */
  trustDevice: async (userId: string, deviceFingerprint: string, deviceName: string) => {
    console.log(`[MFAService] trustDevice called for user: ${userId}`);
    return { success: false, error: 'Device trust is not available' };
  },

  /**
   * Verify TOTP code
   */
  verifyTOTP: async (userId: string, code: string) => {
    console.log(`[MFAService] verifyTOTP called for user: ${userId}`);
    return {
      success: false,
      error: 'MFA verification is not available',
      code: 'FEATURE_UNAVAILABLE',
    };
  },

  /**
   * Setup MFA for a user
   */
  setupMFA: async (userId: string, email: string) => {
    console.log(`[MFAService] setupMFA called for user: ${userId}`);
    throw new AppError('MFA setup is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Verify and enable MFA
   */
  verifyAndEnableMFA: async (userId: string, token: string) => {
    console.log(`[MFAService] verifyAndEnableMFA called for user: ${userId}`);
    throw new AppError('MFA enable is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Disable MFA for a user
   */
  disableMFA: async (userId: string, token: string) => {
    console.log(`[MFAService] disableMFA called for user: ${userId}`);
    throw new AppError('MFA disable is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Set dependencies (for testing)
   */
  setDependencies: (deps: any) => {
    console.log('[MFAService] setDependencies called');
  },
};

export default mfaService;
