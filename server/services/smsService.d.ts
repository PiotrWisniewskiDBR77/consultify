export default SMSService;
declare namespace SMSService {
    /**
     * Send an SMS message
     * @param {string} phoneNumber - E.164 format (+1234567890)
     * @param {string} message - Message content
     * @param {string} userId - Optional user ID for logging
     * @param {string} messageType - Type of message (verification, mfa, alert)
     * @returns {Promise<{success: boolean, messageSid?: string, error?: string}>}
     */
    function sendSMS(phoneNumber: string, message: string, userId?: string, messageType?: string): Promise<{
        success: boolean;
        messageSid?: string;
        error?: string;
    }>;
    /**
     * Generate and send OTP code
     * @param {string} userId
     * @param {string} phoneNumber
     * @param {string} purpose - 'phone_verify', 'mfa_login', 'mfa_setup', 'password_reset'
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function sendOTP(userId: string, phoneNumber: string, purpose?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify OTP code
     * @param {string} userId
     * @param {string} code
     * @param {string} purpose
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function verifyOTP(userId: string, code: string, purpose?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify phone number ownership
     * @param {string} userId
     * @param {string} phoneNumber
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function initiatePhoneVerification(userId: string, phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Complete phone verification
     * @param {string} userId
     * @param {string} code
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    function completePhoneVerification(userId: string, code: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get phone verification status
     * @param {string} userId
     * @returns {Promise<{hasPhone: boolean, verified: boolean, phoneNumber?: string}>}
     */
    function getPhoneStatus(userId: string): Promise<{
        hasPhone: boolean;
        verified: boolean;
        phoneNumber?: string;
    }>;
    /**
     * Handle Twilio delivery status webhook
     * @param {Object} data - Twilio webhook payload
     */
    function handleStatusCallback(data: Object): Promise<void>;
    function _generateOTP(): string;
    function _isValidPhoneNumber(phone: any): boolean;
    function _maskPhoneNumber(phone: any): any;
    function _checkRateLimit(phoneNumber: any): Promise<boolean>;
    function _incrementRateLimit(phoneNumber: any, userId: any): Promise<void>;
    function _logDelivery(id: any, userId: any, phoneNumber: any, messageType: any, status: any, messageSid?: null): Promise<void>;
}
//# sourceMappingURL=smsService.d.ts.map