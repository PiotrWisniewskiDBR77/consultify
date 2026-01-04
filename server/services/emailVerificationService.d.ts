export default EmailVerificationService;
declare namespace EmailVerificationService {
    /**
     * Generate verification token and send email
     * @param {string} userId
     * @param {string} email
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    function sendVerificationEmail(userId: string, email: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    /**
     * Verify email with token
     * @param {string} token
     * @returns {Promise<{success: boolean, userId?: string}>}
     */
    function verifyEmail(token: string): Promise<{
        success: boolean;
        userId?: string;
    }>;
    /**
     * Check if email is verified
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    function isEmailVerified(userId: string): Promise<boolean>;
    /**
     * Request email change (sends verification to new email)
     * @param {string} userId
     * @param {string} newEmail
     * @param {string} currentPassword - For security verification
     * @returns {Promise<{success: boolean}>}
     */
    function requestEmailChange(userId: string, newEmail: string, currentPassword: string): Promise<{
        success: boolean;
    }>;
    /**
     * Confirm email change
     * @param {string} token
     * @returns {Promise<{success: boolean, newEmail?: string}>}
     */
    function confirmEmailChange(token: string): Promise<{
        success: boolean;
        newEmail?: string;
    }>;
    /**
     * Cancel pending email change
     * @param {string} userId
     * @returns {Promise<{success: boolean}>}
     */
    function cancelEmailChange(userId: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=emailVerificationService.d.ts.map